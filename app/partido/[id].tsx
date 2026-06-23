import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import ProgressBar from '@/components/ProgressBar';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { COMISION_SERVICIO } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { fechaLarga, precioCOP } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function PartidoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const partido = useStore((s) => s.getPartido(id));
  const inscrito = useStore((s) => s.estaInscrito(id));
  const salirse = useStore((s) => s.salirse);

  if (!partido) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color={Colors.muted} />
          <Text className="mt-3 font-body text-base text-muted">Este partido ya no existe.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="font-body-semibold text-primary">Volver</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const faltan = partido.cupos_totales - partido.cupos_ocupados;
  const lleno = faltan <= 0;
  const comision = Math.round(partido.precio * COMISION_SERVICIO);
  const total = partido.precio + comision;

  const compartir = () => {
    Share.share({
      message:
        `⚽ ${partido.cancha} (${partido.formato}) · ${partido.zona}, Pereira\n` +
        `${fechaLarga(partido.fecha)} a las ${partido.hora}\n` +
        `${faltan === 1 ? '¡Falta 1!' : `Faltan ${faltan}`} · ${precioCOP(partido.precio)} por jugador\n\n` +
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
          <LinearGradient colors={[Colors.secondary, '#0C1712']} style={{ paddingBottom: 24 }}>
            <View
              pointerEvents="none"
              className="absolute rounded-full"
              style={{ right: -60, top: -40, width: 220, height: 220, backgroundColor: Colors.accent, opacity: 0.1 }}
            />
            <SafeAreaView edges={['top']}>
              <View className="flex-row items-center justify-between px-5 pt-2">
                <Pressable onPress={() => router.back()} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
                  <Ionicons name="chevron-back" size={22} color={Colors.cream} />
                </Pressable>
                <Pressable onPress={compartir} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
                  <Ionicons name="share-social-outline" size={20} color={Colors.cream} />
                </Pressable>
              </View>

              <View className="px-6 pt-6">
                <View className="flex-row gap-2">
                  <Badge label={partido.formato} tone="accent" />
                  <Badge label={partido.nivel} tone="neutral" />
                </View>
                <Text className="mt-3 font-display text-5xl uppercase leading-[0.95] text-cream">
                  {partido.cancha}
                </Text>
                <View className="mt-2 flex-row items-center">
                  <Ionicons name="location-sharp" size={15} color={Colors.cream} />
                  <Text className="ml-1 font-body text-base text-cream/80">{partido.zona} · Pereira</Text>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <View className="px-6">
          {/* Cuándo */}
          <FadeIn delay={60}>
            <View className="-mt-4 mb-4 flex-row gap-3">
              <InfoCard icon="calendar" titulo="Fecha" valor={fechaLarga(partido.fecha)} />
              <InfoCard icon="time" titulo="Hora" valor={partido.hora} />
            </View>
          </FadeIn>

          {/* Cupos / roster */}
          <FadeIn delay={120}>
            <View className="mb-4 rounded-3xl border border-border bg-card p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-display text-xl uppercase text-cream">La llave</Text>
                <Text className={`font-body-bold text-sm ${lleno ? 'text-muted' : 'text-accent'}`}>
                  {lleno ? 'Cupo lleno' : faltan === 1 ? '¡Falta 1!' : `Faltan ${faltan}`}
                </Text>
              </View>
              <ProgressBar value={partido.cupos_ocupados / partido.cupos_totales} urgente={faltan === 1} />
              <Text className="mb-3 mt-2 font-body text-xs text-muted">
                {partido.cupos_ocupados} de {partido.cupos_totales} jugadores cuadrados
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {Array.from({ length: partido.cupos_totales }).map((_, i) => {
                  const ocupado = i < partido.cupos_ocupados;
                  return (
                    <View
                      key={i}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: ocupado ? Colors.primary + '22' : 'transparent',
                        borderWidth: ocupado ? 0 : 1.5,
                        borderColor: Colors.border,
                        borderStyle: ocupado ? 'solid' : 'dashed',
                      }}>
                      <Ionicons
                        name={ocupado ? 'person' : 'add'}
                        size={ocupado ? 17 : 18}
                        color={ocupado ? Colors.primary : Colors.muted}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </FadeIn>

          {/* Organizador */}
          <FadeIn delay={180}>
            <View className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4">
              <Avatar nombre={partido.organizador?.nombre ?? '?'} size={48} />
              <View className="ml-3 flex-1">
                <Text className="font-body text-xs uppercase tracking-wide text-muted">Organiza</Text>
                <Text className="font-body-bold text-base text-cream">{partido.organizador?.nombre}</Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-background px-3 py-1.5">
                <Ionicons name="star" size={14} color={Colors.accent} />
                <Text className="font-body-semibold text-sm text-cream">{partido.organizador?.rating?.toFixed(1)}</Text>
              </View>
            </View>
          </FadeIn>

          {/* Descripción */}
          {partido.descripcion ? (
            <FadeIn delay={220}>
              <View className="mb-4 rounded-3xl border border-border bg-card p-4">
                <Text className="mb-1 font-body-semibold text-sm text-cream">Sobre el parche</Text>
                <Text className="font-body text-sm leading-5 text-muted">{partido.descripcion}</Text>
              </View>
            </FadeIn>
          ) : null}

          {/* Desglose de precio */}
          <FadeIn delay={260}>
            <View className="rounded-3xl border border-border bg-card p-4">
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
            <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary/15 py-3">
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
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

function InfoCard({ icon, titulo, valor }: { icon: keyof typeof Ionicons.glyphMap; titulo: string; valor: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-border bg-card p-3">
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <Text className="mt-2 font-body text-[10px] uppercase tracking-wide text-muted">{titulo}</Text>
      <Text className="font-body-semibold text-sm text-cream">{valor}</Text>
    </View>
  );
}

function Linea({ label, valor, total = false }: { label: string; valor: string; total?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={`font-body ${total ? 'text-base text-cream' : 'text-sm text-muted'}`}>{label}</Text>
      <Text className={total ? 'font-display text-xl text-accent' : 'font-body-semibold text-sm text-cream'}>{valor}</Text>
    </View>
  );
}
