import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { listarReservasAdmin } from '@/lib/admin';
import { fechaLarga, precioCOP } from '@/lib/format';
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

const colorEstado = (estado: EstadoReserva) => {
  if (estado === 'confirmada') return Colors.primary;
  if (estado === 'pendiente') return Colors.warning;
  return Colors.muted;
};

/** Plataforma Madre — listado global de reservas con filtro por estado. */
export default function ReservasAdmin() {
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8, gap: 8 }}>
            {FILTROS.map((f) => {
              const activo = filtro === f.valor;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setFiltro(f.valor)}
                  className="rounded-full border px-4 py-2 active:opacity-80"
                  style={{
                    backgroundColor: activo ? Colors.primary : Colors.card,
                    borderColor: activo ? Colors.primary : Colors.border,
                  }}>
                  <Text
                    className="font-body-semibold text-xs uppercase tracking-wide"
                    style={{ color: activo ? Colors.ink : Colors.muted }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.primary}
                  colors={[Colors.primary]}
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
                    const color = colorEstado(r.estado);
                    return (
                      <FadeIn key={r.id} delay={40 + Math.min(i, 10) * 40}>
                        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
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
                              <View className="mt-1 rounded-full px-2 py-0.5" style={{ backgroundColor: color + '22' }}>
                                <Text
                                  className="font-body-semibold text-[10px] uppercase tracking-wide"
                                  style={{ color }}>
                                  {ESTADO_LABEL[r.estado]}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5">
                            <View className="flex-row items-center">
                              <Ionicons
                                name={r.medio === 'efectivo' ? 'cash-outline' : 'card-outline'}
                                size={13}
                                color={Colors.muted}
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
