import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

type Props = {
  message?: string | null;
  className?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss?: () => void; // reservado, sin uso hoy
  action?: { label: string; onPress: () => void }; // reservado, sin uso hoy
};

export default function ErrorBanner({ message, className = 'mb-4', icon = 'alert-circle' }: Props) {
  const c = useTheme();
  if (!message) return null;
  return (
    <View className={`${className} flex-row items-center gap-2 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2.5`}>
      <Ionicons name={icon} size={16} color={c.danger} />
      <Text className="flex-1 font-body text-sm text-danger">{message}</Text>
    </View>
  );
}
