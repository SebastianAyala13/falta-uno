import { ScrollView, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import type { Cancha } from '@/types/database';

interface SelectorCanchaProps {
  canchas: Cancha[];
  /** Id de la cancha activa. */
  activaId: string | null;
  onElegir: (id: string) => void;
  className?: string;
}

/**
 * Elige con qué cancha trabaja la pantalla, cuando el dueño tiene más de una.
 *
 * No pinta nada con una sola cancha: el dueño de un establecimiento con una
 * cancha no necesita elegir, y un selector de un solo elemento es ruido.
 *
 * Scroll horizontal porque el nombre lo pone el dueño y puede ser largo
 * («La Bombonera, Cancha 1»); con cuatro o cinco canchas las pastillas no caben
 * en el ancho de un teléfono.
 */
export default function SelectorCancha({ canchas, activaId, onElegir, className }: SelectorCanchaProps) {
  if (canchas.length < 2) return null;

  const activa = canchas.some((c) => c.id === activaId) ? activaId : canchas[0]?.id;

  return (
    <View className={className}>
      <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wide text-muted">Cancha</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {canchas.map((cancha) => (
          <Chip
            key={cancha.id}
            label={cancha.nombre}
            selected={cancha.id === activa}
            onPress={() => onElegir(cancha.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
