import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useStore } from '@/lib/store';

export default function MisPartidos() {
  const router = useRouter();
  const misPartidos = useStore((s) => s.misPartidos());

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream">Mis partidos</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {misPartidos.length === 0 ? (
          <FadeIn delay={60} className="mt-16 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-card">
              <Ionicons name="football-outline" size={40} color={Colors.muted} />
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
          misPartidos.map((p, i) => (
            <FadeIn key={p.id} delay={60 + i * 60}>
              <GameCard partido={p} />
            </FadeIn>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
