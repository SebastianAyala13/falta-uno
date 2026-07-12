import { useEffect } from 'react';
import type { ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Duration, MotionEasing } from '@/constants/motion';

interface FadeInProps extends ViewProps {
  /** Retraso en ms para encadenar entradas (efecto staggered). */
  delay?: number;
  /** Desplazamiento vertical inicial. */
  offset?: number;
}

/**
 * Entrada suave (fade + slide up). Usado para revelar contenido de forma
 * escalonada al cargar cada pantalla.
 */
export default function FadeIn({ delay = 0, offset = 16, style, children, ...rest }: FadeInProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: Duration.base, easing: MotionEasing.entrance }));
  }, [delay, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));

  return (
    <Animated.View style={[animated, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
