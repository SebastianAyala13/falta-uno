import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Chip from '@/components/Chip';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { APP, NIVELES, POSICIONES, URL_PRIVACIDAD, URL_TERMINOS, type Nivel, type Posicion } from '@/constants/config';
import { useAuth } from '@/lib/auth';

export default function Register() {
  const router = useRouter();
  const { signUp, demo } = useAuth();

  const [tipoCuenta, setTipoCuenta] = useState<'jugador' | 'cancha'>('jugador');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ciudad, setCiudad] = useState<string>(APP.defaultCity);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [nivel, setNivel] = useState<Nivel | null>(null);
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const esCancha = tipoCuenta === 'cancha';
  // Para dueños de cancha, posición/nivel de juego son opcionales.
  const valido = nombre && email && password.length >= 6 && acepta && (esCancha || (posicion && nivel));

  const onSubmit = async () => {
    setError(null);
    if (!nombre || !email || password.length < 6) {
      setError('Completá nombre, correo y una contraseña de 6+ caracteres.');
      return;
    }
    if (!esCancha && (!posicion || !nivel)) {
      setError('Elegí tu posición y nivel de juego.');
      return;
    }
    if (!acepta) {
      setError('Para crear tu cuenta tenés que aceptar los Términos y la Política de Privacidad.');
      return;
    }
    setLoading(true);
    try {
      const res = await signUp({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        ciudad,
        posicion: posicion ?? 'Mediocampista',
        nivel: nivel ?? 'Casual',
        celular: celular.trim(),
        roles: esCancha ? ['jugador', 'cancha'] : ['jugador'],
      });
      if (res.needsConfirmation) {
        Alert.alert(
          'Revisá tu correo 📩',
          'Te enviamos un enlace para confirmar tu cuenta. Confirmalo y entrá con tu correo y contraseña.',
          [{ text: 'Ir a entrar', onPress: () => router.replace('/(auth)/login') }],
        );
      } else {
        router.replace(esCancha ? '/cancha/editar' : '/(tabs)');
      }
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
            {/* Tipo de cuenta: jugador o dueño de cancha */}
            <Text className="mb-2 font-body-semibold text-sm text-cream">¿Cómo te registrás?</Text>
            <View className="mb-5 flex-row gap-3">
              {[
                { key: 'jugador' as const, label: 'Soy jugador', icon: 'football' as const, hint: 'Buscá y armá partidos' },
                { key: 'cancha' as const, label: 'Tengo una cancha', icon: 'business' as const, hint: 'Recibí reservas y cobrá' },
              ].map((t) => {
                const activo = tipoCuenta === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTipoCuenta(t.key)}
                    className="flex-1 rounded-2xl border p-3"
                    style={{
                      backgroundColor: activo ? Colors.primary + '1A' : Colors.card,
                      borderColor: activo ? Colors.primary : Colors.border,
                    }}>
                    <Ionicons name={t.icon} size={22} color={activo ? Colors.primary : Colors.muted} />
                    <Text className="mt-1.5 font-body-bold text-sm" style={{ color: activo ? Colors.primary : Colors.cream }}>
                      {t.label}
                    </Text>
                    <Text className="font-body text-xs text-muted">{t.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-6 font-body text-sm text-muted">
              {esCancha
                ? 'Creá tu cuenta y en el siguiente paso registrás tu cancha (fotos, horarios y precios).'
                : 'Contanos cómo jugás. Así te cuadramos con los partidos que van con vos.'}
            </Text>

            <Field label="Nombre" icon="person-outline" placeholder={esCancha ? 'Tu nombre o el de la cancha' : 'Tu nombre'} value={nombre} onChangeText={setNombre} autoCapitalize="words" />
            <Field label="Correo" icon="mail-outline" placeholder="tucorreo@ejemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Ciudad" icon="location-outline" placeholder="Pereira" value={ciudad} onChangeText={setCiudad} autoCapitalize="words" />
          </FadeIn>

          {!esCancha ? (
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
          ) : null}

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

            {/* Aceptación de Términos / EULA — requisito App Store 1.2 y Google Play */}
            <Pressable
              onPress={() => setAcepta((v) => !v)}
              className="mb-2 flex-row items-start gap-3 rounded-2xl border border-border bg-card p-3.5 active:border-primary/50">
              <View
                className="mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2"
                style={{
                  borderColor: acepta ? Colors.primary : Colors.border,
                  backgroundColor: acepta ? Colors.primary : 'transparent',
                }}>
                {acepta ? <Ionicons name="checkmark" size={16} color={Colors.ink} /> : null}
              </View>
              <Text className="flex-1 font-body text-sm text-cream">
                Acepto los{' '}
                <Text className="text-primary" onPress={() => Linking.openURL(URL_TERMINOS).catch(() => {})}>
                  Términos
                </Text>{' '}
                y <Text className="font-body-semibold">autorizo el tratamiento de mis datos personales</Text> conforme a la{' '}
                <Text className="text-primary" onPress={() => Linking.openURL(URL_PRIVACIDAD).catch(() => {})}>
                  Política de Privacidad
                </Text>{' '}
                (Ley 1581 de 2012). Entiendo que Falta Uno tiene tolerancia cero con el contenido objetable y el acoso.
              </Text>
            </Pressable>

            <GlowButton label="Crear cuenta" variant="accent" icon="rocket" loading={loading} onPress={onSubmit} disabled={!acepta} />
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
