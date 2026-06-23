import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface StarRatingProps {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}

/** Selector de estrellas (1-5) para el sistema de reputación. */
export default function StarRating({ value, onChange, size = 36, readOnly = false }: StarRatingProps) {
  return (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={readOnly}
          hitSlop={6}
          onPress={() => {
            Haptics.selectionAsync();
            onChange?.(n);
          }}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? Colors.accent : Colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}
