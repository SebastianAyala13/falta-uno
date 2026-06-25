import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAuth } from '@/lib/auth';

const LOGO = require('../assets/brand/logo.png');

/**
 * Splash de marca: el logo entra con un "pop", un halo de luz late detrás y
 * todo se asienta en ~1.1s. Luego redirige según haya sesión.
 */
export default function Index() {
  const { profile, loading } = useAuth();
  const [done, setDone] = useState(false);

  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const glow = useSharedValue(0.35);
  const ring = useSharedValue(0);

  useEffect(() => {
    // entrada del logo con overshoot
    logoOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.06, { duration: 460, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    // halo que late
    glow.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    // onda que se expande una vez
    ring.value = withDelay(150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));

    const t = setTimeout(() => setDone(true), 1150);
    return () => clearTimeout(t);
  }, [glow, logoOpacity, logoScale, ring]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.9 + glow.value * 0.25 }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.5,
    transform: [{ scale: 0.6 + ring.value * 1.1 }],
  }));

  if (done && !loading) {
    return <Redirect href={profile ? '/(tabs)' : '/(auth)/welcome'} />;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F0D' }}>
      <LinearGradient colors={['#0B0F0D', '#0C1712', '#0B0F0D']} style={{ position: 'absolute', inset: 0 }} />

      {/* Halo de luz que late */}
      <Animated.View
        pointerEvents="none"
        style={[glowStyle, { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: '#10B981', opacity: 0.4 }]}
      />
      {/* Onda de acento que se expande */}
      <Animated.View
        pointerEvents="none"
        style={[ringStyle, { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 2, borderColor: '#C6FF3D' }]}
      />

      <Animated.View style={logoStyle}>
        <Image source={LOGO} style={{ width: 230, height: 230 }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
