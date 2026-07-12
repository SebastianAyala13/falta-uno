import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import AdminGate from '@/components/AdminGate';
import Avatar from '@/components/Avatar';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import type { Palette } from '@/constants/themes';
import { listarUsuarios } from '@/lib/admin';
import { useTheme } from '@/lib/theme';
import type { Profile } from '@/types/database';

const ROL_CHIP = (c: Palette): Record<string, { label: string; color: string }> => ({
  admin: { label: 'Admin', color: c.primary },
  cancha: { label: 'Cancha', color: c.accent },
  jugador: { label: 'Jugador', color: c.muted },
});

export default function AdminUsuarios() {
  const c = useTheme();
  const rolChip = ROL_CHIP(c);
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (q: string) => {
    const filas = await listarUsuarios(q.trim() || undefined);
    setUsuarios(filas);
  }, []);

  // Búsqueda con debounce simple: espera a que dejes de escribir para pedir datos.
  // Con query vacía trae los últimos usuarios (carga inicial incluida).
  useEffect(() => {
    let activo = true;
    const timer = setTimeout(async () => {
      try {
        const filas = await listarUsuarios(query.trim() || undefined);
        if (activo) setUsuarios(filas);
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
          <View className="flex-row items-center rounded-sm border border-border bg-card px-4">
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput
              className="ml-2 flex-1 py-3 font-body text-sm text-cream"
              placeholder="Buscar por nombre, email o ciudad…"
              placeholderTextColor={c.muted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
            }>
            {usuarios.length === 0 ? (
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
                        <View className="mt-3 flex-row flex-wrap">
                          {roles.map((rol) => {
                            const chip = rolChip[rol] ?? { label: rol, color: c.muted };
                            return (
                              <View
                                key={rol}
                                className="mb-1 mr-2 rounded-full px-3 py-1"
                                style={{ backgroundColor: chip.color + '22' }}>
                                <Text
                                  className="font-body-bold text-xs uppercase tracking-wide"
                                  style={{ color: chip.color }}>
                                  {chip.label}
                                </Text>
                              </View>
                            );
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
