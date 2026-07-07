import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import DateTimeField from '@/components/DateTimeField';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { CUPOS_POR_FORMATO, FORMATOS, NIVELES, ZONAS, type Formato, type Nivel, type Zona } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { listarCanchas } from '@/lib/canchas';
import { elegirImagen } from '@/lib/images';
import { useStore } from '@/lib/store';
import type { Cancha } from '@/types/database';

export default function Crear() {
  const router = useRouter();
  const { profile } = useAuth();
  const crearPartido = useStore((s) => s.crearPartido);

  const [canchasDisponibles, setCanchasDisponibles] = useState<Cancha[]>([]);
  const [canchaSelId, setCanchaSelId] = useState<string | null>(null);
  const [otraCancha, setOtraCancha] = useState(false);

  const [cancha, setCancha] = useState('');
  const [zona, setZona] = useState<Zona | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [formato, setFormato] = useState<Formato>('5v5');
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Canchas registradas: al crear un partido se elige una de las disponibles.
  useEffect(() => {
    listarCanchas().then(setCanchasDisponibles).catch(() => {});
  }, []);

  const elegirCancha = (c: Cancha) => {
    setCanchaSelId(c.id);
    setOtraCancha(false);
    setCancha(c.nombre);
    if ((ZONAS as readonly string[]).includes(c.zona)) setZona(c.zona as Zona);
    if (c.formatos?.[0]) setFormato(c.formatos[0]);
  };

  const agregarFoto = async () => {
    const uri = await elegirImagen([16, 9]);
    if (uri) setFoto(uri);
  };

  const [publicando, setPublicando] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!cancha || !zona || !fecha || !hora || !nivel || !precio) {
      setError('Completá cancha, zona, fecha, hora, nivel y precio.');
      return;
    }
    setPublicando(true);
    try {
      const id = await crearPartido(
        {
          cancha: cancha.trim(),
          zona: zona!,
          fecha: fecha.trim(),
          hora: hora.trim(),
          formato,
          nivel: nivel!,
          precio: parseInt(precio, 10) || 0,
          descripcion: descripcion.trim(),
          foto_url: foto,
        },
        { id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos' },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/partido/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar el partido. Probá de nuevo.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Screen>
      <FadeIn delay={40}>
        <View className="px-6 pb-1 pt-2">
          <Text className="font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>Crear partido</Text>
          <Text className="mt-1 font-body text-sm text-muted">
            Armá el parche y dejá que la gente se cuadre.
          </Text>
        </View>
      </FadeIn>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn delay={100}>
            {/* Foto de la cancha */}
            <Text className="mb-2 font-body-semibold text-sm text-cream">Foto de la cancha</Text>
            <Pressable
              onPress={agregarFoto}
              className="mb-4 h-40 items-center justify-center overflow-hidden rounded-2xl border bg-card"
              style={{ borderColor: Colors.border, borderStyle: foto ? 'solid' : 'dashed' }}>
              {foto ? (
                <>
                  <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-black/60 px-3 py-1.5">
                    <Ionicons name="camera" size={14} color={Colors.cream} />
                    <Text className="font-body-semibold text-xs text-cream">Cambiar</Text>
                  </View>
                </>
              ) : (
                <View className="items-center">
                  <Ionicons name="image-outline" size={32} color={Colors.muted} />
                  <Text className="mt-2 font-body text-sm text-muted">Agregá una foto (opcional)</Text>
                </View>
              )}
            </Pressable>

            {/* Elegí una cancha registrada (o escribí otra) */}
            <Text className="mb-2 font-body-semibold text-sm text-cream">Cancha</Text>
            {canchasDisponibles.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }} className="mb-3">
                {canchasDisponibles.map((c) => {
                  const sel = canchaSelId === c.id && !otraCancha;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => elegirCancha(c)}
                      style={{ width: 170, borderColor: sel ? Colors.primary : Colors.border }}
                      className="overflow-hidden rounded-2xl border bg-card p-3">
                      {c.foto_portada ? (
                        <Image source={{ uri: c.foto_portada }} style={{ width: '100%', height: 64, borderRadius: 10 }} contentFit="cover" />
                      ) : (
                        <View className="h-16 items-center justify-center rounded-xl bg-background">
                          <Ionicons name="business" size={24} color={Colors.muted} />
                        </View>
                      )}
                      <Text className="mt-2 font-body-bold text-sm text-cream" numberOfLines={1}>{c.nombre}</Text>
                      <Text className="font-body text-xs text-muted" numberOfLines={1}>{c.zona}</Text>
                      {sel ? (
                        <View className="mt-1 flex-row items-center gap-1">
                          <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                          <Text className="font-body-semibold text-xs text-primary">Elegida</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => { setOtraCancha(true); setCanchaSelId(null); setCancha(''); }}
                  style={{ width: 120, borderColor: otraCancha ? Colors.primary : Colors.border, borderStyle: 'dashed' }}
                  className="items-center justify-center rounded-2xl border bg-card p-3">
                  <Ionicons name="add-circle-outline" size={22} color={otraCancha ? Colors.primary : Colors.muted} />
                  <Text className="mt-1 font-body-semibold text-xs" style={{ color: otraCancha ? Colors.primary : Colors.muted }}>Otra cancha</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <Text className="mb-2 font-body text-xs text-muted">
                Todavía no hay canchas registradas. Escribí el nombre de la cancha.
              </Text>
            )}

            {(otraCancha || canchasDisponibles.length === 0) ? (
              <Field label="Nombre de la cancha" icon="football-outline" placeholder="Ej. Cancha La Bombonera" value={cancha} onChangeText={setCancha} autoCapitalize="words" />
            ) : null}

            <Text className="mb-2 font-body-semibold text-sm text-cream">Zona</Text>
            <View className="mb-4 flex-row flex-wrap">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
              ))}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateTimeField label="Fecha" mode="date" value={fecha} onChange={setFecha} minToday />
              </View>
              <View className="flex-1">
                <DateTimeField label="Hora" mode="time" value={hora} onChange={setHora} />
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={160}>
            <Text className="mb-2 font-body-semibold text-sm text-cream">Formato</Text>
            <View className="mb-4 flex-row flex-wrap">
              {FORMATOS.map((f) => (
                <Chip key={f} label={`${f}  ·  ${CUPOS_POR_FORMATO[f]} cupos`} selected={formato === f} onPress={() => setFormato(f)} />
              ))}
            </View>

            <Text className="mb-2 font-body-semibold text-sm text-cream">Nivel</Text>
            <View className="mb-4 flex-row flex-wrap">
              {NIVELES.map((n) => (
                <Chip key={n} label={n} selected={nivel === n} onPress={() => setNivel(n)} />
              ))}
            </View>

            <Field label="Precio por jugador (COP)" icon="cash-outline" placeholder="12000" value={precio} onChangeText={setPrecio} keyboardType="numeric" hint="Lo que pone cada uno para la cancha." />
            <Field label="Descripción" icon="chatbubble-outline" placeholder="Contale al parche cómo está la cosa..." value={descripcion} onChangeText={setDescripcion} multiline />

            {error ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text className="flex-1 font-body text-sm text-red-300">{error}</Text>
              </View>
            ) : null}

            <GlowButton label="Publicar partido" variant="accent" icon="megaphone" onPress={onSubmit} loading={publicando} />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
