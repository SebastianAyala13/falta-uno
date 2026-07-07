import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import DateTimeField from '@/components/DateTimeField';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { misCanchas, reservasDeCancha, slotsDelDia, type Slot } from '@/lib/canchas';
import { precioCOP } from '@/lib/format';
import type { Cancha, Reserva } from '@/types/database';

const ESTADO_COLOR: Record<Reserva['estado'], string> = {
  pendiente: Colors.warning,
  confirmada: Colors.primary,
  completada: Colors.accent,
  cancelada: Colors.danger,
};

const ESTADO_LABEL: Record<Reserva['estado'], string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function AgendaCancha() {
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      try {
        const canchas = await misCanchas(profile.id);
        setCancha(canchas[0] ?? null);
      } catch {
        setCancha(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (!cancha) return;
    let vigente = true;
    (async () => {
      setCargandoDia(true);
      try {
        const [s, r] = await Promise.all([slotsDelDia(cancha.id, fecha), reservasDeCancha(cancha.id, fecha)]);
        if (vigente) {
          setSlots(s);
          setReservas(r);
        }
      } catch {
        if (vigente) {
          setSlots([]);
          setReservas([]);
        }
      } finally {
        if (vigente) setCargandoDia(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [fecha, cancha]);

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center px-6 pb-2 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
          Agenda
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !cancha ? (
        <EmptyState
          icon="business-outline"
          titulo="Aún no tenés cancha"
          texto="Registrá tu cancha para ver acá la agenda de reservas día a día."
          cta={{ label: 'Registrar mi cancha', onPress: () => router.push('/cancha/editar') }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <FadeIn delay={40}>
            <DateTimeField label="Fecha" mode="date" value={fecha} onChange={setFecha} minToday />
          </FadeIn>

          {cargandoDia ? (
            <View className="items-center py-10">
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <>
              {/* Slots del día */}
              <FadeIn delay={80}>
                <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wide text-muted">Horarios del día</Text>
                {slots.length === 0 ? (
                  <View className="items-center rounded-2xl border border-border bg-card p-5">
                    <Ionicons name="time-outline" size={22} color={Colors.muted} />
                    <Text className="mt-2 text-center font-body text-sm text-muted">
                      No hay horarios configurados para este día.
                    </Text>
                  </View>
                ) : (
                  slots.map((s) => {
                    const color = s.ocupado ? Colors.muted : Colors.primary;
                    return (
                      <View
                        key={`${s.hora_inicio}-${s.hora_fin}`}
                        className="mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                        <View className="flex-row items-center">
                          <Ionicons name="time-outline" size={16} color={Colors.muted} />
                          <Text className="ml-2 font-body-bold text-sm text-cream">
                            {s.hora_inicio} – {s.hora_fin}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Text className="mr-3 font-body-semibold text-sm text-cream">{precioCOP(s.precio)}</Text>
                          <View className="rounded-full px-3 py-1" style={{ backgroundColor: color + '22' }}>
                            <Text className="font-body-bold text-[10px] uppercase tracking-wide" style={{ color }}>
                              {s.ocupado ? 'Reservado' : 'Libre'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </FadeIn>

              {/* Reservas del día */}
              <FadeIn delay={140}>
                <Text className="mb-2 mt-4 font-body-semibold text-xs uppercase tracking-wide text-muted">Reservas del día</Text>
                {reservas.length === 0 ? (
                  <View className="items-center rounded-2xl border border-border bg-card p-5">
                    <Ionicons name="calendar-outline" size={22} color={Colors.muted} />
                    <Text className="mt-2 font-body text-sm text-muted">Sin reservas para esta fecha.</Text>
                  </View>
                ) : (
                  reservas.map((r) => (
                    <View key={r.id} className="mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                      <View className="flex-1 pr-3">
                        <Text className="font-body-bold text-sm text-cream">{r.hora_inicio}</Text>
                        <Text className="font-body text-xs text-muted" numberOfLines={1}>
                          Ref: {r.referencia}
                        </Text>
                      </View>
                      <View className="rounded-full px-3 py-1" style={{ backgroundColor: ESTADO_COLOR[r.estado] + '22' }}>
                        <Text className="font-body-bold text-[10px] uppercase tracking-wide" style={{ color: ESTADO_COLOR[r.estado] }}>
                          {ESTADO_LABEL[r.estado]}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </FadeIn>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
