import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import { listarReservasAdmin } from '@/lib/admin';
import { fechaLarga, precioCOP } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { EstadoReserva, Reserva } from '@/types/database';

const FILTROS: { label: string; valor?: EstadoReserva }[] = [
  { label: 'Todas' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Confirmadas', valor: 'confirmada' },
  { label: 'Canceladas', valor: 'cancelada' },
  { label: 'Completadas', valor: 'completada' },
];

const ESTADO_LABEL: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
};

const ESTADO_TONE: Record<EstadoReserva, 'primary' | 'warning' | 'neutral'> = {
  confirmada: 'primary',
  pendiente: 'warning',
  cancelada: 'neutral',
  completada: 'neutral',
};

/** Plataforma Madre — listado global de reservas con filtro por estado. */
export default function ReservasAdmin() {
  const c = useTheme();
  const [filtro, setFiltro] = useState<EstadoReserva | undefined>(undefined);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    const filas = await listarReservasAdmin(filtro);
    setReservas(filas);
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

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Contenedor web-first: centrado y con ancho máximo en desktop */}
        <View className="flex-1 self-center" style={{ width: '100%', maxWidth: 1040 }}>
          <ScreenHeader title="Reservas" className="px-6 pb-2 pt-2" />

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
              {reservas.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  titulo="Sin reservas"
                  texto="No hay reservas con este filtro. Probá con otro estado."
                />
              ) : (
                <>
                  <Text className="mb-3 font-body-semibold text-xs uppercase tracking-wide text-muted">
                    {reservas.length} {reservas.length === 1 ? 'resultado' : 'resultados'}
                  </Text>

                  {reservas.map((r, i) => {
                    return (
                      <FadeIn key={r.id} delay={40 + Math.min(i, 10) * 40}>
                        <View className="mb-3 rounded-md border border-border bg-card p-4">
                          <View className="flex-row items-start justify-between">
                            <View className="mr-3 flex-1">
                              <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
                                {fechaLarga(r.fecha)} · {r.hora_inicio}–{r.hora_fin}
                              </Text>
                              <Text className="mt-0.5 font-body text-xs text-muted">
                                Cancha #{r.cancha_id.slice(0, 8)}
                              </Text>
                            </View>
                            <View className="items-end">
                              <Text className="font-display text-lg text-cream">{precioCOP(r.precio)}</Text>
                              <View className="mt-1">
                                <Badge label={ESTADO_LABEL[r.estado]} tone={ESTADO_TONE[r.estado]} />
                              </View>
                            </View>
                          </View>

                          <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5">
                            <View className="flex-row items-center">
                              <Ionicons
                                name={r.medio === 'efectivo' ? 'cash-outline' : 'card-outline'}
                                size={13}
                                color={c.muted}
                              />
                              <Text className="ml-1.5 font-body text-xs uppercase text-muted">{r.medio}</Text>
                            </View>
                            <Text className="font-body text-xs text-muted">Ref: {r.referencia}</Text>
                          </View>
                        </View>
                      </FadeIn>
                    );
                  })}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </Screen>
    </AdminGate>
  );
}
