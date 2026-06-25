import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GameCard from '@/components/GameCard';
import Screen from '@/components/Screen';
import { GameCardSkeleton } from '@/components/Skeleton';
import { Colors } from '@/constants/colors';
import { FORMATOS, NIVELES, ZONAS } from '@/constants/config';
import { useStore } from '@/lib/store';

export default function Buscar() {
  const partidos = useStore((s) => s.partidos);

  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCargando(false), 650);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = useState('');
  const [zona, setZona] = useState<string | null>(null);
  const [nivel, setNivel] = useState<string | null>(null);
  const [formato, setFormato] = useState<string | null>(null);

  const toggle = (actual: string | null, valor: string, set: (v: string | null) => void) =>
    set(actual === valor ? null : valor);

  const resultados = useMemo(
    () =>
      partidos.filter((p) => {
        if (query && !`${p.cancha} ${p.zona}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (zona && p.zona !== zona) return false;
        if (nivel && p.nivel !== nivel) return false;
        if (formato && p.formato !== formato) return false;
        return true;
      }),
    [partidos, query, zona, nivel, formato],
  );

  const hayFiltros = zona || nivel || formato || query;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <Screen>
      <FadeIn delay={40}>
        <View className="px-6 pb-3 pt-2">
          <Text className="mb-4 font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>Buscar partido</Text>
          <View className="h-14 flex-row items-center rounded-2xl border border-border bg-card px-4">
            <Ionicons name="search" size={20} color={Colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cancha, zona, parche..."
              placeholderTextColor={Colors.muted}
              className="ml-3 flex-1 font-body text-base text-cream"
            />
            {query ? (
              <Ionicons name="close-circle" size={20} color={Colors.muted} onPress={() => setQuery('')} />
            ) : null}
          </View>
        </View>
      </FadeIn>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }>
        <FadeIn delay={120}>
          <View className="px-6">
            <Filtro titulo="Zona">
              {ZONAS.map((z) => (
                <Chip key={z} label={z} selected={zona === z} onPress={() => toggle(zona, z, setZona)} />
              ))}
            </Filtro>
            <Filtro titulo="Nivel">
              {NIVELES.map((n) => (
                <Chip key={n} label={n} selected={nivel === n} onPress={() => toggle(nivel, n, setNivel)} />
              ))}
            </Filtro>
            <Filtro titulo="Formato">
              {FORMATOS.map((f) => (
                <Chip key={f} label={f} selected={formato === f} onPress={() => toggle(formato, f, setFormato)} />
              ))}
            </Filtro>
          </View>
        </FadeIn>

        <View className="mb-2 mt-2 flex-row items-center justify-between px-6">
          <Text className="font-body-semibold text-sm text-muted">
            {resultados.length} {resultados.length === 1 ? 'partido' : 'partidos'}
          </Text>
          {hayFiltros ? (
            <Text
              onPress={() => {
                setZona(null);
                setNivel(null);
                setFormato(null);
                setQuery('');
              }}
              className="font-body-semibold text-sm text-primary">
              Limpiar
            </Text>
          ) : null}
        </View>

        <View className="px-6">
          {cargando ? (
            <>
              <GameCardSkeleton />
              <GameCardSkeleton />
              <GameCardSkeleton />
            </>
          ) : resultados.length === 0 ? (
            <EmptyState
              icon="search-outline"
              titulo={hayFiltros ? 'Nada con esos filtros' : 'Tu zona está quieta'}
              texto={hayFiltros ? 'Probá quitando alguno, parce.' : 'Nadie ha armado pichanga por acá. Sé el primero 👟'}
            />
          ) : (
            resultados.map((p, i) => (
              <FadeIn key={p.id} delay={60 + i * 50}>
                <GameCard partido={p} />
              </FadeIn>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Filtro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wider text-muted">{titulo}</Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}
