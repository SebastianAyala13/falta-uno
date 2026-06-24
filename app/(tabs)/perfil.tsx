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

        {/* Stats */}
        <FadeIn delay={120}>
          <View className="mx-6 mt-4 flex-row gap-3">
            <Stat valor={String(u?.partidos_jugados ?? 0)} label="Partidos" icon="football" />
            <Stat valor={String(u?.no_shows ?? 0)} label="No-shows" icon="close-circle" tone={(u?.no_shows ?? 0) > 0 ? 'danger' : 'default'} />
            <Stat valor={(u?.rating ?? 5).toFixed(1)} label="Rating" icon="star" tint={Colors.accent} />
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
