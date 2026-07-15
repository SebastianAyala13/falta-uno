import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import SearchBar from '@/components/SearchBar';
import { CardListSkeleton } from '@/components/Skeleton';
import { listarUsuarios } from '@/lib/admin';
import { useTheme } from '@/lib/theme';
import type { Profile } from '@/types/database';

const ROL_BADGE: Record<string, { label: string; tone: 'primary' | 'accent' | 'neutral' }> = {
  admin: { label: 'Admin', tone: 'primary' },
  cancha: { label: 'Cancha', tone: 'accent' },
  jugador: { label: 'Jugador', tone: 'neutral' },
};

export default function AdminUsuarios() {
  const c = useTheme();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (q: string) => {
    setError(null);
    try {
      setUsuarios(await listarUsuarios(q.trim() || undefined));
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    }
  }, []);

  // Búsqueda con debounce simple: espera a que dejes de escribir para pedir datos.
  // Con query vacía trae los últimos usuarios (carga inicial incluida).
  useEffect(() => {
    let activo = true;
    const timer = setTimeout(async () => {
      if (activo) setError(null);
      try {
        const filas = await listarUsuarios(query.trim() || undefined);
        if (activo) setUsuarios(filas);
      } catch {
        if (activo) setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
      } finally {
        if (activo) setLoading(false);
      }
    }, 350);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await cargar(query);
    } finally {
      setRefreshing(false);
    }
  }, [cargar, query]);

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Header */}
        <ScreenHeader title="Usuarios" className="px-6 pb-2 pt-2" />

        {/* Buscador */}
        <View className="px-6 pb-1 pt-1">
          <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nombre, email o ciudad…" />
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <CardListSkeleton rows={5} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
            }>
            {error ? (
              <ErrorBanner
                message={error}
                action={{ label: 'Reintentar', onPress: () => { setLoading(true); cargar(query).finally(() => setLoading(false)); } }}
              />
            ) : usuarios.length === 0 ? (
              <EmptyState
                icon="people-outline"
                titulo="Sin usuarios"
                texto={
                  query.trim()
                    ? 'No encontramos usuarios con esa búsqueda. Probá con otro nombre, email o ciudad.'
                    : 'Todavía no hay usuarios registrados en la plataforma.'
                }
              />
            ) : (
              <>
                {/* Contador de resultados */}
                <Text className="mb-3 font-body text-xs uppercase tracking-wider text-muted">
                  {usuarios.length} {usuarios.length === 1 ? 'resultado' : 'resultados'}
                </Text>

                {usuarios.map((u, i) => {
                  const roles = u.roles && u.roles.length > 0 ? u.roles : ['jugador'];
                  return (
                    <FadeIn key={u.id} delay={Math.min(i * 30, 300)}>
                      <View className="mb-3 rounded-md border border-border bg-card p-4">
                        <View className="flex-row items-center">
                          <Avatar nombre={u.nombre} uri={u.avatar_url} size={40} />
                          <View className="ml-3 flex-1">
                            <Text className="font-body-bold text-sm text-cream" numberOfLines={1}>
                              {u.nombre}
                            </Text>
                            <Text className="font-body text-xs text-muted" numberOfLines={1}>
                              {u.email}
                            </Text>
                            {u.ciudad ? (
                              <Text className="font-body text-xs text-muted" numberOfLines={1}>
                                {u.ciudad}
                              </Text>
                            ) : null}
                          </View>
                          <View className="ml-3 items-end">
                            <View className="flex-row items-center">
                              <Ionicons name="star" size={13} color={c.accentText} />
                              <Text className="ml-1 font-body-bold text-sm text-cream">
                                {u.rating.toFixed(1)}
                              </Text>
                            </View>
                            <Text className="mt-1 font-body text-xs text-muted">
                              {u.partidos_jugados} {u.partidos_jugados === 1 ? 'partido' : 'partidos'}
                            </Text>
                          </View>
                        </View>

                        {/* Roles */}
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          {roles.map((rol) => {
                            const b = ROL_BADGE[rol] ?? { label: rol, tone: 'neutral' as const };
                            return <Badge key={rol} label={b.label} tone={b.tone} />;
                          })}
                        </View>
                      </View>
                    </FadeIn>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
      </Screen>
    </AdminGate>
  );
}
