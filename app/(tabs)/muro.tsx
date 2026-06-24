import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import FadeIn from '@/components/FadeIn';
import PostCard from '@/components/PostCard';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import type { Post } from '@/types/database';

type Filtro = 'todos' | 'encuentro' | 'pregunta';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'encuentro', label: 'Encuentros' },
  { key: 'pregunta', label: 'Preguntas' },
];

export default function Muro() {
  const router = useRouter();
  const { profile } = useAuth();

  const posts = useStore((s) => s.posts);
  const comentarios = useStore((s) => s.comentarios);
  const generarRecaps = useStore((s) => s.generarRecapsPendientes);

  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Auto-post: al entrar, genera recaps de partidos que ya terminaron
  useEffect(() => {
    generarRecaps(profile?.id ?? 'demo', new Date().toISOString());
  }, [generarRecaps, profile?.id]);

  const visibles = useMemo(() => {
    if (filtro === 'todos') return posts;
    // los recaps cuentan como "encuentros"
    if (filtro === 'encuentro') return posts.filter((p) => p.tipo === 'encuentro' || p.tipo === 'recap');
    return posts.filter((p) => p.tipo === filtro);
  }, [posts, filtro]);

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <FadeIn delay={40}>
        <View className="px-6 pb-2 pt-2">
          <Text className="font-display text-4xl uppercase text-cream">El Muro</Text>
          <Text className="mt-1 font-body text-sm text-muted">Lo que se cuece en la cancha, parce.</Text>
        </View>
      </FadeIn>

      {/* Compositor */}
      <FadeIn delay={100}>
        <Pressable
          onPress={() => router.push('/crear-post')}
          className="mx-6 mb-3 mt-2 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:border-primary/50">
          <Avatar nombre={profile?.nombre ?? 'Vos'} uri={profile?.avatar_url} size={36} />
          <Text className="flex-1 font-body text-sm text-muted">¿Qué se cuenta, parce?</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Ionicons name="add" size={20} color={Colors.ink} />
          </View>
        </Pressable>
      </FadeIn>

      {/* Filtros */}
      <View className="mb-1 flex-row gap-2 px-6 pb-2">
        {FILTROS.map((f) => {
          const activo = filtro === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFiltro(f.key)}
              className="rounded-full border px-4 py-1.5"
              style={{
                backgroundColor: activo ? Colors.primary : Colors.card,
                borderColor: activo ? Colors.primary : Colors.border,
              }}>
              <Text
                className="font-body-semibold text-sm"
                style={{ color: activo ? Colors.ink : Colors.cream }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(p: Post) => p.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PostCard post={item} comentarios={(comentarios[item.id] ?? []).length} />
        )}
        ListEmptyComponent={
          <View className="mt-24 items-center">
            <Ionicons name="newspaper-outline" size={40} color={Colors.muted} />
            <Text className="mt-3 text-center font-body text-sm text-muted">
              Todavía no hay nada por acá.{'\n'}¡Estrená el muro, parce! ⚽
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
