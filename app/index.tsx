import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

const { width } = Dimensions.get('window');

export default function Index() {
  const { profile, loading } = useAuth();
  const [ready, setReady] = useState(false);

  // El balón rueda desde la izquierda, gira y da un rebotecito
  const x = useSharedValue(-width * 0.7);
  const rot = useSharedValue(0);
  const ballY = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(14);

  useEffect(() => {
    // rodada rápida hacia el centro
    x.value = withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) });
    rot.value = withTiming(720, { duration: 720, easing: Easing.out(Easing.cubic) });
    // rebotecito al frenar
    ballY.value = withDelay(
      560,
      withSequence(
        withTiming(-22, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 180, easing: Easing.bounce }),
      ),
    );
    // el wordmark aparece detrás del balón
    textOpacity.value = withDelay(560, withTiming(1, { duration: 420 }));
    textY.value = withDelay(560, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));

    // tiempo mínimo para que se vea la animación, aunque la sesión cargue antes
    const t = setTimeout(() => setReady(true), 1050);
    return () => clearTimeout(t);
  }, [x, rot, ballY, textOpacity, textY]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: ballY.value },
      { rotate: `${rot.value}deg` },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  // Cuando ya cargó la sesión Y terminó la animación, navegamos
  if (!loading && ready) {
    return <Redirect href={profile ? '/(tabs)' : '/(auth)/welcome'} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <LinearGradient colors={['#0B0F0D', '#0C1712', '#0B0F0D']} style={{ position: 'absolute', inset: 0 }} />
      <View
        pointerEvents="none"
        className="absolute rounded-full"
        style={{ width: 360, height: 360, backgroundColor: Colors.primary, opacity: 0.1 }}
      />

      <Animated.View
        style={[
          ballStyle,
          {
            height: 104,
            width: 104,
            borderRadius: 52,
            backgroundColor: Colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: Colors.primary,
            shadowOpacity: 0.6,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}>
        <Ionicons name="football" size={64} color={Colors.background} />
      </Animated.View>

      <Animated.View style={[textStyle, { alignItems: 'center', marginTop: 26 }]}>
        <Text className="font-display text-5xl uppercase leading-none text-cream">Falta</Text>
        <Text className="font-display text-5xl uppercase leading-none text-primary">Uno</Text>
      </Animated.View>
    </View>
  );
}
