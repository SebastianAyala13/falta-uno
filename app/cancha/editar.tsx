import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import SelectorCancha from '@/components/SelectorCancha';
import { SkeletonBlock } from '@/components/Skeleton';
import {
  DURACIONES_TURNO,
  FORMATOS,
  LEGAL_CANCHA_VERSION,
  URL_MANDATO_RECAUDO,
  URL_TERMINOS_MARKETPLACE,
  ZONAS,
  type Formato,
} from '@/constants/config';
import { Alert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { diaInicial, diasDesdeFranjas, franjasDesdeDias, type DiaConfig } from '@/lib/disponibilidad';
import { huellaFormulario } from '@/lib/formulario-cancha';
import {
  actualizarCancha,
  crearCancha,
  getDisponibilidad,
  setDisponibilidad,
  subirFotoCancha,
} from '@/lib/canchas';
import { haptics } from '@/lib/haptics';
import { elegirImagen } from '@/lib/images';
import { useTheme } from '@/lib/theme';
import { useCanchasDelDueno } from '@/lib/useCanchasDelDueno';
import type { Amenidades, Cancha } from '@/types/database';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function EditarCancha() {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const c = useTheme();
  const { canchas, cancha: canchaActiva, elegir, cargando: cargandoLista } = useCanchasDelDueno();

  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [cancha, setCancha] = useState<Cancha | null>(null);
  /** Huella de los datos tal como se cargaron. `null` mientras no hay cancha. */
  const [huellaCargada, setHuellaCargada] = useState<string | null>(null);

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
    const cch = canchaActiva;
    if (!cch) return;
    let activo = true;
    const cargar = async () => {
      setCancha(cch);
      setNombre(cch.nombre);
      setDireccion(cch.direccion);
      setZona(cch.zona);
      setTelefono(cch.telefono ?? '');
      setDescripcion(cch.descripcion ?? '');
      setFormatos(cch.formatos ?? []);
      setAmenidades(cch.amenidades ?? {});
      setFotos(cch.fotos ?? []);
      setCargandoFranjas(true);
      try {
        const franjas = await getDisponibilidad(cch.id);
        if (!activo) return;
        const diasCargados = diasDesdeFranjas(franjas);
        setDias(diasCargados);
        setHuellaCargada(
          huellaFormulario({
            nombre: cch.nombre,
            direccion: cch.direccion,
            zona: cch.zona,
            telefono: cch.telefono ?? '',
            descripcion: cch.descripcion ?? '',
            formatos: cch.formatos ?? [],
            amenidades: cch.amenidades ?? {},
            fotos: cch.fotos ?? [],
            dias: diasCargados,
          }),
        );
      } finally {
        if (activo) setCargandoFranjas(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [canchaActiva]);

  const cargando = cargandoLista || cargandoFranjas;

  const hayCambiosSinGuardar = useMemo(() => {
    if (huellaCargada === null) return false;
    return (
      huellaFormulario({ nombre, direccion, zona, telefono, descripcion, formatos, amenidades, fotos, dias }) !==
      huellaCargada
    );
  }, [huellaCargada, nombre, direccion, zona, telefono, descripcion, formatos, amenidades, fotos, dias]);

  /**
   * Cambia de cancha, preguntando primero si hay trabajo sin guardar.
   *
   * Cargar otra cancha reemplaza todo el formulario. Hacerlo sin avisar le
   * borraría al dueño los precios que acaba de escribir, y acá se escriben siete
   * días a mano: es trabajo que no quiere repetir.
   */
  const cambiarDeCancha = (id: string) => {
    if (id === cancha?.id) return;
    if (!hayCambiosSinGuardar) {
      elegir(id);
      return;
    }
    Alert.alert(
      'Antes de cambiar de cancha',
      `Tenés cambios sin guardar en ${cancha?.nombre?.trim() || 'esta cancha'}. ¿Descartarlos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => elegir(id) },
      ],
    );
  };

  const setDia = (idx: number, cambios: Partial<DiaConfig>) =>
    setDias((prev) => prev.map((d, i) => (i === idx ? { ...d, ...cambios } : d)));

  const toggleFormato = (f: Formato) =>
    setFormatos((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const agregarFoto = async () => {
    haptics.tap();
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

  const quitarFoto = (idx: number) => {
    haptics.tap();
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  };

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

    const franjas = franjasDesdeDias(dias);

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
        <View className="px-6 pb-2 pt-2">
          <SkeletonBlock height={30} width={'55%'} />
        </View>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={{ marginBottom: 18 }}>
              <SkeletonBlock height={12} width={'35%'} />
              <View style={{ height: 8 }} />
              <SkeletonBlock height={48} radius={12} />
            </View>
          ))}
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
            <SelectorCancha
              canchas={canchas}
              activaId={cancha?.id ?? null}
              onElegir={cambiarDeCancha}
              className="mb-4"
            />
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
                        <Text className="font-body-semibold text-xs text-cream">Portada</Text>
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
              className="mb-4 h-14 flex-row items-center justify-center rounded-md border border-border bg-card active:border-primary/50">
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
              Marcá los días que abrís y cuánto dura cada turno en ese día.
            </Text>

            {DIAS.map((nombreDia, idx) => {
              const d = dias[idx];
              return (
                <View key={nombreDia} className="mb-3 rounded-md border border-border bg-card p-3.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-body-bold text-sm text-cream">{nombreDia}</Text>
                    <Pressable
                      onPress={() => { haptics.select(); setDia(idx, { abierto: !d.abierto }); }}
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
                      <Text className="mb-2 mt-1 font-body-semibold text-sm text-cream">Duración del turno</Text>
                      <View className="mb-1 flex-row flex-wrap">
                        {DURACIONES_TURNO.map((min) => (
                          <Chip
                            key={min}
                            label={`${min} min`}
                            selected={d.duracion === min}
                            onPress={() => setDia(idx, { duracion: min })}
                          />
                        ))}
                      </View>
                      <Field
                        label={`Precio por turno (${d.duracion} min)`}
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
                onPress={() => { haptics.light(); setAcepta((v) => !v); }}
                className="mb-4 mt-2 flex-row items-start gap-3 rounded-md border border-border bg-card p-3.5 active:border-primary/50">
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
