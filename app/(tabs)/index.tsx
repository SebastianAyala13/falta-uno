import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const partidos = useStore((s) => s.partidos);
  const misPartidos = useStore((s) => s.misPartidos());

  const nombre = profile?.nombre ?? 'crack';
  const cerca = partidos.slice(0, 4);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <FadeIn delay={40}>
          <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
            <Pressable onPress={() => router.push('/(tabs)/perfil')} className="flex-row items-center">
              <Avatar nombre={nombre} uri={profile?.avatar_url} size={48} />
              <View className="ml-3">
                <Text className="font-body text-xs uppercase tracking-wider text-muted">
                  Hola, parce
                </Text>
                <Text className="font-display text-2xl uppercase text-cream">{nombre} 👋</Text>
              </View>
            </Pressable>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
              <Ionicons name="notifications-outline" size={21} color={Colors.cream} />
              <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent" />
            </Pressable>
          </View>
        </FadeIn>

        {/* Hero CTA */}
        <FadeIn delay={120}>
          <Pressable
            onPress={() => router.push('/(tabs)/crear')}
            className="mx-6 mb-5 overflow-hidden rounded-3xl">
            <LinearGradient colors={[Colors.secondary, '#065F46', '#03251C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
              <View
                pointerEvents="none"
                className="absolute rounded-full"
                style={{ right: -40, top: -40, width: 160, height: 160, backgroundColor: Colors.accent, opacity: 0.12 }}
              />
              <Text className="font-display text-3xl uppercase leading-8 text-cream">
                ¿Te falta llave{'\n'}pa la pichanga?
              </Text>
              <Text className="mt-1.5 font-body text-sm text-cream/70">
                Armá tu partido y que la gente se cuadre sola.
              </Text>
              <View className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-accent px-4 py-2.5">
                <Ionicons name="add-circle" size={18} color={Colors.background} />
                <Text className="font-body-bold text-sm uppercase text-background">Crear partido</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </FadeIn>

        {/* Stats rápidas */}
        <FadeIn delay={180}>
          <View className="mb-6 flex-row gap-3 px-6">
            <MiniStat icon="football" valor={String(profile?.partidos_jugados ?? 0)} label="Jugados" />
            <MiniStat icon="ticket" valor={String(misPartidos.length)} label="Inscrito" onPress={() => router.push('/mis-partidos')} />
            <MiniStat icon="star" valor={(profile?.rating ?? 5).toFixed(1)} label="Rating" tint={Colors.accent} />
          </View>
        </FadeIn>

        {/* Sección partidos cerca */}
        <FadeIn delay={220}>
          <View className="mb-3 flex-row items-center justify-between px-6">
            <View>
              <Text className="font-display text-2xl uppercase text-cream">Cerca de vos</Text>
              <Text className="font-body text-xs text-muted">Pereira · Risaralda</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/buscar')} className="flex-row items-center gap-1">
              <Text className="font-body-semibold text-sm text-primary">Ver todos</Text>
              <Ionicons name="arrow-forward" size={15} color={Colors.primary} />
            </Pressable>
          </View>
        </FadeIn>

        <View className="px-6">
          {cerca.map((p, i) => (
            <FadeIn key={p.id} delay={280 + i * 70}>
              <GameCard partido={p} destacado={i === 0} />
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MiniStat({
  icon,
  valor,
  label,
  tint = Colors.primary,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  valor: string;
  label: string;
  tint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-2xl border border-border bg-card p-3">
      <Ionicons name={icon} size={18} color={tint} />
      <Text className="mt-2 font-display text-2xl text-cream">{valor}</Text>
      <Text className="font-body text-xs text-muted">{label}</Text>
    </Pressable>
  );
}
