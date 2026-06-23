import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn delay={60}>
            <Text className="font-display text-5xl uppercase leading-[0.95] text-cream">
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

            {error ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text className="flex-1 font-body text-sm text-red-300">{error}</Text>
              </View>
            ) : null}

            {demo ? (
              <Text className="mb-4 font-body text-xs text-muted">
                Modo demo: entrá con cualquier correo y contraseña para probar la app.
              </Text>
            ) : null}

            <GlowButton label="Entrar" icon="log-in" loading={loading} onPress={onSubmit} />
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
