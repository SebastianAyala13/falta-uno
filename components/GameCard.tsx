import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import { Colors } from '@/constants/colors';
import { cuposFaltantes, formatearPrecio } from '@/lib/mockData';
import type { PartidoConOrganizador } from '@/types/database';

interface GameCardProps {
  partido: PartidoConOrganizador;
  onJoin?: () => void;
}

const diaSemana = (fecha: string) => {
  // fecha YYYY-MM-DD -> etiqueta corta en español sin depender de zona horaria
  const [y, m, d] = fecha.split('-').map(Number);
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${dias[date.getUTCDay()]} ${d}/${m}`;
};

/** Tarjeta de un partido para los feeds (Home / Buscar). */
export default function GameCard({ partido, onJoin }: GameCardProps) {
  const lleno = partido.cupos_ocupados >= partido.cupos_totales;
  const faltan = cuposFaltantes(partido);

  return (
    <View className="mb-4 rounded-3xl border border-border bg-card p-4">
      {/* Header: ícono deporte + cancha + cupos */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
            <Ionicons name="football" size={24} color={Colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
              {partido.cancha}
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="location-sharp" size={12} color={Colors.muted} />
              <Text className="ml-1 font-body text-xs text-muted">{partido.zona}</Text>
            </View>
          </View>
        </View>
        <Badge label={faltan} tone={lleno ? 'neutral' : faltan === 'Falta 1' ? 'accent' : 'primary'} />
      </View>

      {/* Meta: fecha, hora, precio */}
      <View className="mb-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={14} color={Colors.muted} />
          <Text className="ml-1 font-body text-xs text-muted">{diaSemana(partido.fecha)}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color={Colors.muted} />
          <Text className="ml-1 font-body text-xs text-muted">{partido.hora}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="cash-outline" size={14} color={Colors.muted} />
          <Text className="ml-1 font-body text-xs text-muted">
            {formatearPrecio(partido.precio)} / jugador
          </Text>
        </View>
      </View>

      {/* Tags + botón */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-2">
          <Badge label={partido.formato} tone="neutral" />
          <Badge label={partido.nivel} tone="neutral" />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={lleno}
          onPress={onJoin}
          className={`rounded-xl px-5 py-2.5 ${lleno ? 'bg-border' : 'bg-primary active:bg-secondary'}`}>
          <Text
            className={`font-body-bold text-sm uppercase ${lleno ? 'text-muted' : 'text-background'}`}>
            {lleno ? 'Lleno' : 'Unirme'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
