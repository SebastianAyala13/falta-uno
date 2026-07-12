import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import { FORMATOS, ZONAS, type Formato } from '@/constants/config';
import { listarCanchas } from '@/lib/canchas';
import { useTheme } from '@/lib/theme';
import type { Cancha } from '@/types/database';

export default function Canchas() {
  const router = useRouter();
  const c = useTheme();

  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [query, setQuery] = useState('');
  const [zona, setZona] = useState<string | null>(null);
  const [formato, setFormato] = useState<Formato | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (conSkeleton = true) => {
    if (conSkeleton) setCargando(true);
    setError(null);
    try {
      const filas = await listarCanchas({ zona, formato });
      setCanchas(filas);
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      if (conSkeleton) setCargando(false);
    }
  }, [zona, formato]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar(false);
    setRefreshing(false);
  };

  const resultados = useMemo(() => {
    if (!query) return canchas;
    const q = query.toLowerCase();
    return canchas.filter((cancha) => `${cancha.nombre} ${cancha.zona}`.toLowerCase().includes(q));
  }, [canchas, query]);

  return (
    <Screen edges={['top']}>
      <FadeIn delay={40}>
        <View className="px-6 pb-3 pt-2">
          <ScreenHeader title="Canchas" />

          <View className="mt-3 h-14 flex-row items-center rounded-sm border border-border bg-card px-4">
            <Ionicons name="search" size={20} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nombre o zona..."
              placeholderTextColor={c.muted}
              className="ml-3 flex-1 font-body text-base text-cream"
            />
            {query ? (
              <Ionicons name="close-circle" size={20} color={c.muted} onPress={() => setQuery('')} />
            ) : null}
          </View>
        </View>
      </FadeIn>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        }>
        <FadeIn delay={100}>
          <View className="px-6">
            <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wider text-muted">Zona</Text>
            <View className="mb-3 flex-row flex-wrap">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(zona === z ? null : z)} />
              ))}
            </View>
            <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wider text-muted">Formato</Text>
            <View className="mb-3 flex-row flex-wrap">
              {FORMATOS.map((f) => (
                <Chip key={f} label={f} selected={formato === f} onPress={() => setFormato(formato === f ? null : f)} />
              ))}
            </View>
          </View>
        </FadeIn>

        <View className="px-6 pt-1">
          {cargando ? (
            <CardListSkeleton rows={4} />
          ) : error && resultados.length === 0 ? (
            <ErrorBanner message={error} action={{ label: 'Reintentar', onPress: () => cargar() }} />
          ) : resultados.length === 0 ? (
            <EmptyState
              icon="business-outline"
              titulo="Sin canchas por acá"
              texto={
                zona || formato || query
                  ? 'Probá quitando algún filtro, parce.'
                  : 'Todavía no hay canchas publicadas en tu zona.'
              }
            />
          ) : (
            resultados.map((cancha, i) => {
              const amenidades = Object.values(cancha.amenidades ?? {}).filter(Boolean).length;
              return (
                <FadeIn key={cancha.id} delay={60 + i * 50}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/cancha/[id]', params: { id: cancha.id } })}
                    className="mb-4 overflow-hidden rounded-md border border-border bg-card active:opacity-80">
                    {cancha.foto_portada ? (
                      <Image source={{ uri: cancha.foto_portada }} style={{ width: '100%', height: 150 }} contentFit="cover" />
                    ) : (
                      <View className="h-[150px] w-full items-center justify-center bg-background">
                        <Ionicons name="business" size={42} color={c.muted} />
                      </View>
                    )}
                    <View className="p-4">
                      <Text className="font-display text-xl uppercase text-cream" style={{ lineHeight: 26, paddingTop: 2 }} numberOfLines={1}>
                        {cancha.nombre}
                      </Text>
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="location" size={14} color={c.muted} />
                        <Text className="ml-1 font-body text-sm text-muted">{cancha.zona}</Text>
                      </View>
                      <View className="mt-3 flex-row flex-wrap items-center">
                        {cancha.formatos.map((f) => (
                          <View key={f} className="mb-1 mr-2 rounded-full border border-border bg-background px-3 py-1">
                            <Text className="font-body-semibold text-xs text-primary">{f}</Text>
                          </View>
                        ))}
                      </View>
                      <Text className="mt-1 font-body text-xs text-muted">
                        {amenidades === 1 ? '1 amenidad' : `${amenidades} amenidades`}
                      </Text>
                    </View>
                  </Pressable>
                </FadeIn>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
