import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { elegirImagen } from '@/lib/images';
import { MENSAJE_BLOQUEO_FILTRO, contieneContenidoObjetable } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import type { PostTipo } from '@/types/database';

const TIPOS: { key: Exclude<PostTipo, 'recap'>; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'encuentro', label: 'Encuentro', icon: 'people', hint: 'Contá cómo estuvo un partido' },
  { key: 'pregunta', label: 'Pregunta', icon: 'help-circle', hint: 'Resolvé una duda futbolera' },
];

export default function CrearPost() {
  const router = useRouter();
  const { profile } = useAuth();
  const crearPost = useStore((s) => s.crearPost);

  const [tipo, setTipo] = useState<Exclude<PostTipo, 'recap'>>('encuentro');
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);

  const agregarFoto = async () => {
    const uri = await elegirImagen([4, 3]);
    if (uri) setFoto(uri);
  };

  const [publicando, setPublicando] = useState(false);

  const publicar = async () => {
    if (!texto.trim()) return;
    if (contieneContenidoObjetable(texto)) {
      Alert.alert('Revisá tu publicación', MENSAJE_BLOQUEO_FILTRO);
      return;
    }
    setPublicando(true);
    try {
      await crearPost(
        { tipo, texto, foto_url: foto },
        { id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos', avatar_url: profile?.avatar_url },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo publicar', e instanceof Error ? e.message : 'Probá de nuevo, parce.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Screen edges={['top']} glow={false}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Pressable onPress={() => router.back()} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="close" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-xl uppercase text-cream">Nuevo post</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Tipo */}
          <View className="mb-4 flex-row gap-3">
            {TIPOS.map((t) => {
              const activo = tipo === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTipo(t.key)}
                  className="flex-1 rounded-2xl border p-3"
                  style={{
                    backgroundColor: activo ? Colors.primary + '1A' : Colors.card,
                    borderColor: activo ? Colors.primary : Colors.border,
                  }}>
                  <Ionicons name={t.icon} size={20} color={activo ? Colors.primary : Colors.muted} />
                  <Text className="mt-1.5 font-body-bold text-sm" style={{ color: activo ? Colors.primary : Colors.cream }}>
                    {t.label}
                  </Text>
                  <Text className="font-body text-xs text-muted">{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Texto */}
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={tipo === 'pregunta' ? '¿Qué querés preguntarle al parche?' : 'Contá cómo estuvo el partido…'}
            placeholderTextColor={Colors.muted}
            multiline
            autoFocus
            className="min-h-32 rounded-2xl border border-border bg-card p-4 font-body text-base text-cream"
            style={{ textAlignVertical: 'top' }}
          />

          {/* Foto */}
          {foto ? (
            <View className="mt-3 overflow-hidden rounded-2xl">
              <Image source={{ uri: foto }} style={{ width: '100%', height: 200 }} contentFit="cover" />
              <Pressable
                onPress={() => setFoto(null)}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60">
                <Ionicons name="trash" size={16} color={Colors.cream} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={agregarFoto}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-3.5 active:border-primary/50">
              <Ionicons name="image-outline" size={20} color={Colors.muted} />
              <Text className="font-body text-sm text-muted">Agregar foto (opcional)</Text>
            </Pressable>
          )}

          <View className="mt-5">
            <GlowButton label="Publicar" variant="accent" icon="send" onPress={publicar} loading={publicando} disabled={!texto.trim()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
