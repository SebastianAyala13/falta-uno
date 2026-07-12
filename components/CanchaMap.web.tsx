import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

type Props = {
  coords: { latitude: number; longitude: number };
  cancha: string;
  zona: string;
  /** Si se pasa, muestra el botón "Cómo llegar" debajo del mapa. */
  onComoLlegar?: () => void;
};

export default function CanchaMap({ coords, cancha, onComoLlegar }: Props) {
  const c = useTheme();
  const src = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}&z=15&output=embed`;
  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-border bg-card">
      <iframe
        title={`Mapa de ${cancha}`}
        src={src}
        loading="lazy"
        style={{ width: '100%', height: 160, border: 0, display: 'block' }}
      />
      {onComoLlegar ? (
        <Pressable
          onPress={onComoLlegar}
          className="flex-row items-center justify-center gap-2 border-t border-border py-3.5 active:bg-border/40">
          <Ionicons name="navigate" size={18} color={c.primary} />
          <Text className="font-body-bold text-sm uppercase tracking-wide text-primary">
            Cómo llegar
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
