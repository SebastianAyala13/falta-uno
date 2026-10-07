import { Alert } from '@/lib/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import AmenidadPicker from '@/components/AmenidadPicker';
import { BackButton } from '@/components/BackButton';
import Chip from '@/components/Chip';
import DateTimeField from '@/components/DateTimeField';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import UbicacionPicker, { type Ubicacion } from '@/components/UbicacionPicker';
import {
  CORREO_SOPORTE,
  DURACIONES_TURNO,
  FORMATOS,
  LEGAL_CANCHA_VERSION,
  URL_MANDATO_RECAUDO,
  URL_TERMINOS_MARKETPLACE,
  ZONAS,
  type Formato,
} from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { crearEstablecimiento, genRefEstablecimiento, subirFotoCancha } from '@/lib/canchas';
import { haptics } from '@/lib/haptics';
import { elegirImagen } from '@/lib/images';
import { useTheme } from '@/lib/theme';
import { useGuardInvitado } from '@/lib/useGuardInvitado';
import type { Amenidades } from '@/types/database';

const CIUDADES = ['Pereira', 'Cali', 'Medellín', 'Bogotá', 'Manizales', 'Armenia'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TOTAL_PASOS = 8;

const TITULOS = [
  '¿Dónde está tu cancha?',
  '¿Cuántas canchas tenés?',
  'Contanos de cada cancha',
  'Fotos de las canchas',
  '¿Ya tenés turnos vendidos?',
  'Servicios del establecimiento',
  'Horarios del establecimiento',
  'Contacto y confirmación',
];

interface CanchaForm {
  nombre: string;
  formato: Formato;
  precio: string;
  duracion: number;
  fotos: string[];
}

interface HorarioDia {
  abierto: boolean;
  apertura: string;
  cierre: string;
}

const nuevaCancha = (i: number): CanchaForm => ({
  nombre: `Cancha ${i + 1}`,
  formato: '5v5',
  precio: '',
  duracion: 60,
  fotos: [],
});

/** Wizard de onboarding: registra un establecimiento con N canchas en 8 pasos. */
export default function RegistrarCancha() {
  const router = useRouter();
  const { refrescarPerfil } = useAuth();
  const c = useTheme();
  const guardInvitado = useGuardInvitado();
  const scrollRef = useRef<ScrollView>(null);

  const [paso, setPaso] = useState(1);
  const [ciudad, setCiudad] = useState('Pereira');
  const [zona, setZona] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion>({ lat: null, lng: null, direccion: '' });
  const [cantidad, setCantidad] = useState(1);
  const [canchas, setCanchas] = useState<CanchaForm[]>([nuevaCancha(0)]);
  const [amenidades, setAmenidades] = useState<Amenidades>({});
  const [horarios, setHorarios] = useState<HorarioDia[]>(
    DIAS.map((_, i) => ({ abierto: i !== 0, apertura: '08:00', cierre: '23:00' })),
  );
  const [telefono, setTelefono] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [yaTienePartidos, setYaTienePartidos] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);

  const setCancha = (i: number, cambios: Partial<CanchaForm>) =>
    setCanchas((prev) => prev.map((cancha, j) => (j === i ? { ...cancha, ...cambios } : cancha)));

  const setHorario = (dia: number, cambios: Partial<HorarioDia>) =>
    setHorarios((prev) => prev.map((h, j) => (j === dia ? { ...h, ...cambios } : h)));

  const cambiarCantidad = (delta: number) => {
    const n = Math.min(10, Math.max(1, cantidad + delta));
    setCantidad(n);
    setCanchas((prev) => {
      if (n > prev.length) {
        const extra = Array.from({ length: n - prev.length }, (_, k) => nuevaCancha(prev.length + k));
        return [...prev, ...extra];
      }
      return prev.slice(0, n);
    });
  };

  const agregarFoto = async (i: number) => {
    haptics.tap();
    const uri = await elegirImagen([16, 9]);
    if (!uri) return;
    setSubiendo(i);
    try {
      const url = await subirFotoCancha(uri);
      setCanchas((prev) => prev.map((cancha, j) => (j === i ? { ...cancha, fotos: [...cancha.fotos, url] } : cancha)));
    } catch (e) {
      Alert.alert('Ups', e instanceof Error ? e.message : 'No pudimos subir la foto. Probá de nuevo.');
    } finally {
      setSubiendo(null);
    }
  };

  const quitarFoto = (i: number, url: string) => {
    haptics.tap();
    setCanchas((prev) => prev.map((cancha, j) => (j === i ? { ...cancha, fotos: cancha.fotos.filter((f) => f !== url) } : cancha)));
  };

  const validarPaso = (): string | null => {
    switch (paso) {
      case 1:
        if (!ubicacion.direccion.trim()) return 'Ubicá tu cancha en el mapa o escribí la dirección.';
        if (!zona) return 'Elegí la zona donde queda tu establecimiento.';
        return null;
      case 3: {
        const falta = canchas.findIndex((cancha) => !((parseInt(cancha.precio, 10) || 0) > 0));
        if (falta >= 0) return `Poné el precio por turno de ${canchas[falta].nombre.trim() || `la cancha ${falta + 1}`}.`;
        return null;
      }
      case 5:
        return yaTienePartidos === null ? 'Contanos si ya tenés turnos vendidos por fuera de la app.' : null;
      case 8:
        return acepta ? null : 'Para crear tu cancha tenés que aceptar el mandato de recaudo y los Términos.';
      default:
        return null;
    }
  };

  const arriba = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  const siguiente = () => {
    const err = validarPaso();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPaso((p) => Math.min(TOTAL_PASOS, p + 1));
    arriba();
  };

  const atras = () => {
    setError(null);
    setPaso((p) => Math.max(1, p - 1));
    arriba();
  };

  // Igual que al reservar: la RPC es idempotente por referencia, así que un
  // reintento con la misma devuelve el establecimiento ya creado en vez de
  // cargarlo dos veces. Por eso vive fuera de la función y no se regenera.
  const referenciaAlta = useRef<string | null>(null);

  const crear = async () => {
    if (guardInvitado('Creá una cuenta para registrar tu cancha.')) return;
    const err = validarPaso();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const horariosActivos = horarios
        .map((h, dia) => ({ dia_semana: dia, ...h }))
        .filter((h) => h.abierto)
        .map((h) => ({ dia_semana: h.dia_semana, hora_apertura: h.apertura, hora_cierre: h.cierre }));
      if (!referenciaAlta.current) referenciaAlta.current = genRefEstablecimiento();
      await crearEstablecimiento({
        direccion: ubicacion.direccion,
        zona: zona!,
        ciudad,
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        telefono,
        amenidades,
        canchas: canchas.map((cancha) => ({
          nombre: cancha.nombre.trim(),
          formato: cancha.formato,
          precio: parseInt(cancha.precio, 10) || 0,
          duracion: cancha.duracion,
          fotos: cancha.fotos,
        })),
        horarios: horariosActivos,
        legal_version: LEGAL_CANCHA_VERSION,
        legal_aceptado_at: new Date().toISOString(),
      }, referenciaAlta.current);
      // El rol `cancha` lo agrega la propia RPC dentro de su transacción: un
      // trigger impide que la app se cambie los roles por su cuenta. Acá solo
      // releemos el perfil para que la navegación ya lo vea como dueño.
      await refrescarPerfil();
      // Antes, decir "sí tengo turnos vendidos" llevaba a la agenda, como si ahí
      // se pudieran cargar. La agenda es de solo lectura: no existe forma de
      // bloquear un turno comprometido por fuera de la app. Mandar a una pantalla
      // que no resuelve el problema es peor que no ofrecerlo.
      router.replace('/cancha/panel');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear tu cancha.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Screen edges={['top']}>
      {/* Header: back + barra de progreso */}
      <View className="flex-row items-center gap-3 px-6 pb-3 pt-2">
        <BackButton onPress={() => (paso > 1 ? atras() : router.back())} />
        <View className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${(paso / TOTAL_PASOS) * 100}%`, backgroundColor: c.primary }}
          />
        </View>
        <Text className="font-body-semibold text-xs text-muted">
          {paso}/{TOTAL_PASOS}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn key={paso} delay={40}>
            <Text
              className="mb-4 font-display text-3xl uppercase text-cream"
              style={{ lineHeight: 40, paddingTop: 2 }}>
              {TITULOS[paso - 1]}
            </Text>

            {/* Paso 1 — Ubicación */}
            {paso === 1 ? (
              <View>
                <Text className="mb-2 font-body-semibold text-sm text-cream">Ciudad</Text>
                <View className="mb-4 flex-row flex-wrap">
                  {CIUDADES.map((ciu) => (
                    <Chip key={ciu} label={ciu} selected={ciudad === ciu} onPress={() => setCiudad(ciu)} />
                  ))}
                </View>

                <UbicacionPicker value={ubicacion} ciudad={ciudad} onChange={setUbicacion} />

                <Text className="mb-2 mt-2 font-body-semibold text-sm text-cream">Zona</Text>
                <View className="flex-row flex-wrap">
                  {ZONAS.map((z) => (
                    <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Paso 2 — Cantidad de canchas */}
            {paso === 2 ? (
              <View className="items-center">
                <View className="my-6 flex-row items-center justify-center gap-6">
                  <Pressable
                    onPress={() => { haptics.select(); cambiarCantidad(-1); }}
                    disabled={cantidad <= 1}
                    hitSlop={8}
                    className="h-16 w-16 items-center justify-center rounded-md border border-border bg-card"
                    style={{ opacity: cantidad <= 1 ? 0.4 : 1 }}>
                    <Ionicons name="remove" size={28} color={c.cream} />
                  </Pressable>
                  <Text
                    className="font-display text-6xl text-primary"
                    style={{ lineHeight: 72, paddingTop: 4, minWidth: 80, textAlign: 'center' }}>
                    {cantidad}
                  </Text>
                  <Pressable
                    onPress={() => { haptics.select(); cambiarCantidad(1); }}
                    disabled={cantidad >= 10}
                    hitSlop={8}
                    className="h-16 w-16 items-center justify-center rounded-md border border-border bg-card"
                    style={{ opacity: cantidad >= 10 ? 0.4 : 1 }}>
                    <Ionicons name="add" size={28} color={c.cream} />
                  </Pressable>
                </View>
                <Text className="text-center font-body text-sm text-muted">
                  Podés registrar todas las canchas de tu establecimiento.
                </Text>
              </View>
            ) : null}

            {/* Paso 3 — Detalle de cada cancha */}
            {paso === 3
              ? canchas.map((cancha, i) => (
                  <View key={i} className="mb-4 rounded-md border border-border p-4">
                    <Field
                      label={`Cancha ${i + 1}`}
                      icon="business-outline"
                      placeholder={`Cancha ${i + 1}`}
                      value={cancha.nombre}
                      onChangeText={(t) => setCancha(i, { nombre: t })}
                      autoCapitalize="words"
                    />
                    <Text className="mb-2 font-body-semibold text-sm text-cream">Formato</Text>
                    <View className="mb-2 flex-row flex-wrap">
                      {FORMATOS.map((f) => (
                        <Chip key={f} label={f} selected={cancha.formato === f} onPress={() => setCancha(i, { formato: f })} />
                      ))}
                    </View>
                    <Field
                      label="Precio"
                      icon="cash-outline"
                      placeholder="80000"
                      value={cancha.precio}
                      onChangeText={(t) => setCancha(i, { precio: t.replace(/[^0-9]/g, '') })}
                      keyboardType="numeric"
                      hint="Precio por turno"
                    />
                    <Text className="mb-2 font-body-semibold text-sm text-cream">Duración del turno</Text>
                    <View className="flex-row flex-wrap">
                      {DURACIONES_TURNO.map((d) => (
                        <Chip
                          key={d}
                          label={`${d} min`}
                          selected={cancha.duracion === d}
                          onPress={() => setCancha(i, { duracion: d })}
                        />
                      ))}
                    </View>
                  </View>
                ))
              : null}

            {/* Paso 4 — Fotos */}
            {paso === 4 ? (
              <View>
                <Text className="mb-4 font-body text-sm text-muted">
                  Las canchas con fotos reciben más reservas. Podés agregarlas después si querés.
                </Text>
                {canchas.map((cancha, i) => (
                  <View key={i} className="mb-4 rounded-md border border-border p-4">
                    <Text className="mb-3 font-body-bold text-base text-cream">
                      {cancha.nombre.trim() || `Cancha ${i + 1}`}
                    </Text>
                    {cancha.fotos.length ? (
                      <View className="mb-3 flex-row flex-wrap gap-2">
                        {cancha.fotos.map((url) => (
                          <View key={url}>
                            <Image
                              source={{ uri: url }}
                              style={{ width: 104, height: 58, borderRadius: 12 }}
                              contentFit="cover"
                            />
                            <Pressable
                              onPress={() => quitarFoto(i, url)}
                              hitSlop={8}
                              className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full"
                              style={{ backgroundColor: c.danger }}>
                              <Ionicons name="close" size={14} color={c.cream} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => agregarFoto(i)}
                      disabled={subiendo !== null}
                      className="h-14 flex-row items-center justify-center gap-2 rounded-md border border-border bg-card active:border-primary/50"
                      style={{ opacity: subiendo !== null && subiendo !== i ? 0.5 : 1 }}>
                      {subiendo === i ? (
                        <>
                          <ActivityIndicator size="small" color={c.primary} />
                          <Text className="font-body-semibold text-sm text-muted">Subiendo la foto…</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="image-outline" size={20} color={c.primary} />
                          <Text className="font-body-semibold text-sm text-cream">Agregar foto</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Paso 5 — ¿Ya tenés partidos? */}
            {paso === 5 ? (
              <View>
                <Text className="mb-4 font-body text-sm text-muted">
                  Necesitamos saber si ya comprometiste turnos por fuera de la app, para no venderlos de nuevo.
                </Text>
                <View className="flex-row gap-3">
                  {[
                    { v: true, label: 'Sí', icon: 'calendar' as const, hint: 'Ya tengo turnos vendidos' },
                    { v: false, label: 'No', icon: 'calendar-clear-outline' as const, hint: 'Arranco de cero' },
                  ].map((op) => {
                    const activo = yaTienePartidos === op.v;
                    return (
                      <Pressable
                        key={op.label}
                        onPress={() => { haptics.select(); setYaTienePartidos(op.v); }}
                        className="flex-1 items-center rounded-md border p-5"
                        style={{
                          backgroundColor: activo ? c.primary + '1A' : c.card,
                          borderColor: activo ? c.primary : c.border,
                        }}>
                        <Ionicons name={op.icon} size={28} color={activo ? c.primary : c.muted} />
                        <Text
                          className="mt-2 font-display text-2xl uppercase"
                          style={{ lineHeight: 30, paddingTop: 2, color: activo ? c.primary : c.cream }}>
                          {op.label}
                        </Text>
                        <Text className="mt-1 text-center font-body text-xs text-muted">{op.hint}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {yaTienePartidos === true ? (
                  <View
                    className="mt-4 flex-row items-start gap-2 rounded-sm border px-3 py-2.5"
                    style={{ borderColor: c.warning, backgroundColor: c.warning + '14' }}>
                    <Ionicons name="alert-circle-outline" size={16} color={c.warning} style={{ marginTop: 1 }} />
                    <Text className="flex-1 font-body text-sm text-cream">
                      Todavía no podemos bloquear esos turnos desde la app: si publicás esas horas, un jugador puede
                      reservar encima. Escribinos a {CORREO_SOPORTE} antes de abrir tu cancha a los jugadores.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Paso 6 — Amenidades */}
            {paso === 6 ? (
              <View>
                <Text className="mb-2 font-body-semibold text-sm text-cream">¿Qué hay en tu establecimiento?</Text>
                <AmenidadPicker value={amenidades} onChange={setAmenidades} />
              </View>
            ) : null}

            {/* Paso 7 — Horarios */}
            {paso === 7 ? (
              <View>
                <Text className="mb-4 font-body text-sm text-muted">
                  Contanos qué días abrís y en qué horario. Con esto armamos los turnos reservables.
                </Text>
                {DIAS.map((d, i) => {
                  const h = horarios[i];
                  return (
                    <View key={d} className="mb-3 rounded-md border border-border bg-card p-3.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-body-bold text-base text-cream">{d}</Text>
                        <Switch
                          value={h.abierto}
                          onValueChange={(v) => setHorario(i, { abierto: v })}
                          trackColor={{ false: c.border, true: c.primary }}
                          thumbColor={c.cream}
                        />
                      </View>
                      {h.abierto ? (
                        <View className="mt-2 flex-row gap-3">
                          <View className="flex-1">
                            <DateTimeField
                              label="Abre"
                              mode="time"
                              value={h.apertura}
                              onChange={(v) => setHorario(i, { apertura: v })}
                            />
                          </View>
                          <View className="flex-1">
                            <DateTimeField
                              label="Cierra"
                              mode="time"
                              value={h.cierre}
                              onChange={(v) => setHorario(i, { cierre: v })}
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Paso 8 — Contacto + legal */}
            {paso === 8 ? (
              <View>
                <Field
                  label="WhatsApp / teléfono"
                  icon="call-outline"
                  placeholder="+57 3xx xxx xxxx"
                  value={telefono}
                  onChangeText={setTelefono}
                  keyboardType="phone-pad"
                  hint="Para coordinar con los jugadores si hace falta."
                />
                {/* Acá se elegía una política de cancelación, pero no había columna
                    donde guardarla ni cálculo que la aplicara: el dueño creía que la
                    app la iba a hacer cumplir. Hasta que exista, se dice cómo es. */}
                <Text className="mb-4 font-body text-xs text-muted">
                  La política de cancelación la acordás vos con los jugadores: por ahora la app no la guarda ni la
                  aplica.
                </Text>

                <Pressable
                  onPress={() => { haptics.light(); setAcepta((v) => !v); }}
                  className="mb-2 flex-row items-start gap-3 rounded-md border border-border bg-card p-3.5 active:border-primary/50">
                  <View
                    className="mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2"
                    style={{
                      borderColor: acepta ? c.primary : c.border,
                      backgroundColor: acepta ? c.primary : 'transparent',
                    }}>
                    {acepta ? <Ionicons name="checkmark" size={16} color={c.ink} /> : null}
                  </View>
                  <Text className="flex-1 font-body text-sm text-cream">
                    Acepto el{' '}
                    <Text className="text-primary" onPress={() => Linking.openURL(URL_MANDATO_RECAUDO).catch(() => {})}>
                      mandato de recaudo
                    </Text>{' '}
                    y los{' '}
                    <Text
                      className="text-primary"
                      onPress={() => Linking.openURL(URL_TERMINOS_MARKETPLACE).catch(() => {})}>
                      Términos del marketplace
                    </Text>{' '}
                    de Falta Uno para recibir reservas y pagos.
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </FadeIn>

          <ErrorBanner message={error} className="mb-4 mt-2" />

          {/* Botonera */}
          <View className="mt-4 flex-row gap-3">
            {paso > 1 ? (
              <View className="flex-1">
                <GlowButton label="Atrás" variant="dark" icon="arrow-back" onPress={atras} disabled={guardando} />
              </View>
            ) : null}
            <View style={{ flex: 2 }}>
              {paso < TOTAL_PASOS ? (
                <GlowButton label="Siguiente" variant="primary" icon="arrow-forward" onPress={siguiente} />
              ) : (
                <GlowButton
                  label={cantidad > 1 ? 'Crear canchas' : 'Crear cancha'}
                  variant="accent"
                  icon="rocket"
                  loading={guardando}
                  disabled={guardando}
                  onPress={crear}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
