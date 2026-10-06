import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import ErrorBanner from '@/components/ErrorBanner';
import GlowButton from '@/components/GlowButton';
import { CardListSkeleton } from '@/components/Skeleton';
import PostCard from '@/components/PostCard';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
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
  const bloqueados = useStore((s) => s.bloqueados);
  const generarRecaps = useStore((s) => s.generarRecapsPendientes);
  const c = useTheme();

  const hayMas = useStore(s => s.hayMasPosts);
  const cargarMas = useStore(s => s.cargarMasPosts);
  const hidratar = useStore(s => s.hidratar);
  const cargando = useStore(s => s.cargando);
  const errorCarga = useStore(s => s.errorCarga);
  const [errorMas,setErrorMas] = useState<string | null>(null);
  const [cargandoMas,setCargandoMas] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const mas = async () => {
    setCargandoMas(true);
    try { await cargarMas(); setErrorMas(null); }
    catch { setErrorMas('No pudimos cargar más publicaciones. Reintentá.'); }
    finally { setCargandoMas(false); }
  };
  const refrescar = async () => {
    setRefreshing(true);
    try { if (profile?.id) await hidratar(profile.id,true); }
    finally { setRefreshing(false); }
  };
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Auto-post: al entrar, genera recaps de partidos que ya terminaron
  useEffect(() => {
    generarRecaps(profile?.id ?? 'demo', new Date().toISOString());
  }, [generarRecaps, profile?.id]);

  const visibles = useMemo(() => {
    // Ocultamos el contenido de usuarios bloqueados (moderación UGC)
    const base = posts.filter((p) => !bloqueados.includes(p.autor_id));
    if (filtro === 'todos') return base;
    // los recaps cuentan como "encuentros"
    if (filtro === 'encuentro') return base.filter((p) => p.tipo === 'encuentro' || p.tipo === 'recap');
    return base.filter((p) => p.tipo === filtro);
  }, [posts, filtro, bloqueados]);

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <FadeIn delay={40}>
        <View className="px-6 pb-2 pt-2">
          <Text className="font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>El Muro</Text>
          <Text className="mt-1 font-body text-sm text-muted">Lo que se cuece en la cancha, parce.</Text>
        </View>
      </FadeIn>

      {/* Compositor */}
      <FadeIn delay={100}>
        <Pressable
          onPress={() => { haptics.tap(); router.push('/crear-post'); }}
          className="mx-6 mb-3 mt-2 flex-row items-center gap-3 rounded-sm border border-border bg-card px-4 py-3 active:border-primary/50">
          <Avatar nombre={profile?.nombre ?? 'Vos'} uri={profile?.avatar_url} size={36} />
          <Text className="flex-1 font-body text-sm text-muted">¿Qué se cuenta, parce?</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Ionicons name="add" size={20} color={c.ink} />
          </View>
        </Pressable>
      </FadeIn>

      {/* Filtros */}
      <View className="flex-row flex-wrap px-6 pb-1">
        {FILTROS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filtro === f.key} onPress={() => setFiltro(f.key)} />
        ))}
      </View>

      <ErrorBanner message={errorCarga ?? errorMas} className="mx-6 mt-2" />
      <FlatList
        data={visibles}
        refreshing={refreshing}
        onRefresh={refrescar}
        ListFooterComponent={hayMas ? <GlowButton label="Cargar más publicaciones" variant="outline" loading={cargandoMas} onPress={mas} /> : null}
        keyExtractor={(p: Post) => p.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PostCard post={item} comentarios={item.comment_count ?? (comentarios[item.id] ?? []).length} />
        )}
        ListEmptyComponent={cargando ? <CardListSkeleton rows={3} /> :
          <EmptyState
            icon="newspaper-outline"
            titulo="El muro está quieto"
            texto="Todavía no hay nada por acá. ¡Estrená el muro, parce!"
          />
        }
      />
    </Screen>
  );
}
