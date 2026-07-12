import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

export default function Recuperar() {
  const router = useRouter();
  const { resetPassword, demo } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Escribí tu correo, parce.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos enviar el correo, intentá de nuevo.');
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
            <Text className="font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 4 }}>
              Recuperar{'\n'}contraseña
            </Text>
            <Text className="mb-8 mt-3 font-body text-base text-muted">
              Te mandamos un enlace a tu correo para crear una nueva.
            </Text>
          </FadeIn>

          {enviado ? (
            <FadeIn delay={40}>
              <View className="items-center rounded-md border border-primary/40 bg-primary/10 px-5 py-8">
                <Ionicons name="mail-open-outline" size={40} color={Colors.primary} />
                <Text className="mt-3 text-center font-body-bold text-base text-cream">
                  ¡Revisá tu correo!
                </Text>
                <Text className="mt-1 text-center font-body text-sm text-muted">
                  Si {email.trim()} tiene cuenta, te llegó el enlace para restablecerla.
                </Text>
                <View className="mt-5 w-full">
                  <GlowButton label="Volver al login" icon="arrow-back" variant="outline" onPress={() => router.replace('/(auth)/login')} />
                </View>
              </View>
            </FadeIn>
          ) : (
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

              <ErrorBanner message={error} />

              {demo ? (
                <Text className="mb-4 font-body text-xs text-muted">
                  Modo demo: el envío de correo se activa al conectar Supabase.
                </Text>
              ) : null}

              <GlowButton label="Enviar enlace" icon="paper-plane" loading={loading} onPress={onSubmit} />
            </FadeIn>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
