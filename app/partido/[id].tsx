import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { BackButton } from '@/components/BackButton';
import Badge from '@/components/Badge';
import CanchaMap from '@/components/CanchaMap';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import ProgressBar from '@/components/ProgressBar';
import Screen from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import StatCard from '@/components/StatCard';
import UrgencyPill from '@/components/UrgencyPill';
import { COMISION_SERVICIO } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { fechaLarga, precioCOP, urgencyLabel } from '@/lib/format';
import { coordsDePartido } from '@/lib/geo';
import { cancelarRecordatorio } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { useTheme, useThemeMeta } from '@/lib/theme';

// Texto sobre el scrim oscuro de una foto: claro fijo (el scrim es siempre oscuro, por
// eso no puede seguir a `cream`, que en el tema Blanco es casi negro).
const HERO_TEXTO_SOBRE_FOTO = '#F6F9F6';

export default function PartidoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();
  const heroDark = useThemeMeta().dark;

  const partido = useStore((s) => s.getPartido(id));
  const inscrito = useStore((s) => s.estaInscrito(id));
  const salirse = useStore((s) => s.salirse);
  const hidratado = useStore((s) => s.hidratado);
  const hidratar = useStore((s) => s.hidratar);

  // Deep-link directo (sin pasar por las tabs): disparamos la carga si hace falta. El
  // backstop de 800ms evita que el skeleton se cuelgue si nunca hidrata (p.ej. sin sesión,
  // donde profile?.id es falsy y hidratar no puede dispararse).
  const [cargando, setCargando] = useState(!hidratado);
  useEffect(() => {
    if (hidratado) {
      setCargando(false);
      return;
    }
    if (profile?.id) hidratar(profile.id);
    const t = setTimeout(() => setCargando(false), 800);
    return () => clearTimeout(t);
  }, [hidratado, profile?.id, hidratar]);

  if (!partido) {
    // Mientras hidrata → skeleton; ya resuelto y sin partido → de verdad no existe.
    if (cargando) return <PartidoSkeleton />;
    return (
      <Screen edges={['top']}>
        <EmptyState
          icon="alert-circle-outline"
          titulo="Este partido ya no existe"
          texto="Puede que lo hayan cancelado o que el cupo ya se haya cerrado."
          cta={{ label: 'Volver', icon: 'arrow-back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const faltan = partido.cupos_totales - partido.cupos_ocupados;
  const lleno = faltan <= 0;
  const comision = Math.round(partido.precio * COMISION_SERVICIO);
  const total = partido.precio + comision;
  const coords = coordsDePartido(partido);

  const conFoto = !!partido.foto_url;
  // Color del texto del hero:
  // - con foto: el scrim es siempre oscuro → texto claro FIJO (independiente del tema; en
  //   Blanco `cream` es casi negro y quedaría ilegible sobre el scrim);
  // - sin foto + tema oscuro: `cream` (claro); sin foto + tema claro (Blanco): `ink` (oscuro)
  //   sobre el degradé verde de marca.
  const heroTextColor = conFoto ? HERO_TEXTO_SOBRE_FOTO : heroDark ? c.cream : c.ink;

  const abrirMapa = () => {
    const label = encodeURIComponent(partido.cancha);
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${coords.latitude},${coords.longitude}`,
      android: `geo:${coords.latitude},${coords.longitude}?q=${coords.latitude},${coords.longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  const irAlChat = () => router.push({ pathname: '/chat/[id]', params: { id } });

  const compartir = () => {
    Share.share({
      message:
        `⚽ ${partido.cancha} (${partido.formato}) · ${partido.zona}, Pereira\n` +
        `${fechaLarga(partido.fecha)} a las ${partido.hora}\n` +
        `${urgencyLabel(faltan)} · ${precioCOP(partido.precio)} por jugador\n\n` +
        `Cuadrate conmigo en Falta Uno 👟🔥`,
    });
  };

  const confirmarSalida = () => {
    Alert.alert('¿Salir del partido?', 'Tu cupo queda libre para otro jugador.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          salirse(id, profile?.id ?? 'demo');
          cancelarRecordatorio(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="overflow-hidden">
          {partido.foto_url ? (
            <Image source={{ uri: partido.foto_url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={
              conFoto
                ? ['rgba(11,15,13,0.30)', 'rgba(11,15,13,0.94)']
                : heroDark
                  ? [c.secondary, c.background]
                  : [c.primary, c.secondary]
            }
            style={{ paddingBottom: 24 }}>
            <View
              className="absolute rounded-full"
              style={{ right: -60, top: -40, width: 220, height: 220, backgroundColor: c.accent, opacity: 0.1, pointerEvents: 'none' }}
            />
            <SafeAreaView edges={['top']}>
              <View className="flex-row items-center justify-between px-5 pt-2">
                <BackButton variant="overlay" />
                <Pressable onPress={compartir} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
                  <Ionicons name="share-social-outline" size={20} color={c.cream} />
                </Pressable>
              </View>

              <View className="px-6 pt-6">
                <View className="flex-row gap-2">
                  <Badge label={partido.formato} tone="accent" />
                  <Badge label={partido.nivel} tone="neutral" />
                </View>
                <Text
                  className="mt-3 font-display text-5xl uppercase"
                  style={{ lineHeight: 50, paddingTop: 4, color: heroTextColor }}>
                  {partido.cancha}
                </Text>
                <View className="mt-2 flex-row items-center">
                  <Ionicons name="location-sharp" size={15} color={heroTextColor} />
                  <Text className="ml-1 font-body text-base opacity-80" style={{ color: heroTextColor }}>{partido.zona} · Pereira</Text>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <View className="px-6">
          {/* Cuándo */}
          <FadeIn delay={60}>
            <View className="-mt-4 mb-4 flex-row gap-3">
              <StatCard
                className="flex-1"
                variant="info"
                icon="calendar"
                label="Fecha"
                value={fechaLarga(partido.fecha)}
              />
              <StatCard
                className="flex-1"
                variant="info"
                icon="time"
                label="Hora"
                value={partido.hora}
              />
            </View>
          </FadeIn>

          {/* Cupos / roster con caras */}
          <FadeIn delay={120}>
            <View className="mb-4 rounded-lg border border-borderStrong bg-card p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-display text-xl uppercase text-cream">La llave</Text>
                <UrgencyPill faltan={faltan} tone="tint" shape="pill" size="sm" />
              </View>
              <ProgressBar value={partido.cupos_ocupados / partido.cupos_totales} urgente={faltan === 1} />
              <Text className="mb-3 mt-2 font-body text-xs text-muted">
                {partido.cupos_ocupados} de {partido.cupos_totales} jugadores cuadrados
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                {rosterNombres(partido, inscrito).map((nombre, i) => (
                  <View key={i} style={{ width: 58 }} className="mb-2 items-center">
                    <Avatar nombre={nombre} size={44} />
                    <Text className="mt-1 font-body text-xs text-cream" numberOfLines={1}>{nombre}</Text>
                  </View>
                ))}
                {!lleno && !inscrito ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/checkout/[id]', params: { id } })}
                    style={{ width: 58 }}
                    className="mb-2 items-center">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{ borderWidth: 1.5, borderColor: c.accent, borderStyle: 'dashed' }}>
                      <Ionicons name="add" size={20} color={c.accentText} />
                    </View>
                    <Text className="mt-1 font-body-semibold text-xs text-accentText" numberOfLines={1}>Vos</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </FadeIn>

          {/* Organizador */}
          <FadeIn delay={180}>
            <View className="mb-4 flex-row items-center rounded-lg border border-border bg-card p-4">
              <Avatar nombre={partido.organizador?.nombre ?? '?'} size={48} />
              <View className="ml-3 flex-1">
                <Text className="font-body text-xs uppercase tracking-wide text-muted">Organiza</Text>
                <Text className="font-body-bold text-base text-cream">{partido.organizador?.nombre}</Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-background px-3 py-1.5">
                <Ionicons name="star" size={14} color={c.accentText} />
                <Text className="font-body-semibold text-sm text-cream">{partido.organizador?.rating?.toFixed(1)}</Text>
              </View>
            </View>
          </FadeIn>

          {/* Chat del parche */}
          <FadeIn delay={200}>
            <Pressable
              onPress={irAlChat}
              className="mb-4 flex-row items-center rounded-lg border border-border bg-card p-4 active:bg-border/40">
              <View className="h-11 w-11 items-center justify-center rounded-sm bg-accent/15">
                <Ionicons name="chatbubbles" size={22} color={c.accentText} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-body-bold text-base text-cream">Chat del parche</Text>
                <Text className="font-body text-xs text-muted">Cuadrá detalles con los demás</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          </FadeIn>

          {/* Ubicación / mapa */}
          <FadeIn delay={230}>
            <CanchaMap
              coords={coords}
              cancha={partido.cancha}
              zona={partido.zona}
              onComoLlegar={abrirMapa}
            />
          </FadeIn>

          {/* Descripción */}
          {partido.descripcion ? (
            <FadeIn delay={220}>
              <View className="mb-4 rounded-lg border border-border bg-card p-4">
                <Text className="mb-1 font-body-semibold text-sm text-cream">Sobre el parche</Text>
                <Text className="font-body text-sm leading-5 text-muted">{partido.descripcion}</Text>
              </View>
            </FadeIn>
          ) : null}

          {/* Desglose de precio */}
          <FadeIn delay={260}>
            <View className="rounded-lg border border-border bg-card p-4">
              <Linea label="Cupo" valor={precioCOP(partido.precio)} />
              <Linea label="Servicio Falta Uno" valor={precioCOP(comision)} />
              <View className="my-2 h-px bg-border" />
              <Linea label="Total" valor={precioCOP(total)} total />
            </View>
          </FadeIn>
        </View>
      </ScrollView>

      {/* CTA fija */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 px-6 pb-8 pt-4">
        {inscrito ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-center gap-2 rounded-md bg-primary/15 py-3">
              <Ionicons name="checkmark-circle" size={20} color={c.primary} />
              <Text className="font-body-bold text-base text-primary">¡Ya estás cuadrado!</Text>
            </View>
            <Pressable onPress={confirmarSalida} className="py-1">
              <Text className="text-center font-body-semibold text-sm text-muted">Salir del partido</Text>
            </Pressable>
          </View>
        ) : lleno ? (
          <GlowButton label="Cupo lleno" variant="dark" disabled icon="lock-closed" />
        ) : (
          <View className="flex-row items-center gap-3">
            <View>
              <Text className="font-body text-xs text-muted">Total</Text>
              <Text className="font-display text-2xl text-cream">{precioCOP(total)}</Text>
            </View>
            <View className="flex-1">
              <GlowButton label="Unirme y pagar" variant="accent" icon="flash" onPress={() => router.push({ pathname: '/checkout/[id]', params: { id } })} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** Silueta del detalle mientras el store hidrata (hero + stats + tarjetas). */
function PartidoSkeleton() {
  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <SkeletonBlock height={200} radius={24} />
        <View style={{ height: 20 }} />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SkeletonBlock height={72} radius={18} />
          </View>
          <View className="flex-1">
            <SkeletonBlock height={72} radius={18} />
          </View>
        </View>
        <View style={{ height: 16 }} />
        <SkeletonBlock height={150} radius={24} />
        <View style={{ height: 16 }} />
        <SkeletonBlock height={84} radius={24} />
      </View>
    </Screen>
  );
}

// Nombres del parche para mostrar las "caras" del roster (mock determinista).
const NOMBRES_PARCHE = [
  'Mateo', 'Dani', 'Juan', 'Nico', 'Santi', 'Cris', 'Pipe', 'Tato', 'Richi', 'Lucho',
  'Sergio', 'Brayan', 'Kevin', 'Jhon', 'Edwin', 'Yair', 'Maicol', 'Caco', 'Memo', 'Wbeimar',
];

function rosterNombres(partido: { cupos_ocupados: number; organizador?: { nombre?: string } }, inscrito: boolean): string[] {
  const n = Math.max(0, partido.cupos_ocupados);
  const nombres: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) nombres.push(partido.organizador?.nombre ?? 'Organizador');
    else nombres.push(NOMBRES_PARCHE[(i - 1) % NOMBRES_PARCHE.length]);
  }
  if (inscrito && nombres.length) nombres[nombres.length - 1] = 'Vos';
  return nombres;
}

function Linea({ label, valor, total = false }: { label: string; valor: string; total?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={`font-body ${total ? 'text-base text-cream' : 'text-sm text-muted'}`}>{label}</Text>
      <Text className={total ? 'font-display text-xl text-accentText' : 'font-body-semibold text-sm text-cream'}>{valor}</Text>
    </View>
  );
}
