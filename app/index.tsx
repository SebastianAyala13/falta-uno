import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import { APP } from '@/constants/config';

/** Pantalla de bienvenida / onboarding. */
export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between px-6 pb-8 pt-16">
        {/* Logo + tagline centrados */}
        <View className="flex-1 items-center justify-center">
          <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-primary">
            <Ionicons name="football" size={56} color="#0B0F0D" />
          </View>

          <Text className="font-display text-6xl uppercase leading-none text-cream">Falta</Text>
          <Text className="font-display text-6xl uppercase leading-none text-primary">Uno</Text>

          <Text className="mt-6 max-w-[280px] text-center font-body text-base text-muted">
            {APP.tagline}
          </Text>
        </View>

        {/* Acciones */}
        <View className="gap-3">
          <Button label="Entrar" variant="primary" onPress={() => router.push('/(tabs)')} />
          <Button label="Registrarme" variant="outline" onPress={() => router.push('/register')} />
          <Text className="mt-2 text-center font-body text-xs text-muted">
            Pereira · Risaralda 🇨🇴
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
