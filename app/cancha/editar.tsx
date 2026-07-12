import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import AmenidadPicker from '@/components/AmenidadPicker';
import { ScreenHeader } from '@/components/BackButton';
import Chip from '@/components/Chip';
import DateTimeField from '@/components/DateTimeField';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import {
  FORMATOS,
  LEGAL_CANCHA_VERSION,
  URL_MANDATO_RECAUDO,
  URL_TERMINOS_MARKETPLACE,
  ZONAS,
  type Formato,
} from '@/constants/config';
import { useAuth } from '@/lib/auth';
import {
  actualizarCancha,
  crearCancha,
  getDisponibilidad,
  misCanchas,
  setDisponibilidad,
  subirFotoCancha,
} from '@/lib/canchas';
import { elegirImagen } from '@/lib/images';
import { useTheme } from '@/lib/theme';
import type { Amenidades, Cancha } from '@/types/database';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface DiaConfig {
  abierto: boolean;
  apertura: string; // 'HH:mm'
  cierre: string; // 'HH:mm'
  precio: string; // texto del input numérico
}

const diaInicial = (): DiaConfig => ({ abierto: false, apertura: '08:00', cierre: '22:00', precio: '' });

export default function EditarCancha() {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const c = useTheme();

  const [cargando, setCargando] = useState(true);
  const [cancha, setCancha] = useState<Cancha | null>(null);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [zona, setZona] = useState<string | null>(null);
  const [telefono, setTelefono] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [formatos, setFormatos] = useState<Formato[]>([]);
  const [amenidades, setAmenidades] = useState<Amenidades>({});
  const [fotos, setFotos] = useState<string[]>([]);
  const [dias, setDias] = useState<DiaConfig[]>(() => DIAS.map(() => diaInicial()));
  const [acepta, setAcepta] = useState(false);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esEdicion = !!cancha;

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      if (!profile?.id) {
        setCargando(false);
        return;
      }
      try {
        const canchas = await misCanchas(profile.id);
        if (!activo) return;
        const cch = canchas[0];
        if (cch) {
          setCancha(cch);
          setNombre(cch.nombre);
          setDireccion(cch.direccion);
          setZona(cch.zona);
          setTelefono(cch.telefono ?? '');
          setDescripcion(cch.descripcion ?? '');
          setFormatos(cch.formatos ?? []);
          setAmenidades(cch.amenidades ?? {});
          setFotos(cch.fotos ?? []);
          const franjas = await getDisponibilidad(cch.id);
          if (!activo) return;
          setDias(() => {
            const sig = DIAS.map(() => diaInicial());
            for (const f of franjas) {
              if (f.dia_semana >= 0 && f.dia_semana <= 6) {
                sig[f.dia_semana] = {
                  abierto: true,
                  apertura: f.hora_apertura.slice(0, 5),
                  cierre: f.hora_cierre.slice(0, 5),
                  precio: String(f.precio),
                };
              }
            }
            return sig;
          });
        }
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [profile?.id]);

  const setDia = (idx: number, cambios: Partial<DiaConfig>) =>
    setDias((prev) => prev.map((d, i) => (i === idx ? { ...d, ...cambios } : d)));

  const toggleFormato = (f: Formato) =>
    setFormatos((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const agregarFoto = async () => {
    const uri = await elegirImagen([16, 9]);
    if (!uri) return;
    setError(null);
    setSubiendoFoto(true);
    try {
      const url = await subirFotoCancha(uri);
      setFotos((prev) => [...prev, url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos subir la foto. Probá de nuevo.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = (idx: number) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    setError(null);
    if (!profile) {
      setError('Tenés que iniciar sesión para registrar tu cancha.');
      return;
    }
    if (!nombre.trim() || !direccion.trim()) {
      setError('Completá el nombre y la dirección de la cancha.');
      return;
    }
    if (!zona) {
      setError('Elegí la zona donde queda tu cancha.');
      return;
    }
    if (formatos.length === 0) {
      setError('Elegí al menos un formato de juego (5v5, 7v7 u 11v11).');
      return;
    }
    if (!esEdicion && !acepta) {
      setError('Para publicar tu cancha tenés que aceptar el mandato de recaudo y los Términos del marketplace.');
      return;
    }

    const franjas = dias
      .map((d, dia_semana) => ({ d, dia_semana }))
      .filter(({ d }) => d.abierto)
      .map(({ d, dia_semana }) => ({
        dia_semana,
        hora_apertura: d.apertura,
        hora_cierre: d.cierre,
        duracion_min: 60,
        precio: Number(d.precio) || 0,
      }));

    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        zona,
        telefono: telefono.trim() || null,
        descripcion: descripcion.trim() || null,
        formatos,
        amenidades,
        fotos,
        foto_portada: fotos[0] ?? null,
      };
      if (cancha) {
        await actualizarCancha(cancha.id, datos);
        await setDisponibilidad(cancha.id, franjas);
        router.back();
      } else {
        const nueva = await crearCancha(profile.id, {
          ...datos,
          legal_version: LEGAL_CANCHA_VERSION,
          legal_aceptado_at: new Date().toISOString(),
        });
        await setDisponibilidad(nueva.id, franjas);
        if (!profile.roles?.includes('cancha')) {
          await updateProfile({ roles: Array.from(new Set([...(profile.roles ?? ['jugador']), 'cancha'])) });
        }
        router.replace('/cancha/panel');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar la cancha. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <Screen edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={esEdicion ? 'Mi cancha' : 'Registrar cancha'} className="px-6 pb-2 pt-2" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn delay={60}>
            <Text className="mb-6 font-body text-sm text-muted">
              {esEdicion
                ? 'Actualizá los datos, fotos y horarios de tu cancha. Los cambios se ven al toque.'
                : 'Contanos de tu cancha: fotos, horarios y precios. Así los jugadores la encuentran y reservan.'}
            </Text>

            <Field
              label="Nombre de la cancha"
              icon="business-outline"
              placeholder="Ej: La Bombonera de Cuba"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
            />
            <Field
              label="Dirección"
              icon="location-outline"
              placeholder="Ej: Cra 25 #70-15"
              value={direccion}
              onChangeText={setDireccion}
              autoCapitalize="words"
            />

            <Text className="mb-2 font-body-semibold text-sm text-cream">Zona</Text>
            <View className="mb-4 flex-row flex-wrap">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
              ))}
            </View>

            <Field
              label="Teléfono"
              icon="call-outline"
              placeholder="+57 3xx xxx xxxx"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />
            <Field
              label="Descripción"
              icon="chatbubble-ellipses-outline"
              placeholder="Contá qué hace especial a tu cancha…"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
            />
          </FadeIn>

          <FadeIn delay={140}>
            <Text className="mb-2 font-body-semibold text-sm text-cream">Formatos</Text>
            <View className="mb-4 flex-row flex-wrap">
              {FORMATOS.map((f) => (
                <Chip key={f} label={f} selected={formatos.includes(f)} onPress={() => toggleFormato(f)} />
              ))}
            </View>

            <Text className="mb-2 font-body-semibold text-sm text-cream">Amenidades</Text>
            <View className="mb-4">
              <AmenidadPicker value={amenidades} onChange={setAmenidades} />
            </View>

            <Text className="mb-2 font-body-semibold text-sm text-cream">Fotos</Text>
            {fotos.length ? (
              <View className="mb-3 flex-row flex-wrap gap-2">
                {fotos.map((url, i) => (
                  <View key={`${url}-${i}`}>
                    <Image
                      source={{ uri: url }}
                      style={{ width: 112, height: 63, borderRadius: 12 }}
                      contentFit="cover"
                    />
                    {i === 0 ? (
                      <View className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5">
                        <Text className="font-body-semibold text-[10px] text-cream">Portada</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => quitarFoto(i)}
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
              onPress={agregarFoto}
              disabled={subiendoFoto}
              className="mb-4 h-14 flex-row items-center justify-center rounded-2xl border border-border bg-card active:border-primary/50">
              {subiendoFoto ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={20} color={c.primary} />
                  <Text className="ml-2 font-body-semibold text-sm text-cream">Agregar foto</Text>
                </>
              )}
            </Pressable>
            <Text className="mb-4 font-body text-xs text-muted">La primera foto es la portada de tu cancha.</Text>
          </FadeIn>

          <FadeIn delay={220}>
            <Text className="mb-2 font-body-semibold text-sm text-cream">Horarios y precios</Text>
            <Text className="mb-3 font-body text-xs text-muted">
              Marcá los días que abrís. Los turnos duran 60 minutos.
            </Text>

            {DIAS.map((nombreDia, idx) => {
              const d = dias[idx];
              return (
                <View key={nombreDia} className="mb-3 rounded-2xl border border-border bg-card p-3.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-body-bold text-sm text-cream">{nombreDia}</Text>
                    <Pressable
                      onPress={() => setDia(idx, { abierto: !d.abierto })}
                      hitSlop={8}
                      className="flex-row items-center rounded-full border px-3 py-1.5"
                      style={{
                        borderColor: d.abierto ? c.primary : c.border,
                        backgroundColor: d.abierto ? c.primary + '1A' : 'transparent',
                      }}>
                      <Ionicons
                        name={d.abierto ? 'checkmark-circle' : 'close-circle-outline'}
                        size={16}
                        color={d.abierto ? c.primary : c.muted}
                      />
                      <Text
                        className="ml-1.5 font-body-semibold text-xs"
                        style={{ color: d.abierto ? c.primary : c.muted }}>
                        {d.abierto ? 'Abierto' : 'Cerrado'}
                      </Text>
                    </Pressable>
                  </View>

                  {d.abierto ? (
                    <View className="mt-3">
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <DateTimeField
                            label="Abre"
                            mode="time"
                            value={d.apertura}
                            onChange={(v) => setDia(idx, { apertura: v })}
                          />
                        </View>
                        <View className="flex-1">
                          <DateTimeField
                            label="Cierra"
                            mode="time"
                            value={d.cierre}
                            onChange={(v) => setDia(idx, { cierre: v })}
                          />
                        </View>
                      </View>
                      <Field
                        label="Precio por turno (60 min)"
                        icon="cash-outline"
                        placeholder="Ej: 80000"
                        value={d.precio}
                        onChangeText={(v) => setDia(idx, { precio: v })}
                        keyboardType="numeric"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </FadeIn>

          <FadeIn delay={300}>
            <ErrorBanner message={error} className="mb-4 mt-2" />

            {!esEdicion ? (
              <Pressable
                onPress={() => setAcepta((v) => !v)}
                className="mb-4 mt-2 flex-row items-start gap-3 rounded-2xl border border-border bg-card p-3.5 active:border-primary/50">
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
                  </Text>
                  .
                </Text>
              </Pressable>
            ) : (
              <View className="mt-2" />
            )}

            <GlowButton
              label={esEdicion ? 'Guardar cambios' : 'Publicar cancha'}
              variant="accent"
              icon="save"
              loading={guardando}
              disabled={guardando || subiendoFoto}
              onPress={guardar}
            />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
