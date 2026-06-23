import { View } from 'react-native';

import { Colors } from '@/constants/colors';

interface ProgressBarProps {
  value: number; // 0 - 1
  /** Resalta en color de acento cuando está casi lleno. */
  urgente?: boolean;
}

/** Barra de progreso de cupos del partido. */
export default function ProgressBar({ value, urgente = false }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View className="h-2 w-full overflow-hidden rounded-full bg-border">
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: urgente ? Colors.accent : Colors.primary,
        }}
      />
    </View>
  );
}
