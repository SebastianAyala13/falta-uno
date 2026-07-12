import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Duration, MotionEasing } from '@/constants/motion';
import { useTheme } from '@/lib/theme';

/** Bloque con efecto shimmer para estados de carga. */
export function SkeletonBlock({ height = 16, width = '100%', radius = 8, style }: { height?: number; width?: number | string; radius?: number; style?: object }) {
  const t = useTheme();
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: Duration.shimmer, easing: MotionEasing.pulse }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[{ height, width: width as number, borderRadius: radius, backgroundColor: t.border }, anim, style]}
    />
  );
}

/** Tarjeta skeleton que imita una GameCard mientras carga el feed. */
export function GameCardSkeleton() {
  const t = useTheme();
  return (
    <View className="mb-4 overflow-hidden rounded-lg border border-border" style={{ backgroundColor: t.card }}>
      <SkeletonBlock height={28} radius={0} />
      <View className="p-4">
        <SkeletonBlock height={22} width={'70%'} />
        <View style={{ height: 8 }} />
        <SkeletonBlock height={12} width={'45%'} />
        <View style={{ height: 16 }} />
        <SkeletonBlock height={7} radius={999} />
        <View style={{ height: 16 }} />
        <SkeletonBlock height={26} width={'55%'} radius={999} />
      </View>
    </View>
  );
}

export default SkeletonBlock;
