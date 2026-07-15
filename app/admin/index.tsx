import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import AdminGate from '@/components/AdminGate';
import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton, SkeletonBlock } from '@/components/Skeleton';
import StatCard from '@/components/StatCard';
import { metricas, type MetricasAdmin } from '@/lib/admin';
import { precioCOP } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface SeccionGestion {
  label: string;
  icon: IconName;
  ruta: string;
}

const SECCIONES: SeccionGestion[] = [
  { label: 'Retiros', icon: 'cash-outline', ruta: '/admin/retiros' },
  { label: 'Canchas', icon: 'football-outline', ruta: '/admin/canchas' },
  { label: 'Reservas', icon: 'calendar-outline', ruta: '/admin/reservas' },
  { label: 'Pagos', icon: 'card-outline', ruta: '/admin/pagos' },
  { label: 'Usuarios', icon: 'people-outline', ruta: '/admin/usuarios' },
  { label: 'Reportes', icon: 'flag-outline', ruta: '/admin/reportes' },
];

export default function AdminResumen() {
  const router = useRouter();
  const c = useTheme();

  const [datos, setDatos] = useState<MetricasAdmin | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await metricas());
    } catch {
      setError('No se pudieron cargar las métricas. Revisá tu conexión e intentá de nuevo.');
    }
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const pendientes = datos?.retirosPendientes ?? 0;
  const hayPendientes = pendientes > 0;

  const tarjetas: { label: string; icon: IconName; valor: string; color: string; destacada?: boolean }[] =
    datos
      ? [
          { label: 'Usuarios', icon: 'people', valor: String(datos.usuarios), color: c.primary },
          { label: 'Canchas', icon: 'football', valor: String(datos.canchas), color: c.accent },
          { label: 'Reservas', icon: 'calendar', valor: String(datos.reservas), color: c.secondary },
          { label: 'Pagos aprobados', icon: 'card', valor: String(datos.pagosAprobados), color: c.primary },
          { label: 'GMV', icon: 'trending-up', valor: precioCOP(datos.gmv), color: c.accent },
          {
            label: 'Retiros pendientes',
            icon: 'hourglass',
            valor: String(pendientes),
            color: hayPendientes ? c.warning : c.muted,
            destacada: hayPendientes,
          },
        ]
      : [];

  const maxCiudad = Math.max(1, ...(datos?.porCiudad.map((ciu) => ciu.canchas) ?? []));

  return (
    <AdminGate>
      <Screen edges={['top']}>
        <ScreenHeader title="Plataforma Madre" className="px-6 pb-2 pt-2" />

        {cargando ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12, width: '100%', maxWidth: 1040, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ flexGrow: 1, flexBasis: '30%', minWidth: 150 }}>
                  <SkeletonBlock height={96} radius={18} />
                </View>
              ))}
            </View>
            <View style={{ height: 28 }} />
            <SkeletonBlock height={18} width={'35%'} />
            <View style={{ height: 14 }} />
            <CardListSkeleton rows={4} />
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
            <View style={{ width: '100%', maxWidth: 1040, alignSelf: 'center' }}>
              <ErrorBanner
                message={error}
                action={{ label: 'Reintentar', onPress: () => { setCargando(true); cargar().finally(() => setCargando(false)); } }}
              />
              {/* Métricas */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {tarjetas.map((t, i) => (
                  <FadeIn key={t.label} delay={40 + i * 50} style={{ flexGrow: 1, flexBasis: '30%', minWidth: 150 }}>
                    <StatCard
                      icon={t.icon}
                      iconStyle="badge"
                      tint={t.color}
                      labelPosition="bottom"
                      fitValue
                      highlight={t.destacada ? { color: c.warning } : undefined}
                      value={t.valor}
                      label={t.label}
                    />
                  </FadeIn>
                ))}
              </View>

              {/* Por ciudad */}
              <FadeIn delay={360}>
                <Text className="mb-3 mt-7 font-display text-xl uppercase text-cream" style={{ lineHeight: 26, paddingTop: 2 }}>
                  Por ciudad
                </Text>
                {datos && datos.porCiudad.length > 0 ? (
                  datos.porCiudad.map((ciu) => (
                    <View key={ciu.ciudad} className="mb-2 flex-row items-center rounded-md border border-border bg-card px-4 py-3">
                      <Text className="w-28 font-body-semibold text-sm text-cream" numberOfLines={1}>
                        {ciu.ciudad}
                      </Text>
                      <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-border">
                        <View
                          className="h-2 rounded-full"
                          style={{ width: `${(ciu.canchas / maxCiudad) * 100}%`, backgroundColor: c.primary }}
                        />
                      </View>
                      <Text className="font-display text-base text-cream" style={{ lineHeight: 20, paddingTop: 2 }}>
                        {ciu.canchas}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="font-body text-sm text-muted">Todavía no hay canchas registradas.</Text>
                )}
              </FadeIn>

              {/* Gestión */}
              <FadeIn delay={440}>
                <Text className="mb-3 mt-7 font-display text-xl uppercase text-cream" style={{ lineHeight: 26, paddingTop: 2 }}>
                  Gestión
                </Text>
                {SECCIONES.map((s) => (
                  <Pressable
                    key={s.ruta}
                    onPress={() => { haptics.tap(); router.push(s.ruta); }}
                    className="mb-2 flex-row items-center rounded-md border border-border bg-card px-4 py-3.5 active:opacity-70">
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: c.primary + '22' }}>
                      <Ionicons name={s.icon} size={18} color={c.primary} />
                    </View>
                    <Text className="ml-3 flex-1 font-body-semibold text-base text-cream">{s.label}</Text>
                    {s.ruta === '/admin/retiros' && hayPendientes ? (
                      <View className="mr-2">
                        <Badge label={String(pendientes)} tone="warning" />
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={18} color={c.muted} />
                  </Pressable>
                ))}
              </FadeIn>
            </View>
          </ScrollView>
        )}
      </Screen>
    </AdminGate>
  );
}
