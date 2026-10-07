import { cancelarTodosRecordatorios } from '@/lib/notifications';
import { subirImagen } from '@/lib/media';
import { Alert } from '@/lib/alert';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';


import { APP, CORREO_SOPORTE, POLITICA_VERSION, URL_ELIMINAR_CUENTA, type Nivel, type Posicion } from '@/constants/config';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { comprobarRespuesta } from '@/lib/data-utils';
import type { Profile } from '@/types/database';

/**
 * A dónde vuelve el usuario al abrir el enlace del correo de recuperación.
 *
 * En la web ese enlace lo abre un navegador, así que tiene que ser una URL http(s)
 * de la propia app: un esquema nativo como `faltauno://reset` el navegador no lo
 * sabe abrir y el enlace queda muerto. Tomamos el origen desde el que se sirve la
 * app, así funciona igual en producción que en local sin configurar nada. En
 * celular sí va el deep link, que es lo que entiende el sistema.
 *
 * Ojo: el destino tiene que estar en Supabase → Authentication → URL Configuration
 * → Redirect URLs. Verificado el 6 de octubre de 2026: la lista blanca acepta
 * https://falta-uno.kodarify.com/** y faltauno://reset, y rechaza dominios
 * parecidos y http sin cifrar.
 */
function destinoReset() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/reset`;
  }
  return 'faltauno://reset';
}

const DEMO_KEY = 'faltauno.demo.profile';
const PENDING_KEY = 'faltauno.pendingProfile';

export interface DatosRegistro {
  nombre: string;
  email: string;
  password: string;
  ciudad: string;
  posicion: Posicion;
  nivel: Nivel;
  celular: string;
  roles?: string[]; // 'jugador' y/o 'cancha'
}

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  /** `true` cuando corre sin backend (modo demo/local). */
  demo: boolean;
  /** `true` si es un invitado (perfil demo) corriendo contra el backend real: solo-lectura. */
  esInvitado: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Envía el correo de recuperación de contraseña. */
  resetPassword: (email: string) => Promise<void>;
  /** Devuelve si quedó pendiente confirmar el correo (sin sesión inmediata). */
  signUp: (datos: DatosRegistro) => Promise<{ needsConfirmation: boolean }>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Elimina la cuenta y sus datos (requerido por App Store y Play Store).
   *
   * Si quedan obligaciones sin liquidar lanza `BorradoPendiente` con los
   * motivos. En ese caso la solicitud queda registrada y la sesión NO se cierra:
   * la cuenta sigue existiendo hasta que se resuelvan.
   */
  eliminarCuenta: () => Promise<void>;
  /** Estado de la solicitud de borrado, o `null` si no hay ninguna. */
  solicitudBorrado: () => Promise<SolicitudBorrado | null>;
  /**
   * `true` cuando la política vigente cambió desde que esta persona la aceptó.
   * Nunca se actualiza el consentimiento por detrás: lo tiene que aceptar ella.
   */
  politicaDesactualizada: boolean;
  /** Registra la aceptación de la versión vigente de la política. */
  aceptarPolitica: () => Promise<void>;
  updateProfile: (cambios: Partial<Profile>) => Promise<void>;
  /**
   * Relee el perfil desde el servidor.
   *
   * Hace falta cuando el rol lo cambia el servidor y no el cliente: al dar de
   * alta un establecimiento, la RPC agrega el rol `cancha` dentro de su misma
   * transacción, y un trigger impide que la app toque `roles` por su cuenta.
   * Sin esto, el dueño recién registrado seguiría viendo la app como jugador
   * hasta volver a entrar.
   */
  refrescarPerfil: () => Promise<void>;
}

/**
 * Por qué el servidor todavía no puede cerrar la cuenta. Son obligaciones
 * pendientes, no fallos: borrar la cuenta no puede hacer desaparecer el dinero
 * ni los compromisos con otra persona.
 */
export type MotivoBorrado =
  | 'reservas_futuras'
  | 'partidos_futuros'
  | 'pagos_pendientes'
  | 'reservas_pago_pendiente'
  | 'devoluciones_pendientes'
  | 'saldo_por_liquidar'
  | 'retiros_en_curso';

/** Texto que ve el usuario para cada motivo. */
export const TEXTO_MOTIVO_BORRADO: Record<MotivoBorrado, string> = {
  reservas_futuras: 'Tenés reservas de cancha que todavía no pasaron.',
  partidos_futuros: 'Estás anotado o organizando partidos que todavía no se jugaron.',
  pagos_pendientes: 'Hay pagos tuyos que la pasarela no terminó de confirmar.',
  reservas_pago_pendiente: 'Hay reservas con el pago sin resolver.',
  devoluciones_pendientes: 'Te debemos una devolución que todavía no se completó.',
  saldo_por_liquidar: 'Tu cancha tiene saldo sin liquidar.',
  retiros_en_curso: 'Tenés un retiro en curso.',
};

/**
 * La cuenta NO se cerró porque quedan obligaciones, pero la solicitud sí quedó
 * registrada: el usuario no tiene que volver a pedirla.
 */
/** Solicitud de borrado registrada en el servidor. */
export interface SolicitudBorrado {
  /** `pendiente`: falta liquidar. `lista`: se puede cerrar. `completada`: ya se cerró. */
  estado: 'pendiente' | 'lista' | 'completada';
  motivos: MotivoBorrado[];
  solicitada_at: string;
}

export class BorradoPendiente extends Error {
  readonly motivos: MotivoBorrado[];
  constructor(mensaje: string, motivos: MotivoBorrado[]) {
    super(mensaje);
    this.name = 'BorradoPendiente';
    this.motivos = motivos;
  }
}

/**
 * `functions.invoke` no devuelve el cuerpo cuando la respuesta es de error: lo
 * deja en `context`, que es el `Response` original. Sin leerlo, un 409 con el
 * detalle de lo que falta liquidar se vería igual que una caída del servidor, y
 * el usuario repetiría el borrado sin entender por qué no pasa nada.
 */
async function cuerpoDeError(error: unknown): Promise<Record<string, unknown> | null> {
  const contexto = (error as { context?: unknown })?.context;
  if (!contexto || typeof (contexto as Response).json !== 'function') return null;
  try {
    return (await (contexto as Response).json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function perfilDemo(parcial: Partial<Profile> = {}): Profile {
  return {
    id: 'demo-' + Math.abs(hashLite(parcial.email ?? 'invitado')),
    nombre: parcial.nombre ?? 'Invitado',
    email: parcial.email ?? 'invitado@faltauno.app',
    ciudad: parcial.ciudad ?? APP.defaultCity,
    posicion: parcial.posicion ?? 'Mediocampista',
    nivel: parcial.nivel ?? 'Intermedio',
    celular: parcial.celular ?? '+57 300 000 0000',
    avatar_url: null,
    partidos_jugados: parcial.partidos_jugados ?? 12,
    no_shows: parcial.no_shows ?? 0,
    rating: parcial.rating ?? 4.5,
    created_at: new Date().toISOString(),
  };
}

// hash chiquito y estable para generar ids demo deterministas
function hashLite(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const activo = useRef(true);
  const version = useRef(0);
  const perfilActual = useRef<Profile | null>(null);
  const cargaPerfil = useRef<{ id: string; promesa: Promise<void> } | null>(null);

  const aplicarPerfil = useCallback((p: Profile | null) => {
    if (!activo.current) return;
    perfilActual.current = p;
    useStore.getState().reiniciarSesion(p?.id ?? null);
    setProfile(p);
  }, []);

  const cargarPerfil = useCallback((session: Session): Promise<void> => {
    if (cargaPerfil.current?.id === session.user.id) return cargaPerfil.current.promesa;
    const actual = version.current;
    const promesa = (async () => {
      let data = comprobarRespuesta(await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle()) as Profile | null;
      if (!activo.current || actual !== version.current) return;
      if (!data) {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        let pendiente: Record<string, unknown> | null = null;
        try {
          const p = raw ? JSON.parse(raw) : null;
          // Never attach another account's pending profile to the new session.
          if (p?.id === session.user.id && p.email === session.user.email) pendiente = p;
        } catch { /* A corrupt local draft is not an authenticated profile. */ }
        const metadata = session.user.user_metadata?.profile;
        const fuente = pendiente ?? (metadata && typeof metadata === 'object' ? metadata : null);
        if (!fuente) throw new Error('No pudimos recuperar tu perfil. Intentá iniciar sesión de nuevo.');
        const nuevo = { id:session.user.id,email:session.user.email,
          nombre:fuente.nombre,ciudad:fuente.ciudad,posicion:fuente.posicion,nivel:fuente.nivel,
          celular:fuente.celular,avatar_url:null,roles:fuente.roles ?? ['jugador'],
          politica_version:fuente.politica_version,politica_aceptada_at:fuente.politica_aceptada_at };
        comprobarRespuesta(await supabase.from('profiles').upsert(nuevo as never,{onConflict:'id',ignoreDuplicates:true}));
        data = comprobarRespuesta(await supabase.from('profiles').select('*').eq('id',session.user.id).single()) as Profile;
        if (pendiente) await AsyncStorage.removeItem(PENDING_KEY);
      }
      if (!activo.current || actual !== version.current) return;
      if (data.suspendido) {
        const {error} = await supabase.auth.signOut();
        if (error) throw new Error('Tu cuenta está suspendida.');
        aplicarPerfil(null);
        Alert.alert(
          'Cuenta suspendida',
          'Tu cuenta fue suspendida por incumplir las normas de la comunidad. Si creés que es un error, escribinos a ' +
            CORREO_SOPORTE +
            '. Para pedir el borrado de tu cuenta sin entrar a la app, entrá a ' +
            URL_ELIMINAR_CUENTA,
        );
        throw new Error('Tu cuenta está suspendida.');
      }
      aplicarPerfil(data);
    })().finally(() => {
      if (cargaPerfil.current?.promesa === promesa) cargaPerfil.current = null;
    });
    cargaPerfil.current = { id:session.user.id,promesa };
    return promesa;
  }, [aplicarPerfil]);

  useEffect(() => {
    activo.current = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const subscription = supabaseConfigurado ? supabase.auth.onAuthStateChange((event,session) => {
      // No Supabase awaits inside the auth callback: it runs under the auth lock.
      if (!session) {
        version.current++;
        cargaPerfil.current = null;
        aplicarPerfil(null);
        return;
      }
      if ((event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && perfilActual.current?.id === session.user.id) return;
      if (perfilActual.current && perfilActual.current.id !== session.user.id) {
        version.current++;
        cargaPerfil.current = null;
        aplicarPerfil(null);
      }
      const eventVersion = version.current;
      const t = setTimeout(() => {
        timers.delete(t);
        if (activo.current && eventVersion === version.current) void cargarPerfil(session).catch(() => {
          if (activo.current) setLoading(false);
        });
      },0);
      timers.add(t);
    }).data.subscription : null;
    const initialVersion = version.current;
    void (async () => {
      try {
        if (!supabaseConfigurado) {
          const raw = await AsyncStorage.getItem(DEMO_KEY);
          aplicarPerfil(raw ? JSON.parse(raw) as Profile : null);
        } else {
          const {data,error} = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session && initialVersion === version.current) await cargarPerfil(data.session);
        }
      } catch { if (activo.current && initialVersion === version.current) aplicarPerfil(null); }
      finally { if (activo.current) setLoading(false); }
    })();
    return () => {
      activo.current = false;
      version.current++;
      cargaPerfil.current = null;
      subscription?.unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [aplicarPerfil,cargarPerfil]);

  const value = useMemo<AuthState>(
    () => ({
      profile,
      loading,
      demo: !supabaseConfigurado,
      // Invitado real: perfil demo pero contra el backend (sus escrituras fallarían por RLS).
      esInvitado: supabaseConfigurado && !!profile?.id?.startsWith('demo'),

      async signIn(email, password) {
        if (!supabaseConfigurado) {
          const raw = await AsyncStorage.getItem(DEMO_KEY);
          const p = raw ? (JSON.parse(raw) as Profile) : perfilDemo({ email });
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(p));
          aplicarPerfil(p);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email:email.trim().toLowerCase(), password });
        if (error) throw new Error(traducirError(error.message));
        if (data.session) await cargarPerfil(data.session);
      },

      async resetPassword(email) {
        if (!supabaseConfigurado) return; // demo: no-op (la UI muestra el mensaje)
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: destinoReset(),
        });
        if (error) throw new Error(traducirError(error.message));
      },

      async signUp(datos) {
        if (!supabaseConfigurado) {
          const p = perfilDemo(datos);
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(p));
          aplicarPerfil(p);
          return { needsConfirmation: false };
        }
        const nuevo = {
          nombre:datos.nombre,email:datos.email.trim().toLowerCase(),ciudad:datos.ciudad,
          posicion:datos.posicion,nivel:datos.nivel,celular:datos.celular,
          roles:datos.roles ?? ['jugador'],politica_version:POLITICA_VERSION,
          politica_aceptada_at:new Date().toISOString(),
        };
        const {data,error} = await supabase.auth.signUp({
          email:nuevo.email,password:datos.password,options:{data:{profile:nuevo}},
        });
        if (error) throw new Error(traducirError(error.message));
        if (data.session) {
          await cargarPerfil(data.session);
          return {needsConfirmation:false};
        }
        // Confirmación pendiente: guardamos el perfil para crearlo al primer login.
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({...nuevo,id:data.user?.id}));
        return { needsConfirmation: true };
      },

      async signInAsGuest() {
        if (supabaseConfigurado) {
          const {error} = await supabase.auth.signOut();
          if (error) throw new Error('No pudimos cambiar a modo invitado.');
        }
        version.current++;
        cargaPerfil.current = null;
        // Invitado arranca en cero: nada de estadísticas ficticias que parezcan reales.
        const p = perfilDemo({ nombre: 'Invitado', email: 'invitado@faltauno.app', partidos_jugados: 0, no_shows: 0, rating: 0 });
        await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(p));
        aplicarPerfil(p);
      },

      async signOut() {
        if (supabaseConfigurado) {
          const {error} = await supabase.auth.signOut();
          if (error) throw new Error('No pudimos cerrar sesión. Revisá tu conexión.');
        }
        version.current++;
        cargaPerfil.current = null;
        await cancelarTodosRecordatorios();
        await AsyncStorage.removeItem(DEMO_KEY);
        aplicarPerfil(null);
      },

      async eliminarCuenta() {
        if (!supabaseConfigurado) {
          // Modo demo: borramos los datos locales del usuario
          await AsyncStorage.multiRemove([DEMO_KEY, PENDING_KEY]);
          aplicarPerfil(null);
          return;
        }
        // La eliminación real (perfil + usuario de Auth) la hace la Edge Function
        // `delete-user` con service_role (el cliente no tiene policy de DELETE).
        // Si falla, NO cerramos sesión y propagamos el error para avisar al usuario.
        const { data, error } = await supabase.functions.invoke('delete-user');
        if (error) {
          const cuerpo = await cuerpoDeError(error);
          if (cuerpo?.solicitud_recibida === true) {
            const motivos = Array.isArray(cuerpo.motivos) ? (cuerpo.motivos as MotivoBorrado[]) : [];
            throw new BorradoPendiente(
              typeof cuerpo.error === 'string'
                ? cuerpo.error
                : 'Registramos tu solicitud de borrado. Primero hay que liquidar lo que quedó pendiente.',
              motivos,
            );
          }
        }
        if (error || data?.ok !== true) {
          throw new Error('No pudimos eliminar tu cuenta. Intentá de nuevo o escribinos a soporte.');
        }
        await supabase.auth.signOut({scope:'local'});
        version.current++;
        cargaPerfil.current = null;
        await cancelarTodosRecordatorios();
        await AsyncStorage.multiRemove([DEMO_KEY,PENDING_KEY]);
        aplicarPerfil(null);
      },

      // Solo a quien de verdad aceptó una versión anterior. Un invitado del modo
      // demo nunca aceptó nada: pedirle que reacepte no tendría sentido.
      politicaDesactualizada:
        !!profile && !profile.id.startsWith("demo") && profile.politica_version !== POLITICA_VERSION,

      async aceptarPolitica() {
        if (!profile) return;
        const cambios = {
          politica_version: POLITICA_VERSION,
          politica_aceptada_at: new Date().toISOString(),
        };
        if (!supabaseConfigurado) {
          const actualizado = { ...profile, ...cambios };
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(actualizado));
          aplicarPerfil(actualizado);
          return;
        }
        const actual = version.current;
        const { error } = await supabase.from('profiles').update(cambios as never).eq('id', profile.id);
        if (error) throw new Error('No pudimos registrar tu aceptación. Probá de nuevo.');
        if (actual === version.current && perfilActual.current?.id === profile.id) {
          aplicarPerfil({ ...profile, ...cambios });
        }
      },

      async solicitudBorrado() {
        if (!supabaseConfigurado || !profile) return null;
        const { data, error } = await supabase
          .from('solicitudes_eliminacion')
          .select('estado, motivos, solicitada_at')
          .eq('usuario_id', profile.id)
          .maybeSingle();
        // No es crítico: si no se puede leer, la pantalla sigue funcionando sin
        // el aviso. Lo que no hacemos es inventar que no hay solicitud.
        if (error || !data) return null;
        const fila = data as { estado: string; motivos: unknown; solicitada_at: string };
        return {
          estado: fila.estado as SolicitudBorrado['estado'],
          motivos: Array.isArray(fila.motivos) ? (fila.motivos as MotivoBorrado[]) : [],
          solicitada_at: fila.solicitada_at,
        };
      },

      async updateProfile(cambios) {
        if (!profile) return;
        const actual = version.current;
        const actualizado = { ...profile, ...cambios };
        if (!supabaseConfigurado) {
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(actualizado));
          if (actual === version.current && perfilActual.current?.id === profile.id) aplicarPerfil(actualizado);
          return;
        }
        const guardados = { ...cambios };
        if ('avatar_url' in guardados) guardados.avatar_url = await subirImagen(guardados.avatar_url,profile.id);
        if (actual !== version.current) throw new Error('La sesión cambió. Volvé a entrar.');
        const { error } = await supabase
          .from('profiles')
          .update(guardados as never)
          .eq('id', profile.id);
        if (error) throw new Error(traducirError(error.message));
        if (actual === version.current && perfilActual.current?.id === profile.id) aplicarPerfil({...profile,...guardados});
      },

      async refrescarPerfil() {
        if (!supabaseConfigurado || !profile) return;
        const actual = version.current;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', profile.id).maybeSingle();
        if (error || !data) return; // no es crítico: el perfil viejo sigue sirviendo
        // Si mientras tanto se cambió de cuenta, esta lectura ya no corresponde.
        if (actual === version.current && perfilActual.current?.id === profile.id) aplicarPerfil(data as Profile);
      },
    }),
    [profile, loading, aplicarPerfil, cargarPerfil],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

// Mensajes de error de Supabase traducidos a algo amigable en español
function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos, parce.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Ese correo ya está registrado. Entrá con tu cuenta.';
  // Cuota de correos agotada: el SMTP que trae Supabase por defecto manda muy
  // pocos por hora. No es que el usuario esté apurado, es que no se puede enviar
  // el correo ahora — mezclarlo con el mensaje de "esperá un minuto" despista.
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit'))
    return 'No pudimos enviarte el correo de confirmación en este momento. Probá más tarde o escribinos.';
  // Límite de tasa de Supabase Auth (registro/logins muy seguidos)
  if (
    m.includes('for security purposes') ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    (m.includes('after') && m.includes('second'))
  )
    return 'Muchos intentos seguidos. Esperá un minuto y probá de nuevo, parce.';
  if (m.includes('confirm') && m.includes('email'))
    return 'Confirmá tu correo con el enlace que te enviamos y luego entrá.';
  if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email')) return 'Revisá el correo, parece inválido.';
  return msg;
}
