import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const router = useRouter();
  const { signIn, demo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos entrar, intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <BackButton />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn delay={60}>
            <Text className="font-display text-5xl uppercase text-cream" style={{ lineHeight: 50, paddingTop: 4 }}>
              De vuelta{'\n'}al <Text className="text-primary">verde</Text>
            </Text>
            <Text className="mb-8 mt-3 font-body text-base text-muted">
              Entrá y cuadrá tu próximo partido, parce.
            </Text>
          </FadeIn>

          <FadeIn delay={160}>
            <Field
              label="Correo"
              icon="mail-outline"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={setPassword}
              toggleSecure
            />

            <ErrorBanner message={error} />

            {demo ? (
              <Text className="mb-4 font-body text-xs text-muted">
                Modo demo: entrá con cualquier correo y contraseña para probar la app.
              </Text>
            ) : null}

            <GlowButton label="Entrar" icon="log-in" loading={loading} onPress={onSubmit} />

            <Pressable onPress={() => router.push('/(auth)/recuperar')} className="mt-4 py-1">
              <Text className="text-center font-body-semibold text-sm text-primary">
                ¿Olvidaste tu contraseña?
              </Text>
            </Pressable>
          </FadeIn>

          <Pressable onPress={() => router.replace('/(auth)/register')} className="mt-6 py-2">
            <Text className="text-center font-body text-sm text-muted">
              ¿No tenés cuenta? <Text className="text-primary">Registrate</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
