import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Chip from '@/components/Chip';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { NIVELES, POSICIONES, type Nivel, type Posicion } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { elegirImagen } from '@/lib/images';

export default function EditarPerfil() {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();

  const [nombre, setNombre] = useState(profile?.nombre ?? '');
  const [ciudad, setCiudad] = useState(profile?.ciudad ?? 'Pereira');
  const [celular, setCelular] = useState(profile?.celular ?? '');
  const [posicion, setPosicion] = useState<Posicion>(profile?.posicion ?? 'Mediocampista');
  const [nivel, setNivel] = useState<Nivel>(profile?.nivel ?? 'Intermedio');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarFoto = async () => {
    const uri = await elegirImagen([1, 1]);
    if (uri) setAvatar(uri);
  };

  const guardar = async () => {
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.');
      return;
    }
    setLoading(true);
    try {
      await updateProfile({ nombre: nombre.trim(), ciudad: ciudad.trim(), celular: celular.trim(), posicion, nivel, avatar_url: avatar });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream">Editar perfil</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FadeIn delay={50} className="mb-5 items-center">
            <Pressable onPress={cambiarFoto} className="rounded-full" style={{ padding: 3, borderWidth: 2, borderColor: Colors.primary }}>
              <Avatar nombre={nombre || '?'} uri={avatar} size={84} />
              <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-accent">
                <Ionicons name="camera" size={13} color={Colors.ink} />
              </View>
            </Pressable>
            <Pressable onPress={cambiarFoto} className="mt-3 flex-row items-center gap-1.5 rounded-full bg-card px-3 py-2">
              <Ionicons name="camera-outline" size={16} color={Colors.primary} />
              <Text className="font-body-semibold text-xs text-primary">Cambiar foto</Text>
            </Pressable>
          </FadeIn>

          <FadeIn delay={120}>
            <Field label="Nombre" icon="person-outline" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
            <Field label="Ciudad" icon="location-outline" value={ciudad} onChangeText={setCiudad} autoCapitalize="words" />
            <Field label="Celular" icon="call-outline" value={celular} onChangeText={setCelular} keyboardType="phone-pad" />

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

            {error ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text className="flex-1 font-body text-sm text-red-300">{error}</Text>
              </View>
            ) : null}

            <GlowButton label="Guardar cambios" variant="primary" icon="checkmark" loading={loading} onPress={guardar} />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
