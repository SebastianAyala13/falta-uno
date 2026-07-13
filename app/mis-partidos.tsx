import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
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
          <EmptyState
            icon="football-outline"
            titulo="Todavía nada"
            texto="No estás inscrito en ningún partido, parce. Buscá uno y cuadrate."
            cta={{ label: 'Buscar partidos', icon: 'search', onPress: () => router.replace('/(tabs)/buscar') }}
          />
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
