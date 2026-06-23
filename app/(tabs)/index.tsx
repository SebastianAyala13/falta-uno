import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import GameCard from '@/components/GameCard';
import { Colors } from '@/constants/colors';
import { partidosCerca, usuarioActual } from '@/lib/mockData';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View className="flex-row items-center">
            <Avatar nombre={usuarioActual.nombre} uri={usuarioActual.avatar_url} size={48} />
            <View className="ml-3">
              <Text className="font-body text-sm text-muted">Hola,</Text>
              <Text className="font-display text-2xl uppercase text-cream">
                {usuarioActual.nombre} 👋
              </Text>
            </View>
          </View>
          <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-card">
            <Ionicons name="notifications-outline" size={22} color={Colors.cream} />
          </Pressable>
        </View>

        {/* Banner CTA */}
        <View className="mx-6 mb-6 overflow-hidden rounded-3xl bg-secondary p-5">
          <Text className="font-display text-2xl uppercase leading-tight text-cream">
            ¿Te falta llave{'\n'}pa la pichanga?
          </Text>
          <Text className="mt-1 font-body text-sm text-cream/80">
            Cuadrá tu partido en segundos.
          </Text>
          <Pressable
            onPress={() => router.push('/crear')}
            className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-80">
            <Text className="font-body-bold text-sm uppercase text-background">Crear partido</Text>
          </Pressable>
        </View>

        {/* Sección partidos cerca */}
        <View className="mb-3 flex-row items-center justify-between px-6">
          <Text className="font-display text-xl uppercase text-cream">Partidos cerca de vos</Text>
          <Pressable onPress={() => router.push('/buscar')}>
            <Text className="font-body-semibold text-sm text-primary">Ver todos</Text>
          </Pressable>
        </View>

        <View className="px-6">
          {partidosCerca.map((p) => (
            <GameCard key={p.id} partido={p} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
