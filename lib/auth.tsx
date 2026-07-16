import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { APP, POLITICA_VERSION, type Nivel, type Posicion } from '@/constants/config';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type { Profile } from '@/types/database';

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
  /** Elimina la cuenta y sus datos (requerido por App Store y Play Store). */
  eliminarCuenta: () => Promise<void>;
  updateProfile: (cambios: Partial<Profile>) => Promise<void>;
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

  // Carga inicial de la sesión
  useEffect(() => {
    let activo = true;

    async function init() {
      if (!supabaseConfigurado) {
        // Modo demo: recuperamos perfil guardado localmente (si existe)
        const raw = await AsyncStorage.getItem(DEMO_KEY);
        if (activo) {
          setProfile(raw ? (JSON.parse(raw) as Profile) : null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) await cargarPerfil(data.session);
      if (activo) setLoading(false);

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) cargarPerfil(session);
        else setProfile(null);
      });
    }

    init();
    return () => {
      activo = false;
    };
  }, []);

  async function cargarPerfil(session: Session) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
      return;
    }
    // No hay perfil aún: si quedó uno pendiente del registro (caso confirmación
    // de email activada), lo creamos ahora que ya hay sesión válida.
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw) {
      const pendiente = JSON.parse(raw) as Record<string, unknown>;
      pendiente.id = session.user.id;
      await supabase.from('profiles').insert(pendiente as never);
      await AsyncStorage.removeItem(PENDING_KEY);
      const { data: creado } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (creado) setProfile(creado as Profile);
    }
  }

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
          setProfile(p);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(traducirError(error.message));
      },

      async resetPassword(email) {
        if (!supabaseConfigurado) return; // demo: no-op (la UI muestra el mensaje)
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: 'faltauno://reset',
        });
        if (error) throw new Error(traducirError(error.message));
      },

      async signUp(datos) {
        if (!supabaseConfigurado) {
          const p = perfilDemo(datos);
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(p));
          setProfile(p);
          return { needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email: datos.email,
          password: datos.password,
        });
        if (error) throw new Error(traducirError(error.message));

        // cast: el cliente tipado de supabase-js degrada el insert a `never`
        // con tipos de Database escritos a mano; el objeto es correcto en runtime.
        const nuevo = {
          id: data.user?.id,
          nombre: datos.nombre,
          email: datos.email,
          ciudad: datos.ciudad,
          posicion: datos.posicion,
          nivel: datos.nivel,
          celular: datos.celular,
          avatar_url: null,
          roles: datos.roles ?? ['jugador'],
          // Prueba de autorización de tratamiento de datos (Ley 1581/2012)
          politica_version: POLITICA_VERSION,
          politica_aceptada_at: new Date().toISOString(),
        };

        if (data.session) {
          // Sesión inmediata (confirmación de email desactivada): creamos el perfil ya.
          const { error: perr } = await supabase.from('profiles').insert(nuevo as never);
          if (perr) throw new Error(traducirError(perr.message));
          await cargarPerfil(data.session);
          return { needsConfirmation: false };
        }

        // Confirmación pendiente: guardamos el perfil para crearlo al primer login.
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(nuevo));
        return { needsConfirmation: true };
      },

      async signInAsGuest() {
        // Invitado arranca en cero: nada de estadísticas ficticias que parezcan reales.
        const p = perfilDemo({ nombre: 'Invitado', email: 'invitado@faltauno.app', partidos_jugados: 0, no_shows: 0, rating: 0 });
        await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(p));
        setProfile(p);
      },

      async signOut() {
        if (supabaseConfigurado) await supabase.auth.signOut();
        await AsyncStorage.removeItem(DEMO_KEY);
        setProfile(null);
      },

      async eliminarCuenta() {
        if (!supabaseConfigurado) {
          // Modo demo: borramos los datos locales del usuario
          await AsyncStorage.multiRemove([DEMO_KEY, PENDING_KEY]);
          setProfile(null);
          return;
        }
        // La eliminación real (perfil + usuario de Auth) la hace la Edge Function
        // `delete-user` con service_role (el cliente no tiene policy de DELETE).
        // Si falla, NO cerramos sesión y propagamos el error para avisar al usuario.
        const { error } = await supabase.functions.invoke('delete-user');
        if (error) {
          throw new Error('No pudimos eliminar tu cuenta. Intentá de nuevo o escribinos a soporte.');
        }
        await supabase.auth.signOut();
        await AsyncStorage.removeItem(DEMO_KEY);
        setProfile(null);
      },

      async updateProfile(cambios) {
        if (!profile) return;
        const actualizado = { ...profile, ...cambios };
        if (!supabaseConfigurado) {
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(actualizado));
          setProfile(actualizado);
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .update(cambios as never)
          .eq('id', profile.id);
        if (error) throw new Error(traducirError(error.message));
        setProfile(actualizado);
      },
    }),
    [profile, loading],
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
  // Límite de tasa de Supabase Auth (registro/emails muy seguidos)
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
