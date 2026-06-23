import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { APP } from '@/constants/config';
import { useAuth } from '@/lib/auth';

export default function Welcome() {
  const router = useRouter();
  const { signInAsGuest } = useAuth();

  const entrarComoInvitado = async () => {
    await signInAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 justify-between px-6 pb-6 pt-10">
        {/* Marca */}
        <FadeIn delay={80} className="flex-1 justify-center">
          <View
            className="mb-7 h-24 w-24 items-center justify-center rounded-[28px] bg-primary"
            style={{
              shadowColor: Colors.primary,
              shadowOpacity: 0.6,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 0 },
            }}>
            <Ionicons name="football" size={54} color={Colors.background} />
          </View>

          <Text className="font-display text-7xl uppercase leading-[0.92] text-cream">Falta</Text>
          <View className="flex-row items-end">
            <Text className="font-display text-7xl uppercase leading-[0.92] text-primary">Uno</Text>
            <View className="mb-3 ml-3 rounded-full bg-accent px-3 py-1">
              <Text className="font-body-bold text-[10px] uppercase tracking-wider text-background">
                Pereira
              </Text>
            </View>
          </View>

          <Text className="mt-5 max-w-[300px] font-body text-lg leading-6 text-muted">
            {APP.tagline}
          </Text>

          {/* Mini features */}
          <View className="mt-8 gap-3">
            <Feature icon="search" text="Encontrá partidos cerca de vos" />
            <Feature icon="people" text="Cuadrá la llave en segundos" />
            <Feature icon="shield-checkmark" text="Pagás seguro desde la app" />
          </View>
        </FadeIn>

        {/* Acciones */}
        <FadeIn delay={260} className="gap-3">
          <GlowButton
            label="Crear cuenta"
            variant="accent"
            icon="rocket"
            onPress={() => router.push('/(auth)/register')}
          />
          <GlowButton
            label="Ya tengo cuenta"
            variant="outline"
            onPress={() => router.push('/(auth)/login')}
          />
          <Pressable onPress={entrarComoInvitado} className="mt-1 py-2">
            <Text className="text-center font-body-semibold text-sm text-muted">
              Echar un vistazo como{' '}
              <Text className="text-primary">invitado →</Text>
            </Text>
          </Pressable>
        </FadeIn>
      </View>

      <LinearGradient
        colors={['transparent', '#0B0F0D']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
        pointerEvents="none"
      />
    </Screen>
  );
}

function Feature({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <Text className="font-body text-sm text-cream">{text}</Text>
    </View>
  );
}
