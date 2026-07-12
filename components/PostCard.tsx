import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import ModeracionBoton from '@/components/ModeracionBoton';
import { useAuth } from '@/lib/auth';
import { tiempoRelativo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import type { Post } from '@/types/database';

const TIPO_META: Record<Post['tipo'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  recap: { label: 'Tu partido', icon: 'football' },
  encuentro: { label: 'Encuentro', icon: 'people' },
  pregunta: { label: 'Pregunta', icon: 'help-circle' },
};

interface PostCardProps {
  post: Post;
  /** Cantidad de comentarios (la pasa el muro para no re-suscribir cada card). */
  comentarios?: number;
}

/** Tarjeta de un post del muro social. Toca para ver el detalle/comentarios. */
export default function PostCard({ post, comentarios = 0 }: PostCardProps) {
  const router = useRouter();
  const c = useTheme();
  const { profile } = useAuth();
  const toggleLike = useStore((s) => s.toggleLike);

  const uid = profile?.id ?? 'demo';
  const liked = post.likes.includes(uid);
  const esRecap = post.tipo === 'recap';
  const meta = TIPO_META[post.tipo];

  const onLike = () => {
    haptics.light();
    toggleLike(post.id, uid);
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      className="mb-4 overflow-hidden rounded-3xl border bg-card"
      style={{ borderColor: esRecap ? c.accent + '66' : c.border }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-4">
        {esRecap ? (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/15">
            <Ionicons name="football" size={22} color={c.accentText} />
          </View>
        ) : (
          <Avatar nombre={post.autor_nombre} uri={post.autor_avatar} size={44} />
        )}
        <View className="flex-1">
          <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
            {post.autor_nombre}
          </Text>
          <Text className="font-body text-xs text-muted">{tiempoRelativo(post.created_at)}</Text>
        </View>
        <View
          className="flex-row items-center gap-1 rounded-full px-3 py-1"
          style={{ backgroundColor: esRecap ? c.accent + '22' : c.background }}>
          <Ionicons name={meta.icon} size={12} color={esRecap ? c.accent : c.primary} />
          <Text
            className="font-body-semibold text-[11px] uppercase tracking-wide"
            style={{ color: esRecap ? c.accent : c.primary }}>
            {meta.label}
          </Text>
        </View>
        <ModeracionBoton
          tipo="post"
          contenidoId={post.id}
          autorId={post.autor_id}
          autorNombre={post.autor_nombre}
          texto={post.texto}
        />
      </View>

      {/* Texto */}
      <Text className="px-4 pt-3 font-body text-[15px] leading-5 text-cream">{post.texto}</Text>

      {/* Foto opcional */}
      {post.foto_url ? (
        <Image
          source={{ uri: post.foto_url }}
          style={{ width: '100%', height: 200, marginTop: 12 }}
          contentFit="cover"
        />
      ) : null}

      {/* CTA calificar para recaps */}
      {esRecap && post.partido_id ? (
        <Pressable
          onPress={() => router.push({ pathname: '/calificar/[id]', params: { id: post.partido_id! } })}
          className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-accent py-2.5 active:opacity-80">
          <Ionicons name="star" size={16} color={c.ink} />
          <Text className="font-body-bold text-sm uppercase text-ink">Calificar el partido</Text>
        </Pressable>
      ) : null}

      {/* Acciones */}
      <View className="mt-3 flex-row items-center gap-5 border-t border-border px-4 py-3">
        <Pressable onPress={onLike} hitSlop={8} className="flex-row items-center gap-1.5">
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? c.danger : c.muted}
          />
          <Text className="font-body-semibold text-sm" style={{ color: liked ? c.danger : c.muted }}>
            {post.likes.length}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="chatbubble-outline" size={18} color={c.muted} />
          <Text className="font-body-semibold text-sm text-muted">{comentarios}</Text>
        </View>
      </View>
    </Pressable>
  );
}
