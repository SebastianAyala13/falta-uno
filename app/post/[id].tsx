import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import Avatar from '@/components/Avatar';
import { BackButton, ScreenHeader } from '@/components/BackButton';
import ModeracionBoton from '@/components/ModeracionBoton';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { tiempoRelativo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { MENSAJE_BLOQUEO_FILTRO, contieneContenidoObjetable } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import type { Comentario } from '@/types/database';

export default function PostDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();

  const post = useStore((s) => s.posts.find((p) => p.id === id));
  const comentariosRaw = useStore(useShallow((s) => s.getComentarios(id)));
  const bloqueados = useStore((s) => s.bloqueados);
  const comentarios = comentariosRaw.filter((com) => !bloqueados.includes(com.autor_id));
  const toggleLike = useStore((s) => s.toggleLike);
  const comentar = useStore((s) => s.comentar);

  const [texto, setTexto] = useState('');
  const uid = profile?.id ?? 'demo';

  if (!post) {
    return (
      <Screen edges={['top']}>
        <View className="flex-row items-center px-4 pt-1">
          <BackButton />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="font-body text-sm text-muted">Este post ya no existe, parce.</Text>
        </View>
      </Screen>
    );
  }

  const liked = post.likes.includes(uid);
  const esRecap = post.tipo === 'recap';

  const enviar = () => {
    if (!texto.trim()) return;
    if (contieneContenidoObjetable(texto)) {
      Alert.alert('Revisá tu comentario', MENSAJE_BLOQUEO_FILTRO);
      return;
    }
    comentar(id, { id: uid, nombre: profile?.nombre ?? 'Vos', avatar_url: profile?.avatar_url }, texto);
    setTexto('');
  };

  const onLike = () => {
    haptics.light();
    toggleLike(post.id, uid);
  };

  return (
    <Screen edges={['top']} glow={false}>
      {/* Header */}
      <ScreenHeader
        title="Publicación"
        titleSize="xl"
        borderBottom
        backClassName="mr-2"
        className="px-4 pb-3 pt-1"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        className="flex-1">
        <FlatList
          data={comentarios}
          keyExtractor={(com: Comentario) => com.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="mb-2 rounded-lg border bg-card p-4" style={{ borderColor: esRecap ? c.accent + '66' : c.border }}>
              <View className="flex-row items-center gap-3">
                {esRecap ? (
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
                    <Ionicons name="football" size={22} color={c.accentText} />
                  </View>
                ) : (
                  <Avatar nombre={post.autor_nombre} uri={post.autor_avatar} size={44} />
                )}
                <View className="flex-1">
                  <Text className="font-body-bold text-base text-cream">{post.autor_nombre}</Text>
                  <Text className="font-body text-xs text-muted">{tiempoRelativo(post.created_at)}</Text>
                </View>
                <ModeracionBoton
                  tipo="post"
                  contenidoId={post.id}
                  autorId={post.autor_id}
                  autorNombre={post.autor_nombre}
                  texto={post.texto}
                />
              </View>

              <Text className="mt-3 font-body text-[15px] leading-5 text-cream">{post.texto}</Text>

              {post.foto_url ? (
                <Image source={{ uri: post.foto_url }} style={{ width: '100%', height: 200, marginTop: 12, borderRadius: 16 }} contentFit="cover" />
              ) : null}

              {esRecap && post.partido_id ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/calificar/[id]', params: { id: post.partido_id! } })}
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-sm bg-accent py-2.5 active:opacity-80">
                  <Ionicons name="star" size={16} color={c.ink} />
                  <Text className="font-body-bold text-sm uppercase text-ink">Calificar el partido</Text>
                </Pressable>
              ) : null}

              <View className="mt-3 flex-row items-center gap-5 border-t border-border pt-3">
                <Pressable onPress={onLike} hitSlop={8} className="flex-row items-center gap-1.5">
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? c.danger : c.muted} />
                  <Text className="font-body-semibold text-sm" style={{ color: liked ? c.danger : c.muted }}>
                    {post.likes.length}
                  </Text>
                </Pressable>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="chatbubble-outline" size={18} color={c.muted} />
                  <Text className="font-body-semibold text-sm text-muted">{comentarios.length}</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="mt-10 items-center">
              <Text className="text-center font-body text-sm text-muted">
                Sé el primero en comentar, parce 💬
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-2 flex-row gap-2 px-1">
              <Avatar nombre={item.autor_nombre} size={32} />
              <View className="flex-1 rounded-md border border-border bg-card px-3.5 py-2.5">
                <View className="flex-row items-center justify-between">
                  <Text className="font-body-semibold text-xs text-primary">{item.autor_nombre}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-body text-[10px] text-muted">{tiempoRelativo(item.created_at)}</Text>
                    <ModeracionBoton
                      tipo="comentario"
                      contenidoId={item.id}
                      autorId={item.autor_id}
                      autorNombre={item.autor_nombre}
                      texto={item.texto}
                      size={15}
                    />
                  </View>
                </View>
                <Text className="mt-0.5 font-body text-[15px] text-cream">{item.texto}</Text>
              </View>
            </View>
          )}
        />

        {/* Input */}
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card">
          <View className="flex-row items-end gap-2 px-3 py-2">
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Escribí un comentario…"
              placeholderTextColor={c.muted}
              multiline
              className="max-h-28 flex-1 rounded-sm border border-border bg-background px-4 py-3 font-body text-base text-cream"
            />
            <Pressable
              onPress={enviar}
              disabled={!texto.trim()}
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: texto.trim() ? c.primary : c.border }}>
              <Ionicons name="send" size={18} color={texto.trim() ? c.ink : c.muted} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
