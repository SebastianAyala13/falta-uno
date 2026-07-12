import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Duration, MotionEasing } from '@/constants/motion';
import { useAuth } from '@/lib/auth';

const LOGO = require('../assets/brand/logo.png');

/**
 * Splash de marca. El logo (que ya viene sobre Negro Tribuna) se funde sobre el
 * mismo fondo, así sus bordes desaparecen y se siente natural: fade + un leve
 * "respiro" de escala. Rápido (~1s) y luego redirige según haya sesión.
 */
export default function Index() {
  const { profile, loading } = useAuth();
  const [done, setDone] = useState(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(1.08);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: Duration.slow, easing: MotionEasing.entrance });
    scale.value = withTiming(1, { duration: Duration.grand, easing: MotionEasing.entrance });
    const t = setTimeout(() => setDone(true), 1150); // Duration.grand + 50
    return () => clearTimeout(t);
  }, [opacity, scale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (done && !loading) {
    return <Redirect href={profile ? '/(tabs)' : '/(auth)/welcome'} />;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F0D' }}>
      <Animated.View style={logoStyle}>
        <Image source={LOGO} style={{ width: 300, height: 300 }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
