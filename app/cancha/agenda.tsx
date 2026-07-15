import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import DateTimeField from '@/components/DateTimeField';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton, SkeletonBlock } from '@/components/Skeleton';
import { useAuth } from '@/lib/auth';
import { misCanchas, reservasDeCancha, slotsDelDia, type Slot } from '@/lib/canchas';
import { precioCOP } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Cancha, Reserva } from '@/types/database';

const ESTADO_TONE: Record<Reserva['estado'], 'warning' | 'primary' | 'accent' | 'danger'> = {
  pendiente: 'warning',
  confirmada: 'primary',
  completada: 'accent',
  cancelada: 'danger',
};

const ESTADO_LABEL: Record<Reserva['estado'], string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function AgendaCancha() {
  const router = useRouter();
  const { profile, loading: authCargando } = useAuth();
  const c = useTheme();

  const [loading, setLoading] = useState(true);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargarCancha = useCallback(async () => {
    if (!profile?.id) return;
    setError(null);
    setLoading(true);
    try {
      const canchas = await misCanchas(profile.id);
      setCancha(canchas[0] ?? null);
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      // Auth aún resolviendo → mantenemos el skeleton; ya resolvió sin perfil → cerramos.
      if (!authCargando) setLoading(false);
      return;
    }
    cargarCancha();
  }, [profile?.id, authCargando, cargarCancha]);

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
      <ScreenHeader title="Agenda" className="px-6 pb-2 pt-2" />

      {loading ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <SkeletonBlock height={52} radius={12} />
          <View style={{ height: 22 }} />
          <SkeletonBlock height={12} width={'35%'} />
          <View style={{ height: 12 }} />
          <CardListSkeleton rows={4} />
        </View>
      ) : error && !cancha ? (
        <View className="px-6 pt-4">
          <ErrorBanner message={error} action={{ label: 'Reintentar', onPress: cargarCancha }} />
        </View>
      ) : !cancha ? (
        <EmptyState
          icon="business-outline"
          titulo="Aún no tenés cancha"
          texto="Registrá tu cancha para ver acá la agenda de reservas día a día."
          cta={{ label: 'Registrar mi cancha', onPress: () => router.push('/cancha/registrar') }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <FadeIn delay={40}>
            <DateTimeField label="Fecha" mode="date" value={fecha} onChange={setFecha} minToday />
          </FadeIn>

          {cargandoDia ? (
            <View className="pt-4">
              <CardListSkeleton rows={5} />
            </View>
          ) : (
            <>
              {/* Slots del día */}
              <FadeIn delay={80}>
                <Text className="mb-2 font-body-semibold text-xs uppercase tracking-wide text-muted">Horarios del día</Text>
                {slots.length === 0 ? (
                  <View className="items-center rounded-md border border-border bg-card p-5">
                    <Ionicons name="time-outline" size={22} color={c.muted} />
                    <Text className="mt-2 text-center font-body text-sm text-muted">
                      No hay horarios configurados para este día.
                    </Text>
                  </View>
                ) : (
                  slots.map((s) => (
                    <View
                      key={`${s.hora_inicio}-${s.hora_fin}`}
                      className="mb-2 flex-row items-center justify-between rounded-md border border-border bg-card px-4 py-3">
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color={c.muted} />
                        <Text className="ml-2 font-body-bold text-sm text-cream">
                          {s.hora_inicio} – {s.hora_fin}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <Text className="font-body-semibold text-sm text-cream">{precioCOP(s.precio)}</Text>
                        <Badge label={s.ocupado ? 'Reservado' : 'Libre'} tone={s.ocupado ? 'neutral' : 'primary'} />
                      </View>
                    </View>
                  ))
                )}
              </FadeIn>

              {/* Reservas del día */}
              <FadeIn delay={140}>
                <Text className="mb-2 mt-4 font-body-semibold text-xs uppercase tracking-wide text-muted">Reservas del día</Text>
                {reservas.length === 0 ? (
                  <View className="items-center rounded-md border border-border bg-card p-5">
                    <Ionicons name="calendar-outline" size={22} color={c.muted} />
                    <Text className="mt-2 font-body text-sm text-muted">Sin reservas para esta fecha.</Text>
                  </View>
                ) : (
                  reservas.map((r) => (
                    <View key={r.id} className="mb-2 flex-row items-center justify-between rounded-md border border-border bg-card px-4 py-3">
                      <View className="flex-1 pr-3">
                        <Text className="font-body-bold text-sm text-cream">{r.hora_inicio}</Text>
                        <Text className="font-body text-xs text-muted" numberOfLines={1}>
                          Ref: {r.referencia}
                        </Text>
                      </View>
                      <Badge label={ESTADO_LABEL[r.estado]} tone={ESTADO_TONE[r.estado]} />
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
