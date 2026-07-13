import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/BackButton';
import CanchaMap from '@/components/CanchaMap';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { AMENIDADES } from '@/constants/config';
import { getCancha } from '@/lib/canchas';
import { useTheme } from '@/lib/theme';
import type { Cancha } from '@/types/database';

export default function PerfilCancha() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();

  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCancha(id)
      .then(setCancha)
      .finally(() => setCargando(false));
  }, [id]);

  const activas = cancha
    ? AMENIDADES.filter((a) => (cancha.amenidades as Record<string, boolean | undefined>)?.[a.id])
    : [];

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Cancha" titleSize="2xl" className="px-6 pb-2 pt-2" />

      {cargando ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <SkeletonBlock height={160} radius={18} />
          <View style={{ height: 20 }} />
          <SkeletonBlock height={28} width={'70%'} />
          <View style={{ height: 12 }} />
          <SkeletonBlock height={14} width={'50%'} />
          <View style={{ height: 20 }} />
          <View className="flex-row" style={{ gap: 8 }}>
            <SkeletonBlock height={36} width={72} radius={999} />
            <SkeletonBlock height={36} width={72} radius={999} />
          </View>
        </View>
      ) : !cancha ? (
        <EmptyState
          icon="alert-circle-outline"
          titulo="Cancha no encontrada"
          texto="Esta cancha ya no está disponible. Puede que la hayan dado de baja."
          cta={{ label: 'Volver', icon: 'arrow-back', onPress: () => router.back() }}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            {cancha.fotos.length > 0 ? (
              <FadeIn delay={40}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
                  {cancha.fotos.map((f) => (
                    <Image
                      key={f}
                      source={{ uri: f }}
                      style={{ width: 260, height: 160, borderRadius: 18 }}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              </FadeIn>
            ) : null}

            <FadeIn delay={80}>
              <View className="px-6 pt-4">
                <Text className="font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
                  {cancha.nombre}
                </Text>
                <View className="mt-1 flex-row items-center">
                  <Ionicons name="location" size={16} color={c.primary} />
                  <Text className="ml-1 flex-1 font-body text-sm text-muted">
                    {cancha.zona} · {cancha.direccion}
                  </Text>
                </View>

                <View className="mt-4 flex-row flex-wrap">
                  {cancha.formatos.map((f) => (
                    <View key={f} className="mb-2 mr-2 rounded-full border border-border bg-card px-4 py-2">
                      <Text className="font-body-semibold text-sm text-primary">{f}</Text>
                    </View>
                  ))}
                </View>

                {activas.length > 0 ? (
                  <>
                    <Text className="mb-2 mt-3 font-body-semibold text-xs uppercase tracking-wider text-muted">
                      Amenidades
                    </Text>
                    <View className="flex-row flex-wrap">
                      {activas.map((a) => (
                        <View key={a.id} className="mb-2 w-1/2 flex-row items-center pr-2">
                          <View className="h-9 w-9 items-center justify-center rounded-sm bg-card">
                            <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={18} color={c.primary} />
                          </View>
                          <Text className="ml-2 flex-1 font-body text-sm text-cream">{a.label}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {cancha.telefono ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${cancha.telefono}`)}
                    className="mt-3 flex-row items-center rounded-md border border-border bg-card p-4 active:opacity-80">
                    <Ionicons name="call" size={20} color={c.primary} />
                    <Text className="ml-3 font-body-semibold text-base text-cream">{cancha.telefono}</Text>
                  </Pressable>
                ) : null}

                {cancha.lat != null && cancha.lng != null ? (
                  <View className="mt-4">
                    <CanchaMap
                      coords={{ latitude: cancha.lat, longitude: cancha.lng }}
                      cancha={cancha.nombre}
                      zona={cancha.zona}
                      onComoLlegar={() => {
                        const label = encodeURIComponent(cancha.nombre);
                        const url = Platform.select({
                          ios: `maps://?q=${label}&ll=${cancha.lat},${cancha.lng}`,
                          android: `geo:${cancha.lat},${cancha.lng}?q=${cancha.lat},${cancha.lng}(${label})`,
                          default: `https://www.google.com/maps/search/?api=1&query=${cancha.lat},${cancha.lng}`,
                        });
                        if (url) Linking.openURL(url).catch(() => {});
                      }}
                    />
                  </View>
                ) : null}

                {cancha.descripcion ? (
                  <>
                    <Text className="mb-2 mt-4 font-body-semibold text-xs uppercase tracking-wider text-muted">
                      Descripción
                    </Text>
                    <Text className="font-body text-sm leading-5 text-cream">{cancha.descripcion}</Text>
                  </>
                ) : null}
              </View>
            </FadeIn>
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-3">
            <GlowButton
              label="Reservar"
              variant="accent"
              icon="calendar"
              onPress={() => router.push({ pathname: '/cancha/[id]/reservar', params: { id } })}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
