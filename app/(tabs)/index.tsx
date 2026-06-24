import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import Screen from '@/components/Screen';
import { precioCOP } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useStore } from '@/lib/store';
import type { PartidoConOrganizador } from '@/types/database';

const faltanDe = (p: PartidoConOrganizador) => p.cupos_totales - p.cupos_ocupados;

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();
  const partidos = useStore((s) => s.partidos);

  const nombre = profile?.nombre ?? 'crack';
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  // Priorizamos por urgencia: los que están por llenarse primero; los llenos al final
  const ordenados = useMemo(() => {
    return [...partidos].sort((a, b) => {
      const fa = faltanDe(a);
      const fb = faltanDe(b);
      const ua = fa <= 0 ? 99 : fa; // llenos al final
      const ub = fb <= 0 ? 99 : fb;
      return ua - ub;
    });
  }, [partidos]);

  const urgentes = useMemo(
    () => partidos.filter((p) => { const f = faltanDe(p); return f > 0 && f <= 2; }).sort((a, b) => faltanDe(a) - faltanDe(b)),
    [partidos],
  );

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}>
        {/* Header */}
        <FadeIn delay={40}>
          <View className="flex-row items-center justify-between px-[22px] pb-4 pt-2">
            <Pressable onPress={() => router.push('/(tabs)/perfil')} className="flex-row items-center">
              <Avatar nombre={nombre} uri={profile?.avatar_url} size={48} />
              <View className="ml-3">
                <Text className="font-body text-xs uppercase tracking-wider text-muted">Hola, parce</Text>
                <Text className="font-display text-2xl uppercase text-cream">{nombre} 👋</Text>
              </View>
            </Pressable>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
              <Ionicons name="notifications-outline" size={21} color={c.cream} />
            </Pressable>
          </View>
        </FadeIn>

        {/* Hero CTA */}
        <FadeIn delay={110}>
          <Pressable onPress={() => router.push('/(tabs)/crear')} className="mx-[22px] mb-5 overflow-hidden rounded-lg">
            <LinearGradient colors={[c.secondary, '#065F46', '#03251C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
              <View pointerEvents="none" className="absolute rounded-full" style={{ right: -40, top: -40, width: 150, height: 150, backgroundColor: c.accent, opacity: 0.12 }} />
              <Text className="font-display text-[25px] uppercase leading-7 text-cream">¿Te falta llave{'\n'}pa la pichanga?</Text>
              <Text className="mt-1.5 font-body text-sm text-cream/70">Armá tu partido y que la gente se cuadre sola.</Text>
              <View className="mt-4 flex-row items-center gap-2 self-start rounded-sm bg-accent px-4 py-2.5">
                <Ionicons name="add-circle" size={18} color={c.ink} />
                <Text className="font-body-bold text-sm uppercase text-ink">Crear partido</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </FadeIn>

        {/* Strip "Cierran ya" */}
        {urgentes.length > 0 ? (
          <FadeIn delay={170}>
            <View className="mb-5">
              <View className="mb-2 flex-row items-center gap-1.5 px-[22px]">
                <Text className="font-display text-lg uppercase text-cream">🔥 Cierran ya</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}>
                {urgentes.map((p) => (
                  <UrgentCard key={p.id} partido={p} onPress={() => router.push({ pathname: '/partido/[id]', params: { id: p.id } })} />
                ))}
              </ScrollView>
            </View>
          </FadeIn>
        ) : null}

        {/* Feed */}
        <FadeIn delay={220}>
          <View className="mb-3 flex-row items-center justify-between px-[22px]">
            <View>
              <Text className="font-display text-2xl uppercase text-cream">Cerca de vos</Text>
              <Text className="font-body text-xs text-muted">Pereira · Risaralda</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/buscar')} className="flex-row items-center gap-1">
              <Text className="font-body-semibold text-sm text-primary">Ver todos</Text>
              <Ionicons name="arrow-forward" size={15} color={c.primary} />
            </Pressable>
          </View>
        </FadeIn>

        <View className="px-[22px]">
          {ordenados.length === 0 ? (
            <EmptyState
              titulo="Tu zona está quieta"
              texto="Nadie ha armado pichanga por acá todavía. Sé el primero 👟"
              cta={{ label: 'Armar el primero', onPress: () => router.push('/(tabs)/crear') }}
            />
          ) : (
            ordenados.map((p, i) => (
              <FadeIn key={p.id} delay={280 + i * 60}>
                <GameCard partido={p} destacado={faltanDe(p) === 1} />
              </FadeIn>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Mini-tarjeta de urgencia para el strip horizontal. */
function UrgentCard({ partido, onPress }: { partido: PartidoConOrganizador; onPress: () => void }) {
  const c = useTheme();
  const faltan = faltanDe(partido);
  const urgente = faltan === 1;
  const stripColor = urgente ? c.accent : c.primary;
  return (
    <Pressable onPress={onPress} style={{ width: 170 }} className="overflow-hidden rounded-md border border-borderStrong bg-card">
      <View style={{ backgroundColor: stripColor }} className="flex-row items-center gap-1 px-3 py-1.5">
        <Ionicons name="flame" size={12} color={c.ink} />
        <Text className="font-body-bold text-[11px] uppercase tracking-wide text-ink">
          {urgente ? '¡Falta 1!' : `Faltan ${faltan}`}
        </Text>
      </View>
      <View className="p-3">
        <Text className="font-display text-base uppercase leading-5 text-cream" numberOfLines={1}>{partido.cancha}</Text>
        <Text className="mt-0.5 font-body text-xs text-muted" numberOfLines={1}>{partido.zona} · {partido.hora}</Text>
        <Text className="mt-2 font-display text-lg text-accent">{precioCOP(partido.precio)}</Text>
      </View>
    </Pressable>
  );
}
