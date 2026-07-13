import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Duration } from '@/constants/motion';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

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
  const c = useTheme();
  const styles: Record<Variant, { bg: string; text: string; glow: string; border?: string }> = {
    primary: { bg: c.primary, text: c.ink, glow: c.primary },
    accent: { bg: c.accent, text: c.ink, glow: c.accent },
    outline: { bg: 'transparent', text: c.cream, glow: 'transparent', border: c.border },
    dark: { bg: c.card, text: c.cream, glow: '#000000', border: c.border },
  };

  const scale = useSharedValue(1);
  const s = styles[variant];
  const inactivo = disabled || loading;

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={inactivo}
      onPressIn={() => (scale.value = withTiming(0.96, { duration: Duration.instant }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: Duration.fast }))}
      onPress={() => {
        if (haptic) haptics.tap();
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
          // glow (boxShadow cross-platform en RN 0.86; reemplaza shadow*/elevation)
          boxShadow: variant === 'outline' ? undefined : `0px 6px 16px ${s.glow}8C`,
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
