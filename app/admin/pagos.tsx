import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import StatCard from '@/components/StatCard';
import type { Palette } from '@/constants/themes';
import { listarPagosAdmin } from '@/lib/admin';
import { precioCOP, tiempoRelativo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { EstadoPago, Pago } from '@/types/database';

const FILTROS: { label: string; valor?: EstadoPago }[] = [
  { label: 'Todos' },
  { label: 'Aprobados', valor: 'aprobado' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Rechazados', valor: 'rechazado' },
];

const ESTADO_LABEL: Record<EstadoPago, string> = {
  aprobado: 'Aprobado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
};

const colorEstado = (estado: EstadoPago, c: Palette) => {
  if (estado === 'aprobado') return c.primary;
  if (estado === 'pendiente') return c.warning;
  return c.danger;
};

/** Plataforma Madre — listado global de pagos con filtro por estado y resumen. */
export default function PagosAdmin() {
  const c = useTheme();
  const [filtro, setFiltro] = useState<EstadoPago | undefined>(undefined);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    const filas = await listarPagosAdmin(filtro);
    setPagos(filas);
  }, [filtro]);

  useEffect(() => {
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  // Suma de montos aprobados sobre lo cargado (cálculo en cliente).
  const totalAprobado = pagos
    .filter((p) => p.estado === 'aprobado')
    .reduce((s, p) => s + (p.monto ?? 0), 0);

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Contenedor web-first: centrado y con ancho máximo en desktop */}
        <View className="flex-1 self-center" style={{ width: '100%', maxWidth: 1040 }}>
          <ScreenHeader title="Pagos" className="px-6 pb-2 pt-2" />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8, gap: 8 }}>
            {FILTROS.map((f) => {
              const activo = filtro === f.valor;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setFiltro(f.valor)}
                  className="rounded-full border px-4 py-2 active:opacity-80"
                  style={{
                    backgroundColor: activo ? c.primary : c.card,
                    borderColor: activo ? c.primary : c.border,
                  }}>
                  <Text
                    className="font-body-semibold text-xs uppercase tracking-wide"
                    style={{ color: activo ? c.ink : c.muted }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={c.primary}
                  colors={[c.primary]}
                />
              }>
              {/* Resumen sobre lo cargado */}
              <View className="mb-4 flex-row gap-3">
                <StatCard
                  className="flex-1"
                  label="Mostrados"
                  value={String(pagos.length)}
                />
                <StatCard
                  className="flex-1"
                  label="Aprobado (mostrado)"
                  value={precioCOP(totalAprobado)}
                  valueColor={c.primary}
                />
              </View>

              {pagos.length === 0 ? (
                <EmptyState
                  icon="card-outline"
                  titulo="Sin pagos"
                  texto="No hay pagos con este filtro. Probá con otro estado."
                />
              ) : (
                pagos.map((p, i) => {
                  const color = colorEstado(p.estado, c);
                  return (
                    <FadeIn key={p.id} delay={40 + Math.min(i, 10) * 40}>
                      <View className="mb-3 rounded-2xl border border-border bg-card p-4">
                        <View className="flex-row items-start justify-between">
                          <View className="mr-3 flex-1">
                            <Text className="font-display text-2xl text-cream">{precioCOP(p.monto)}</Text>
                            <Text className="mt-0.5 font-body text-xs text-muted">
                              Comisión {precioCOP(p.comision)}
                            </Text>
                          </View>
                          <View className="items-end">
                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: color + '22' }}>
                              <Text
                                className="font-body-semibold text-[10px] uppercase tracking-wide"
                                style={{ color }}>
                                {ESTADO_LABEL[p.estado]}
                              </Text>
                            </View>
                            <Text className="mt-1 font-body text-xs text-muted">{tiempoRelativo(p.created_at)}</Text>
                          </View>
                        </View>

                        <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5">
                          <View className="flex-row items-center">
                            <Ionicons
                              name={p.medio === 'efectivo' ? 'cash-outline' : 'card-outline'}
                              size={13}
                              color={c.muted}
                            />
                            <Text className="ml-1.5 font-body text-xs uppercase text-muted">{p.medio}</Text>
                          </View>
                          <Text className="font-body text-xs text-muted">Ref: {p.referencia}</Text>
                        </View>
                      </View>
                    </FadeIn>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </Screen>
    </AdminGate>
  );
}
