import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { cancelarReserva, listarCanchas, misReservas } from '@/lib/canchas';
import { fechaLarga, precioCOP } from '@/lib/format';
import type { EstadoReserva, Reserva } from '@/types/database';

const ESTADO_LABEL: Record<EstadoReserva, string> = {
  confirmada: 'Confirmada',
  pendiente: 'Pendiente',
  cancelada: 'Cancelada',
  completada: 'Completada',
};

const colorEstado = (estado: EstadoReserva) => {
  if (estado === 'confirmada') return Colors.primary;
  if (estado === 'pendiente') return Colors.warning;
  return Colors.muted;
};

export default function MisReservas() {
  const router = useRouter();
  const { profile } = useAuth();

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    if (!profile?.id) return;
    const [filas, canchas] = await Promise.all([misReservas(profile.id), listarCanchas()]);
    setReservas(filas);
    setNombres(Object.fromEntries(canchas.map((c) => [c.id, c.nombre])));
  }, [profile?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const confirmarCancelacion = (reserva: Reserva) => {
    Alert.alert('Cancelar reserva', '¿Seguro que querés cancelar esta reserva?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelarReserva(reserva.id);
            await cargar();
          } catch (e) {
            Alert.alert('No se pudo cancelar', e instanceof Error ? e.message : 'Probá de nuevo.');
          }
        },
      },
    ]);
  };

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
          Mis reservas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }>
        {reservas.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            titulo="Sin reservas aún"
            texto="Cuando reserves una cancha, acá te queda el registro."
            cta={{ label: 'Buscar canchas', onPress: () => router.push('/canchas') }}
          />
        ) : (
          reservas.map((r, i) => {
            const color = colorEstado(r.estado);
            const cancelable = (r.estado === 'confirmada' || r.estado === 'pendiente') && r.fecha >= hoy;
            return (
              <FadeIn key={r.id} delay={60 + i * 50}>
                <View className="mb-3 rounded-2xl border border-border bg-card p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="mr-3 flex-1">
                      <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
                        {nombres[r.cancha_id] ?? 'Cancha'}
                      </Text>
                      <Text className="mt-0.5 font-body text-xs text-muted">
                        {fechaLarga(r.fecha)} · {r.hora_inicio}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-display text-lg text-cream">{precioCOP(r.precio)}</Text>
                      <View className="mt-1 rounded-full px-2 py-0.5" style={{ backgroundColor: color + '22' }}>
                        <Text className="font-body-semibold text-[10px] uppercase tracking-wide" style={{ color }}>
                          {ESTADO_LABEL[r.estado]}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {cancelable ? (
                    <Pressable
                      onPress={() => confirmarCancelacion(r)}
                      className="mt-3 flex-row items-center justify-center rounded-xl border border-border py-2.5 active:opacity-70">
                      <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                      <Text className="ml-1.5 font-body-semibold text-sm" style={{ color: Colors.danger }}>
                        Cancelar
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </FadeIn>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
