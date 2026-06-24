import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';

export default function Perfil() {
  const router = useRouter();
  const { profile, signOut, demo } = useAuth();
  const misPartidos = useStore(useShallow((s) => s.misPartidos()));

  const u = profile;
  const jugados = u?.partidos_jugados ?? 0;
  const puntualidad = Math.max(0, Math.round(100 - ((u?.no_shows ?? 0) / Math.max(1, jugados)) * 100));
  const racha = Math.min(jugados, 5); // racha simple basada en partidos jugados
  const cerrarSesion = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
          <Text className="font-display text-4xl uppercase text-cream">Mi perfil</Text>
          <Pressable onPress={cerrarSesion} hitSlop={12} className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
            <Ionicons name="log-out-outline" size={21} color={Colors.cream} />
          </Pressable>
        </View>

        {/* Tarjeta de perfil */}
        <FadeIn delay={60}>
          <View className="mx-6 mt-2 overflow-hidden rounded-3xl border border-border">
            <LinearGradient colors={['#10231C', '#0C1712']} style={{ padding: 24, alignItems: 'center' }}>
              <View
                className="rounded-full"
                style={{ padding: 3, borderWidth: 2, borderColor: Colors.primary }}>
                <Avatar nombre={u?.nombre ?? '?'} uri={u?.avatar_url} size={92} />
              </View>
              <Text className="mt-4 font-display text-3xl uppercase text-cream">{u?.nombre ?? 'Invitado'}</Text>
              <View className="mt-1 flex-row items-center">
                <Ionicons name="location-sharp" size={14} color={Colors.muted} />
                <Text className="ml-1 font-body text-sm text-muted">{u?.ciudad ?? 'Pereira'}</Text>
              </View>
              <View className="mt-4 flex-row gap-2">
                <Badge label={u?.posicion ?? 'Mediocampista'} tone="primary" />
                <Badge label={u?.nivel ?? 'Intermedio'} tone="accent" />
              </View>
            </LinearGradient>
          </View>
        </FadeIn>

        {/* Racha */}
        {racha > 0 ? (
          <FadeIn delay={110}>
            <View className="mx-6 mt-4 flex-row items-center gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-2xl">🔥</Text>
              <View className="flex-1">
                <Text className="font-body-bold text-sm text-cream">Racha de {racha} partidos</Text>
                <Text className="font-body text-xs text-muted">Jugá esta semana pa no perderla, parce.</Text>
              </View>
            </View>
          </FadeIn>
        ) : null}

        {/* Stats */}
        <FadeIn delay={140}>
          <View className="mx-6 mt-4 flex-row gap-3">
            <Stat valor={String(jugados)} label="Partidos" icon="football" />
            <Stat valor={(u?.rating ?? 5).toFixed(1)} label="Rating" icon="star" tint={Colors.accent} />
            <Stat valor={`${puntualidad}%`} label="Puntualidad" icon="checkmark-circle" />
          </View>
        </FadeIn>

        {/* Logros */}
        <FadeIn delay={180}>
          <View className="mx-6 mt-4 rounded-md border border-border bg-card p-4">
            <Text className="mb-3 font-body-semibold text-xs uppercase tracking-widest text-muted">Logros</Text>
            <View className="flex-row justify-between">
              <Medalla emoji="🥇" label="Crack" activo={jugados >= 20} />
              <Medalla emoji="⚡" label="Madrugador" activo={jugados >= 5} />
              <Medalla emoji="🤝" label="Buen parche" activo={puntualidad >= 90} />
              <Medalla emoji="🎯" label="Killer" activo={jugados >= 50} />
            </View>
          </View>
        </FadeIn>

        {/* Acciones */}
        <FadeIn delay={180}>
          <View className="mx-6 mt-6 overflow-hidden rounded-3xl border border-border bg-card">
            <Accion icon="ticket-outline" label="Mis partidos" valor={`${misPartidos.length}`} onPress={() => router.push('/mis-partidos')} />
            <Accion icon="receipt-outline" label="Mis pagos" onPress={() => router.push('/mis-pagos')} />
            <Accion icon="color-palette-outline" label="Apariencia" onPress={() => router.push('/apariencia')} />
            <Accion icon="create-outline" label="Editar perfil" onPress={() => router.push('/editar-perfil')} ultimo />
          </View>
        </FadeIn>

        <FadeIn delay={220}>
          <Text className="mt-6 text-center font-body text-xs text-muted">
            Falta Uno · v1.0 {demo ? '· modo demo' : ''}
          </Text>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  valor,
  label,
  icon,
  tone = 'default',
  tint = Colors.primary,
}: {
  valor: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'danger';
  tint?: string;
}) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-border bg-card py-4">
      <Ionicons name={icon} size={18} color={tone === 'danger' ? Colors.danger : tint} />
      <Text className={`mt-2 font-display text-2xl ${tone === 'danger' ? 'text-red-400' : 'text-cream'}`}>
        {valor}
      </Text>
      <Text className="font-body text-xs text-muted">{label}</Text>
    </View>
  );
}

function Medalla({ emoji, label, activo }: { emoji: string; label: string; activo: boolean }) {
  return (
    <View className="items-center" style={{ opacity: activo ? 1 : 0.35 }}>
      <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
        {!activo ? <View className="absolute inset-0 rounded-full bg-card/60" /> : null}
      </View>
      <Text className="mt-1.5 font-body text-[11px] text-cream">{label}</Text>
    </View>
  );
}

function Accion({
  icon,
  label,
  valor,
  onPress,
  ultimo = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor?: string;
  onPress: () => void;
  ultimo?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center px-4 py-4 active:bg-border/40 ${ultimo ? '' : 'border-b border-border'}`}>
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <Text className="ml-3 flex-1 font-body-semibold text-base text-cream">{label}</Text>
      {valor ? <Text className="mr-2 font-body text-sm text-muted">{valor}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
    </Pressable>
  );
}
