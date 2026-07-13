import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import GlowButton from '@/components/GlowButton';
import { useTheme } from '@/lib/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  cta?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
}

/** Estado vacío futbolero, reutilizable (feed, buscar, etc.). */
export default function EmptyState({ icon = 'football-outline', titulo, texto, cta }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View className="items-center px-8 pt-16">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: t.primary + '1F' }}>
        <Ionicons name={icon} size={38} color={t.primary} />
      </View>
      <Text className="text-center font-display text-2xl uppercase text-cream">{titulo}</Text>
      <Text className="mt-2 text-center font-body text-sm text-muted">{texto}</Text>
      {cta ? (
        <View className="mt-6 w-full">
          <GlowButton label={cta.label} variant="primary" icon={cta.icon ?? 'add'} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}
