import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useShallow } from 'zustand/react/shallow';

export default function MisPartidos() {
  const router = useRouter();
  const misPartidos = useStore(useShallow((s) => s.misPartidos()));
  const calificaciones = useStore((s) => s.calificaciones);
  const c = useTheme();
  const yaCalifico = (id: string) => calificaciones.some((cal) => cal.partido_id === id);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Mis partidos" className="px-6 pb-2 pt-2" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {misPartidos.length === 0 ? (
          <FadeIn delay={60} className="mt-16 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-card">
              <Ionicons name="football-outline" size={40} color={c.muted} />
            </View>
            <Text className="mt-4 font-display text-2xl uppercase text-cream">Todavía nada</Text>
            <Text className="mb-6 mt-2 max-w-[260px] text-center font-body text-sm text-muted">
              No estás inscrito en ningún partido, parce. Buscá uno y cuadrate.
            </Text>
            <View className="w-full">
              <GlowButton label="Buscar partidos" variant="primary" icon="search" onPress={() => router.replace('/(tabs)/buscar')} />
            </View>
          </FadeIn>
        ) : (
          misPartidos.map((p, i) => {
            const calificado = yaCalifico(p.id);
            return (
              <FadeIn key={p.id} delay={60 + i * 60}>
                <GameCard partido={p} />
                <Pressable
                  onPress={() => !calificado && router.push({ pathname: '/calificar/[id]', params: { id: p.id } })}
                  disabled={calificado}
                  className="-mt-2 mb-4 flex-row items-center justify-center gap-2 rounded-md border py-3"
                  style={{ borderColor: calificado ? c.border : c.accent + '66', backgroundColor: calificado ? 'transparent' : c.accent + '12' }}>
                  <Ionicons name={calificado ? 'checkmark-circle' : 'star'} size={16} color={calificado ? c.muted : c.accent} />
                  <Text className="font-body-bold text-sm uppercase tracking-wide" style={{ color: calificado ? c.muted : c.accent }}>
                    {calificado ? 'Calificado' : 'Calificar partido'}
                  </Text>
                </Pressable>
              </FadeIn>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
