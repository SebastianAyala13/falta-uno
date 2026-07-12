import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Avatar from '@/components/Avatar';
import ProgressBar from '@/components/ProgressBar';
import UrgencyPill from '@/components/UrgencyPill';
import { Duration } from '@/constants/motion';
import { fechaCorta, precioCOP } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';
import type { PartidoConOrganizador } from '@/types/database';

interface GameCardProps {
  partido: PartidoConOrganizador;
  /** Variante destacada (primer item del feed). */
  destacado?: boolean;
}

/** Tarjeta premium de un partido. Toca para ver el detalle. */
export default function GameCard({ partido, destacado = false }: GameCardProps) {
  const router = useRouter();
  const c = useTheme();
  const lleno = partido.cupos_ocupados >= partido.cupos_totales;
  const faltan = partido.cupos_totales - partido.cupos_ocupados;
  const urgente = faltan === 1;
  const ratio = partido.cupos_ocupados / partido.cupos_totales;

  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.975, { duration: Duration.instant }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: Duration.fastCard }))}
      onPress={() => {
        haptics.select();
        router.push({ pathname: '/partido/[id]', params: { id: partido.id } });
      }}
      style={{ marginBottom: 16 }}>
      <Animated.View
        style={[
          animated,
          {
            overflow: 'hidden',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: destacado ? c.primary + '66' : c.border,
            backgroundColor: c.card,
          },
          destacado
            ? {
                shadowColor: c.primary,
                shadowOpacity: 0.25,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }
            : null,
        ]}>
      {/* Franja superior con estado de cupos */}
      <UrgencyPill
        faltan={faltan}
        tone="solid"
        shape="strip"
        size="md"
        fill
        urgentLabel="¡Falta 1, parce!"
        trailing={
          <Text
            className="font-body-bold text-xs uppercase"
            style={{ color: lleno ? c.muted : c.ink }}>
            {partido.formato}
          </Text>
        }
      />

      <View className="p-4">
        {/* Cancha + zona */}
        <View className="mb-3 flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className="font-display text-2xl uppercase leading-7 text-cream" numberOfLines={1}>
              {partido.cancha}
            </Text>
            <View className="mt-0.5 flex-row items-center">
              <Ionicons name="location-sharp" size={13} color={c.muted} />
              <Text className="ml-1 font-body text-sm text-muted">{partido.zona} · Pereira</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="font-display text-2xl text-accentText">{precioCOP(partido.precio)}</Text>
            <Text className="font-body text-[10px] uppercase tracking-wide text-muted">
              por jugador
            </Text>
          </View>
        </View>

        {/* Meta: fecha + hora + nivel */}
        <View className="mb-3 flex-row items-center gap-4">
          <Meta icon="calendar-outline" label={fechaCorta(partido.fecha)} />
          <Meta icon="time-outline" label={partido.hora} />
          <Meta icon="speedometer-outline" label={partido.nivel} />
        </View>

        {/* Cupos */}
        <ProgressBar value={ratio} urgente={urgente} />

        {/* Organizador */}
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Avatar nombre={partido.organizador?.nombre ?? '?'} size={26} />
            <Text className="ml-2 font-body text-xs text-muted">
              Organiza <Text className="text-cream">{partido.organizador?.nombre}</Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={13} color={c.accentText} />
            <Text className="font-body-semibold text-xs text-cream">
              {partido.organizador?.rating?.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
      </Animated.View>
    </Pressable>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const c = useTheme();
  return (
    <View className="flex-row items-center">
      <Ionicons name={icon} size={14} color={c.muted} />
      <Text className="ml-1 font-body text-xs text-cream">{label}</Text>
    </View>
  );
}
