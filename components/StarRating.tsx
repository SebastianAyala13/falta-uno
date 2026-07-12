import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

interface StarRatingProps {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}

/** Selector de estrellas (1-5) para el sistema de reputación. */
export default function StarRating({ value, onChange, size = 36, readOnly = false }: StarRatingProps) {
  const c = useTheme();
  return (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={readOnly}
          hitSlop={6}
          onPress={() => {
            haptics.select();
            onChange?.(n);
          }}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? c.accent : c.muted} />
        </Pressable>
      ))}
    </View>
  );
}
