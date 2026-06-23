import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { APP, NIVELES, POSICIONES, type Nivel, type Posicion } from '@/constants/config';
import { useAuth } from '@/lib/auth';

export default function Register() {
  const router = useRouter();
  const { signUp, demo } = useAuth();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ciudad, setCiudad] = useState<string>(APP.defaultCity);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valido = nombre && email && posicion && nivel && password.length >= 6;

  const onSubmit = async () => {
    setError(null);
    if (!valido) {
      setError('Completá nombre, correo, posición, nivel y una contraseña de 6+ caracteres.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        ciudad,
        posicion: posicion!,
        nivel: nivel!,
        celular: celular.trim(),
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream">Armá tu perfil</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FadeIn delay={60}>
            <Text className="mb-6 font-body text-sm text-muted">
              Contanos cómo jugás. Así te cuadramos con los partidos que van con vos.
            </Text>

            <Field label="Nombre" icon="person-outline" placeholder="Tu nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
            <Field label="Correo" icon="mail-outline" placeholder="tucorreo@ejemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Ciudad" icon="location-outline" placeholder="Pereira" value={ciudad} onChangeText={setCiudad} autoCapitalize="words" />
          </FadeIn>

          <FadeIn delay={140}>
            <Text className="mb-2 font-body-semibold text-sm text-cream">Posición</Text>
            <View className="mb-4 flex-row flex-wrap">
              {POSICIONES.map((p) => (
                <Chip key={p} label={p} selected={posicion === p} onPress={() => setPosicion(p)} />
              ))}
            </View>

            <Text className="mb-2 font-body-semibold text-sm text-cream">Nivel</Text>
            <View className="mb-4 flex-row flex-wrap">
              {NIVELES.map((n) => (
                <Chip key={n} label={n} selected={nivel === n} onPress={() => setNivel(n)} />
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={220}>
            <Field label="Número de celular" icon="call-outline" placeholder="+57 3xx xxx xxxx" value={celular} onChangeText={setCelular} keyboardType="phone-pad" />
            <Field label="Contraseña" icon="lock-closed-outline" placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} toggleSecure />

            {error ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text className="flex-1 font-body text-sm text-red-300">{error}</Text>
              </View>
            ) : null}

            {demo ? (
              <Text className="mb-4 font-body text-xs text-muted">
                Modo demo: tu perfil se guarda en el dispositivo. Con Supabase conectado se crea la cuenta real.
              </Text>
            ) : null}

            <GlowButton label="Crear cuenta" variant="accent" icon="rocket" loading={loading} onPress={onSubmit} />
          </FadeIn>

          <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-6 py-2">
            <Text className="text-center font-body text-sm text-muted">
              ¿Ya tenés cuenta? <Text className="text-primary">Entrá acá</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
