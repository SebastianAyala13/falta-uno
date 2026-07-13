import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { elegirImagen } from '@/lib/images';
import { MENSAJE_BLOQUEO_FILTRO, contieneContenidoObjetable } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import type { PostTipo } from '@/types/database';

const TIPOS: { key: Exclude<PostTipo, 'recap'>; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'encuentro', label: 'Encuentro', icon: 'people', hint: 'Contá cómo estuvo un partido' },
  { key: 'pregunta', label: 'Pregunta', icon: 'help-circle', hint: 'Resolvé una duda futbolera' },
];

export default function CrearPost() {
  const router = useRouter();
  const { profile } = useAuth();
  const crearPost = useStore((s) => s.crearPost);
  const c = useTheme();

  const [tipo, setTipo] = useState<Exclude<PostTipo, 'recap'>>('encuentro');
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregarFoto = async () => {
    haptics.tap();
    const uri = await elegirImagen([4, 3]);
    if (uri) setFoto(uri);
  };

  const [publicando, setPublicando] = useState(false);

  const publicar = async () => {
    if (!texto.trim()) return;
    if (contieneContenidoObjetable(texto)) {
      setError(MENSAJE_BLOQUEO_FILTRO);
      return;
    }
    setError(null);
    setPublicando(true);
    try {
      await crearPost(
        { tipo, texto, foto_url: foto },
        { id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos', avatar_url: profile?.avatar_url },
      );
      haptics.success();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos publicar tu post. Probá de nuevo, parce.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Screen edges={['top']} glow={false}>
      {/* Header */}
      <ScreenHeader
        title="Nuevo post"
        titleSize="xl"
        backIcon="close"
        titleAlign="center"
        className="px-4 pb-2 pt-1"
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Tipo */}
          <FadeIn delay={40}>
            <View className="mb-4 flex-row gap-3">
              {TIPOS.map((t) => {
                const activo = tipo === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => { haptics.select(); setTipo(t.key); }}
                    className="flex-1 rounded-md border p-3"
                    style={{
                      backgroundColor: activo ? c.primary + '1A' : c.card,
                      borderColor: activo ? c.primary : c.border,
                    }}>
                    <Ionicons name={t.icon} size={20} color={activo ? c.primary : c.muted} />
                    <Text className="mt-1.5 font-body-bold text-sm" style={{ color: activo ? c.primary : c.cream }}>
                      {t.label}
                    </Text>
                    <Text className="font-body text-xs text-muted">{t.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          {/* Texto */}
          <FadeIn delay={90}>
            <TextInput
              value={texto}
              onChangeText={(t) => { setTexto(t); if (error) setError(null); }}
              placeholder={tipo === 'pregunta' ? '¿Qué querés preguntarle al parche?' : 'Contá cómo estuvo el partido…'}
              placeholderTextColor={c.muted}
              multiline
              autoFocus
              className="min-h-32 rounded-sm border border-border bg-card p-4 font-body text-base text-cream"
              style={{ textAlignVertical: 'top' }}
            />
          </FadeIn>

          {/* Foto */}
          <FadeIn delay={140}>
            {foto ? (
              <View className="mt-3 overflow-hidden rounded-lg">
                <Image source={{ uri: foto }} style={{ width: '100%', height: 200 }} contentFit="cover" />
                <Pressable
                  onPress={() => { haptics.tap(); setFoto(null); }}
                  className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60">
                  <Ionicons name="trash" size={16} color={c.cream} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={agregarFoto}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card py-3.5 active:border-primary/50">
                <Ionicons name="image-outline" size={20} color={c.muted} />
                <Text className="font-body text-sm text-muted">Agregar foto (opcional)</Text>
              </Pressable>
            )}
          </FadeIn>

          <ErrorBanner message={error} className="mt-4" />

          <FadeIn delay={190}>
            <View className="mt-5">
              <GlowButton label="Publicar" variant="accent" icon="send" onPress={publicar} loading={publicando} disabled={!texto.trim()} />
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
