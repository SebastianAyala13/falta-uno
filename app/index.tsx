import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { profile, loading } = useAuth();

  const logoScale = useSharedValue(0.6);
  const logoGlow = useSharedValue(0.4);
  const textY = useSharedValue(20);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.6)) });
    logoGlow.value = withRepeat(withSequence(withTiming(1, { duration: 1100 }), withTiming(0.4, { duration: 1100 })), -1);
    textOpacity.value = withDelay(380, withTiming(1, { duration: 600 }));
    textY.value = withDelay(380, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [logoGlow, logoScale, textOpacity, textY]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    shadowOpacity: logoGlow.value,
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  // Cuando termina de cargar la sesión, redirigimos
  if (!loading) {
    return <Redirect href={profile ? '/(tabs)' : '/(auth)/welcome'} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <LinearGradient colors={['#0B0F0D', '#0C1712', '#0B0F0D']} style={{ position: 'absolute', inset: 0 }} />
      <View
        pointerEvents="none"
        className="absolute rounded-full"
        style={{ width: 360, height: 360, backgroundColor: Colors.primary, opacity: 0.12 }}
      />

      <Animated.View
        style={[
          logoStyle,
          {
            height: 104,
            width: 104,
            borderRadius: 32,
            backgroundColor: Colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: Colors.primary,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}>
        <Ionicons name="football" size={60} color={Colors.background} />
      </Animated.View>

      <Animated.View style={[textStyle, { alignItems: 'center', marginTop: 24 }]}>
        <Text className="font-display text-5xl uppercase leading-none text-cream">Falta</Text>
        <Text className="font-display text-5xl uppercase leading-none text-primary">Uno</Text>
      </Animated.View>
    </View>
  );
}
