import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { Colors } from '@/constants/colors';
import { usuarioActual } from '@/lib/mockData';

export default function PerfilScreen() {
  const router = useRouter();
  const u = usuarioActual;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <Text className="font-display text-3xl uppercase text-cream">Mi perfil</Text>
          <Pressable
            onPress={() => router.replace('/')}
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-full bg-card">
            <Ionicons name="log-out-outline" size={22} color={Colors.cream} />
          </Pressable>
        </View>

        {/* Tarjeta de perfil */}
        <View className="mx-6 items-center rounded-3xl border border-border bg-card p-6">
          <Avatar nombre={u.nombre} uri={u.avatar_url} size={96} />
          <Text className="mt-4 font-display text-3xl uppercase text-cream">{u.nombre}</Text>

          <View className="mt-1 flex-row items-center">
            <Ionicons name="location-sharp" size={14} color={Colors.muted} />
            <Text className="ml-1 font-body text-sm text-muted">{u.ciudad}</Text>
          </View>

          <View className="mt-4 flex-row gap-2">
            <Badge label={u.posicion} tone="primary" />
            <Badge label={u.nivel} tone="accent" />
          </View>
        </View>

        {/* Stats */}
        <View className="mx-6 mt-4 flex-row gap-3">
          <Stat valor={String(u.partidos_jugados)} label="Partidos" />
          <Stat valor={String(u.no_shows)} label="No-shows" tone={u.no_shows > 0 ? 'danger' : 'default'} />
          <Stat valor={u.rating.toFixed(1)} label="Rating" icon="star" />
        </View>

        {/* Editar */}
        <View className="mx-6 mt-6">
          <Button label="Editar perfil" variant="outline" />
        </View>

        {/* Info extra */}
        <View className="mx-6 mt-6 rounded-3xl border border-border bg-card p-4">
          <Text className="mb-3 font-body-semibold text-sm uppercase tracking-wide text-muted">
            Cuenta
          </Text>
          <FilaInfo icon="call-outline" label="Celular" valor={u.celular} />
          <FilaInfo icon="football-outline" label="Posición" valor={u.posicion} />
          <FilaInfo icon="trophy-outline" label="Nivel" valor={u.nivel} ultimo />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  valor,
  label,
  icon,
  tone = 'default',
}: {
  valor: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'danger';
}) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-border bg-card py-4">
      <View className="flex-row items-center">
        {icon ? <Ionicons name={icon} size={16} color={Colors.accent} style={{ marginRight: 4 }} /> : null}
        <Text className={`font-display text-2xl ${tone === 'danger' ? 'text-red-400' : 'text-cream'}`}>
          {valor}
        </Text>
      </View>
      <Text className="mt-1 font-body text-xs text-muted">{label}</Text>
    </View>
  );
}

function FilaInfo({
  icon,
  label,
  valor,
  ultimo = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor: string;
  ultimo?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center py-3 ${ultimo ? '' : 'border-b border-border'}`}>
      <Ionicons name={icon} size={18} color={Colors.muted} />
      <Text className="ml-3 flex-1 font-body text-sm text-muted">{label}</Text>
      <Text className="font-body-semibold text-sm text-cream">{valor}</Text>
    </View>
  );
}
