import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { CUPOS_POR_FORMATO, FORMATOS, NIVELES, ZONAS, type Formato, type Nivel, type Zona } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

export default function Crear() {
  const router = useRouter();
  const { profile } = useAuth();
  const crearPartido = useStore((s) => s.crearPartido);

  const [cancha, setCancha] = useState('');
  const [zona, setZona] = useState<Zona | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [formato, setFormato] = useState<Formato>('5v5');
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    if (!cancha || !zona || !fecha || !hora || !nivel || !precio) {
      setError('Completá cancha, zona, fecha, hora, nivel y precio.');
      return;
    }
    const id = crearPartido(
      {
        cancha: cancha.trim(),
        zona: zona!,
        fecha: fecha.trim(),
        hora: hora.trim(),
        formato,
        nivel: nivel!,
        precio: parseInt(precio, 10) || 0,
        descripcion: descripcion.trim(),
      },
      { id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos' },
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({ pathname: '/partido/[id]', params: { id } });
  };

  return (
    <Screen>
      <FadeIn delay={40}>
        <View className="px-6 pb-1 pt-2">
          <Text className="font-display text-4xl uppercase text-cream">Crear partido</Text>
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
            <Field label="Nombre de la cancha" icon="football-outline" placeholder="Ej. Cancha La Bombonera" value={cancha} onChangeText={setCancha} autoCapitalize="words" />

            <Text className="mb-2 font-body-semibold text-sm text-cream">Zona</Text>
            <View className="mb-4 flex-row flex-wrap">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
              ))}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Fecha" icon="calendar-outline" placeholder="2026-06-25" value={fecha} onChangeText={setFecha} />
              </View>
              <View className="flex-1">
                <Field label="Hora" icon="time-outline" placeholder="20:00" value={hora} onChangeText={setHora} />
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

            <GlowButton label="Publicar partido" variant="accent" icon="megaphone" onPress={onSubmit} />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
