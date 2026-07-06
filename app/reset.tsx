import { Ionicons } from '@expo/vector-icons';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { supabase, supabaseConfigurado } from '@/lib/supabase';

/**
 * Pantalla de restablecimiento de contraseña. Se abre desde el enlace del correo
 * (`faltauno://reset#access_token=...&refresh_token=...`). Toma la sesión de
 * recuperación del enlace y permite fijar una nueva contraseña.
 *
 * Requiere registrar `faltauno://reset` en Supabase → Authentication → URL
 * Configuration → Redirect URLs.
 */
export default function Reset() {
  const router = useRouter();
  const url = useURL();

  const [listo, setListo] = useState(false); // sesión de recuperación cargada
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // Extrae los tokens del enlace y arma la sesión de recuperación
  useEffect(() => {
    if (!url || !supabaseConfigurado) return;
    const frag = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
    if (!frag) return;
    const params = new URLSearchParams(frag);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(() => setListo(true))
        .catch(() => setError('El enlace expiró o no es válido. Pedí uno nuevo.'));
    }
  }, [url]);

  const guardar = async () => {
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== password2) return setError('Las contraseñas no coinciden.');
    setError(null);
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw new Error('No pudimos actualizar la contraseña. Probá de nuevo.');
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FadeIn delay={40}>
            <Text className="font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 4 }}>
              Nueva{'\n'}contraseña
            </Text>
          </FadeIn>

          {ok ? (
            <FadeIn delay={40}>
              <View className="mt-6 items-center rounded-md border border-primary/40 bg-primary/10 px-5 py-8">
                <Ionicons name="checkmark-circle" size={44} color={Colors.primary} />
                <Text className="mt-3 text-center font-body-bold text-base text-cream">¡Contraseña actualizada!</Text>
                <View className="mt-5 w-full">
                  <GlowButton label="Entrar a la app" icon="log-in" onPress={() => router.replace('/(tabs)')} />
                </View>
              </View>
            </FadeIn>
          ) : (
            <FadeIn delay={120}>
              <Text className="mb-6 mt-3 font-body text-base text-muted">
                Elegí una nueva contraseña para tu cuenta.
              </Text>

              {!supabaseConfigurado ? (
                <Text className="mb-4 font-body text-sm text-muted">
                  Esta pantalla necesita Supabase conectado para funcionar.
                </Text>
              ) : !listo ? (
                <Text className="mb-4 font-body text-sm text-muted">
                  Abrí esta pantalla desde el enlace que te llegó al correo.
                </Text>
              ) : null}

              <Field label="Nueva contraseña" icon="lock-closed-outline" placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} toggleSecure />
              <Field label="Repetí la contraseña" icon="lock-closed-outline" placeholder="Otra vez" value={password2} onChangeText={setPassword2} toggleSecure />

              {error ? (
                <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text className="flex-1 font-body text-sm text-red-300">{error}</Text>
                </View>
              ) : null}

              <GlowButton label="Guardar contraseña" icon="save" loading={loading} onPress={guardar} disabled={!listo} />
            </FadeIn>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
