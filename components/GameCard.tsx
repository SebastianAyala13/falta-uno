import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import ProgressBar from '@/components/ProgressBar';
import { Colors } from '@/constants/colors';
import { fechaCorta, precioCOP } from '@/lib/format';
import type { PartidoConOrganizador } from '@/types/database';

interface GameCardProps {
  partido: PartidoConOrganizador;
  /** Variante destacada (primer item del feed). */
  destacado?: boolean;
}

/** Tarjeta premium de un partido. Toca para ver el detalle. */
export default function GameCard({ partido, destacado = false }: GameCardProps) {
  const router = useRouter();
  const lleno = partido.cupos_ocupados >= partido.cupos_totales;
  const faltan = partido.cupos_totales - partido.cupos_ocupados;
  const urgente = faltan === 1;
  const ratio = partido.cupos_ocupados / partido.cupos_totales;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/partido/[id]', params: { id: partido.id } })}
      className="mb-4 overflow-hidden rounded-3xl border border-border bg-card active:opacity-90"
      style={
        destacado
          ? {
              borderColor: Colors.primary + '66',
              shadowColor: Colors.primary,
              shadowOpacity: 0.25,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }
          : undefined
      }>
      {/* Franja superior con estado de cupos */}
      <View
        className="flex-row items-center justify-between px-4 py-2"
        style={{ backgroundColor: lleno ? Colors.border : urgente ? Colors.accent : Colors.primary }}>
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={lleno ? 'lock-closed' : 'flame'}
            size={13}
            color={lleno ? Colors.muted : Colors.background}
          />
          <Text
            className="font-body-bold text-xs uppercase tracking-wider"
            style={{ color: lleno ? Colors.muted : Colors.background }}>
            {lleno ? 'Cupo lleno' : faltan === 1 ? '¡Falta 1, parce!' : `Faltan ${faltan}`}
          </Text>
        </View>
        <Text
          className="font-body-bold text-xs uppercase"
          style={{ color: lleno ? Colors.muted : Colors.background }}>
          {partido.formato}
        </Text>
      </View>

      <View className="p-4">
        {/* Cancha + zona */}
        <View className="mb-3 flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className="font-display text-2xl uppercase leading-7 text-cream" numberOfLines={1}>
              {partido.cancha}
            </Text>
            <View className="mt-0.5 flex-row items-center">
              <Ionicons name="location-sharp" size={13} color={Colors.muted} />
              <Text className="ml-1 font-body text-sm text-muted">{partido.zona} · Pereira</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="font-display text-2xl text-accent">{precioCOP(partido.precio)}</Text>
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
            <Ionicons name="star" size={13} color={Colors.accent} />
            <Text className="font-body-semibold text-xs text-cream">
              {partido.organizador?.rating?.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center">
      <Ionicons name={icon} size={14} color={Colors.muted} />
      <Text className="ml-1 font-body text-xs text-cream">{label}</Text>
    </View>
  );
}
