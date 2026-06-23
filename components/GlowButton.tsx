import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors } from '@/constants/colors';

type Variant = 'primary' | 'accent' | 'outline' | 'dark';

interface GlowButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  haptic?: boolean;
}

const styles: Record<Variant, { bg: string; text: string; glow: string; border?: string }> = {
  primary: { bg: Colors.primary, text: Colors.background, glow: Colors.primary },
  accent: { bg: Colors.accent, text: Colors.background, glow: Colors.accent },
  outline: { bg: 'transparent', text: Colors.cream, glow: 'transparent', border: Colors.border },
  dark: { bg: Colors.card, text: Colors.cream, glow: '#000000', border: Colors.border },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Botón principal premium: glow de marca, animación de press y háptica. */
export default function GlowButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  haptic = true,
}: GlowButtonProps) {
  const scale = useSharedValue(1);
  const s = styles[variant];
  const inactivo = disabled || loading;

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={inactivo}
      onPressIn={() => (scale.value = withTiming(0.96, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={[
        animated,
        {
          height: 56,
          borderRadius: 18,
          backgroundColor: s.bg,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border,
          opacity: inactivo ? 0.5 : 1,
          // glow
          shadowColor: s.glow,
          shadowOpacity: variant === 'outline' ? 0 : 0.55,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: variant === 'outline' ? 0 : 8,
        },
      ]}>
      <View className="h-full w-full flex-row items-center justify-center gap-2 px-6">
        {loading ? (
          <ActivityIndicator color={s.text} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={20} color={s.text} /> : null}
            <Text
              style={{ color: s.text }}
              className="font-body-bold text-base uppercase tracking-wider">
              {label}
            </Text>
          </>
        )}
      </View>
    </AnimatedPressable>
  );
}
