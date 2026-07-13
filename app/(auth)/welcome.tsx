import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

export default function Welcome() {
  const router = useRouter();
  const { signInAsGuest } = useAuth();
  const c = useTheme();

  const entrarComoInvitado = async () => {
    haptics.tap();
    await signInAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 justify-between px-6 pb-6 pt-10">
        {/* Marca */}
        <FadeIn delay={80} className="flex-1 justify-center">
          <View
            className="self-center overflow-hidden rounded-lg border border-border"
            style={{
              backgroundColor: c.background,
              boxShadow: `0px 0px 30px ${c.primary}66`,
            }}>
            <Image source={require('../../assets/brand/logo.png')} style={{ width: 260, height: 260 }} contentFit="contain" />
          </View>
          <View className="mt-4 self-center rounded-full bg-accent px-4 py-1.5">
            <Text className="font-body-bold text-xs uppercase tracking-wider text-ink">
              Pereira · Risaralda
            </Text>
          </View>

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
        colors={['transparent', c.background]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, pointerEvents: 'none' }}
      />
    </Screen>
  );
}

function Feature({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const c = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-sm bg-primary/15">
        <Ionicons name={icon} size={18} color={c.primary} />
      </View>
      <Text className="font-body text-sm text-cream">{text}</Text>
    </View>
  );
}
