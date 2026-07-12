import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type Props = {
  message?: string | null;
  className?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss?: () => void; // reservado, sin uso hoy
  /** Acción de reintento: muestra un botón al final del banner. */
  action?: { label: string; onPress: () => void };
};

export default function ErrorBanner({ message, className = 'mb-4', icon = 'alert-circle', action }: Props) {
  const c = useTheme();
  if (!message) return null;
  return (
    <View className={`${className} flex-row items-center gap-2 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2.5`}>
      <Ionicons name={icon} size={16} color={c.danger} />
      <Text className="flex-1 font-body text-sm text-danger">{message}</Text>
      {action ? (
        <Pressable
          onPress={() => {
            haptics.tap();
            action.onPress();
          }}
          hitSlop={8}
          className="rounded-sm px-2 py-1 active:opacity-70">
          <Text className="font-body-bold text-sm uppercase text-danger">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
