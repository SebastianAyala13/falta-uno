import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import StatCard from '@/components/StatCard';
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

const ESTADO_TONE: Record<EstadoPago, 'primary' | 'warning' | 'danger'> = {
  aprobado: 'primary',
  pendiente: 'warning',
  rechazado: 'danger',
};

/** Plataforma Madre — listado global de pagos con filtro por estado y resumen. */
export default function PagosAdmin() {
  const c = useTheme();
  const [filtro, setFiltro] = useState<EstadoPago | undefined>(undefined);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setPagos(await listarPagosAdmin(filtro));
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    }
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8 }}>
            {FILTROS.map((f) => (
              <Chip key={f.label} label={f.label} selected={filtro === f.valor} onPress={() => setFiltro(f.valor)} />
            ))}
          </ScrollView>

          {loading ? (
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <CardListSkeleton rows={5} />
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
              <ErrorBanner
                message={error}
                action={{ label: 'Reintentar', onPress: () => { setLoading(true); cargar().finally(() => setLoading(false)); } }}
              />
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

              {error ? null : pagos.length === 0 ? (
                <EmptyState
                  icon="card-outline"
                  titulo="Sin pagos"
                  texto="No hay pagos con este filtro. Probá con otro estado."
                />
              ) : (
                pagos.map((p, i) => {
                  return (
                    <FadeIn key={p.id} delay={40 + Math.min(i, 10) * 40}>
                      <View className="mb-3 rounded-md border border-border bg-card p-4">
                        <View className="flex-row items-start justify-between">
                          <View className="mr-3 flex-1">
                            <Text className="font-display text-2xl text-cream">{precioCOP(p.monto)}</Text>
                            <Text className="mt-0.5 font-body text-xs text-muted">
                              Comisión {precioCOP(p.comision)}
                            </Text>
                          </View>
                          <View className="items-end">
                            <View>
                              <Badge label={ESTADO_LABEL[p.estado]} tone={ESTADO_TONE[p.estado]} />
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
