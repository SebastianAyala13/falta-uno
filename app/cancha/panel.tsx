import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import StatCard from '@/components/StatCard';
import type { Palette } from '@/constants/themes';
import { useAuth } from '@/lib/auth';
import { misCanchas, reservasDeCancha, saldoCancha, slotsDelDia } from '@/lib/canchas';
import { precioCOP } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Cancha, Reserva } from '@/types/database';

const ESTADO_COLOR = (c: Palette): Record<Reserva['estado'], string> => ({
  pendiente: c.warning,
  confirmada: c.primary,
  completada: c.accent,
  cancelada: c.danger,
});

const ESTADO_LABEL: Record<Reserva['estado'], string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const NAV_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string; ruta: string }[] = [
  { icon: 'calendar', label: 'Agenda', ruta: '/cancha/agenda' },
  { icon: 'football', label: 'Mi cancha', ruta: '/cancha/editar' },
  { icon: 'cash', label: 'Finanzas', ruta: '/cancha/finanzas' },
];

export default function PanelCancha() {
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();
  const estadoColor = ESTADO_COLOR(c);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [reservasHoy, setReservasHoy] = useState<Reserva[]>([]);
  const [ocupacion, setOcupacion] = useState(0);

  const cargar = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const canchas = await misCanchas(profile.id);
      const cch = canchas[0] ?? null;
      setCancha(cch);
      if (!cch) return;

      const hoy = new Date().toISOString().slice(0, 10);
      const [plata, reservas, slots] = await Promise.all([
        saldoCancha(cch.id),
        reservasDeCancha(cch.id, hoy),
        slotsDelDia(cch.id, hoy),
      ]);
      const activas = reservas.filter((r) => r.estado !== 'cancelada');
      setSaldo(plata);
      setReservasHoy(activas);
      setOcupacion(Math.round((activas.length / Math.max(1, slots.length)) * 100));
    } catch {
      // silencioso: pull-to-refresh permite reintentar
    }
  }, [profile?.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await cargar();
      setLoading(false);
    })();
  }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  if (loading) {
    return (
      <Screen edges={['top']}>
        <View className="px-6 pb-2 pt-2">
          <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
            Mi cancha
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      </Screen>
    );
  }

  if (!cancha) {
    return (
      <Screen edges={['top']}>
        <View className="px-6 pb-2 pt-2">
          <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
            Mi cancha
          </Text>
        </View>
        <EmptyState
          icon="business-outline"
          titulo="Aún no tenés cancha"
          texto="Registrá tu cancha y empezá a recibir reservas de los parceros de la zona."
          cta={{ label: 'Registrar mi cancha', onPress: () => router.push('/cancha/registrar') }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View className="px-6 pb-2 pt-2">
        <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
          Mi cancha
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}>
        {/* Nombre + editar */}
        <FadeIn delay={40}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-body-bold text-xl text-cream" numberOfLines={1}>
                {cancha.nombre}
              </Text>
              <Text className="font-body text-xs text-muted" numberOfLines={1}>
                {cancha.zona} · {cancha.direccion}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/cancha/editar')}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
              <Ionicons name="create-outline" size={20} color={c.cream} />
            </Pressable>
          </View>
        </FadeIn>

        {/* Saldo */}
        <FadeIn delay={100}>
          <View className="mt-4 rounded-2xl border border-border bg-card p-5">
            <View className="flex-row items-center">
              <Ionicons name="wallet" size={18} color={c.accentText} />
              <Text className="ml-2 font-body-semibold text-xs uppercase tracking-wide text-muted">Saldo disponible</Text>
            </View>
            <Text className="mt-2 font-display text-4xl text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>
              {precioCOP(saldo)}
            </Text>
            <Pressable
              onPress={() => router.push('/cancha/finanzas')}
              className="mt-3 flex-row items-center self-start rounded-full border border-borderStrong bg-background px-4 py-2">
              <Text className="font-body-bold text-sm text-accentText">Ver finanzas</Text>
              <Ionicons name="chevron-forward" size={16} color={c.accentText} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </FadeIn>

        {/* Reservas de hoy + ocupación */}
        <FadeIn delay={160}>
          <View className="mt-3 flex-row">
            <StatCard
              className="mr-3 flex-1"
              size="md"
              valueColor={c.primary}
              label="Reservas de hoy"
              value={String(reservasHoy.length)}
            />
            <StatCard
              className="flex-1"
              size="md"
              valueColor={c.accent}
              label="% Ocupación hoy"
              value={`${ocupacion}%`}
            />
          </View>
        </FadeIn>

        {/* Lista corta de reservas */}
        <FadeIn delay={220}>
          {reservasHoy.length === 0 ? (
            <View className="mt-3 items-center rounded-2xl border border-border bg-card p-5">
              <Ionicons name="calendar-outline" size={22} color={c.muted} />
              <Text className="mt-2 font-body text-sm text-muted">Hoy no hay reservas todavía.</Text>
            </View>
          ) : (
            <View className="mt-3">
              {reservasHoy.slice(0, 4).map((r) => (
                <View key={r.id} className="mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={16} color={c.muted} />
                    <Text className="ml-2 font-body-bold text-sm text-cream">
                      {r.hora_inicio} – {r.hora_fin}
                    </Text>
                  </View>
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: estadoColor[r.estado] + '22' }}>
                    <Text className="font-body-bold text-[10px] uppercase tracking-wide" style={{ color: estadoColor[r.estado] }}>
                      {ESTADO_LABEL[r.estado]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </FadeIn>

        {/* Navegación */}
        <FadeIn delay={280}>
          <View className="mt-4 flex-row">
            {NAV_ITEMS.map((item, i) => (
              <Pressable
                key={item.ruta}
                onPress={() => router.push(item.ruta)}
                className={`flex-1 items-center rounded-2xl border border-border bg-card py-5 ${i < NAV_ITEMS.length - 1 ? 'mr-3' : ''}`}>
                <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: c.primary + '1F' }}>
                  <Ionicons name={item.icon} size={22} color={c.primary} />
                </View>
                <Text className="mt-2 font-body-bold text-xs text-cream">{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}
