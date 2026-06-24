import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { COMISION_SERVICIO, MEDIOS_PAGO, type MedioPago } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { precioCOP } from '@/lib/format';
import { programarRecordatorio } from '@/lib/notifications';
import { procesarPago } from '@/lib/payments';
import { useStore } from '@/lib/store';
import type { Pago } from '@/types/database';

type Paso = 'metodo' | 'procesando' | 'listo';

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const partido = useStore((s) => s.getPartido(id));
  const inscribirse = useStore((s) => s.inscribirse);

  const [paso, setPaso] = useState<Paso>('metodo');
  const [medio, setMedio] = useState<MedioPago>(MEDIOS_PAGO[0]);
  const [pago, setPago] = useState<Pago | null>(null);
  const [recordatorio, setRecordatorio] = useState(false);

  if (!partido) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <Text className="font-body text-muted">Partido no encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const comision = Math.round(partido.precio * COMISION_SERVICIO);
  const total = partido.precio + comision;

  const pagar = async () => {
    setPaso('procesando');
    const res = await procesarPago(medio.id, total);
    const nuevoPago = inscribirse(id, profile?.id ?? 'demo', medio.id, res.estado);
    setPago(nuevoPago);
    const rec = await programarRecordatorio(partido);
    setRecordatorio(rec.ok);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPaso('listo');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-6 pb-2 pt-2">
        {paso === 'metodo' ? (
          <Pressable onPress={() => router.back()} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full bg-card">
            <Ionicons name="chevron-down" size={22} color={Colors.cream} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
        <Text className="ml-3 font-display text-2xl uppercase text-cream">
          {paso === 'listo' ? 'Comprobante' : 'Pagar cupo'}
        </Text>
      </View>

      {paso === 'procesando' ? <Procesando medio={medio} /> : null}
      {paso === 'listo' && pago ? <Comprobante pago={pago} medio={medio} cancha={partido.cancha} recordatorio={recordatorio} onClose={() => router.replace({ pathname: '/partido/[id]', params: { id } })} /> : null}

      {paso === 'metodo' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Resumen */}
          <FadeIn delay={40}>
            <View className="mb-5 rounded-3xl border border-border bg-card p-4">
              <Text className="font-body text-xs uppercase tracking-wide text-muted">Estás pagando</Text>
              <Text className="mt-0.5 font-display text-2xl uppercase text-cream">{partido.cancha}</Text>
              <View className="mt-3 h-px bg-border" />
              <Resumen label="Cupo" valor={precioCOP(partido.precio)} />
              <Resumen label="Servicio Falta Uno" valor={precioCOP(comision)} />
              <Resumen label="Total a pagar" valor={precioCOP(total)} total />
            </View>
          </FadeIn>

          {/* Métodos */}
          <FadeIn delay={120}>
            <Text className="mb-3 font-display text-xl uppercase text-cream">¿Cómo pagás?</Text>
            <View className="gap-3">
              {MEDIOS_PAGO.map((m) => {
                const sel = medio.id === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMedio(m)}
                    className="flex-row items-center rounded-2xl border bg-card p-4"
                    style={{ borderColor: sel ? Colors.primary : Colors.border }}>
                    <View
                      className="h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: sel ? Colors.primary + '22' : Colors.background }}>
                      <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={22} color={sel ? Colors.primary : Colors.muted} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="font-body-bold text-base text-cream">{m.nombre}</Text>
                      <Text className="font-body text-xs text-muted">{m.detalle}</Text>
                    </View>
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full border-2"
                      style={{ borderColor: sel ? Colors.primary : Colors.border }}>
                      {sel ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          <FadeIn delay={200}>
            <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5">
              <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
              <Text className="flex-1 font-body text-xs text-muted">
                Pago protegido. Si el partido se cae, te devolvemos la plata.
              </Text>
            </View>

            <View className="mt-5">
              <GlowButton label={`Pagar ${precioCOP(total)}`} variant="accent" icon="lock-closed" onPress={pagar} />
            </View>
          </FadeIn>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function Procesando({ medio }: { medio: MedioPago }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
  }, [rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));

  return (
    <View className="flex-1 items-center justify-center px-10">
      <Animated.View style={style}>
        <Ionicons name="football" size={68} color={Colors.primary} />
      </Animated.View>
      <Text className="mt-6 font-display text-2xl uppercase text-cream">Procesando…</Text>
      <Text className="mt-2 text-center font-body text-sm text-muted">
        Confirmando tu pago con {medio.nombre}. No cierres la app, parce.
      </Text>
    </View>
  );
}

function Comprobante({
  pago,
  medio,
  cancha,
  recordatorio,
  onClose,
}: {
  pago: Pago;
  medio: MedioPago;
  cancha: string;
  recordatorio: boolean;
  onClose: () => void;
}) {
  const aprobado = pago.estado === 'aprobado';
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <FadeIn delay={40} className="items-center">
        <View
          className="mt-4 h-24 w-24 items-center justify-center rounded-full"
          style={{
            backgroundColor: aprobado ? Colors.primary : Colors.warning,
            shadowColor: aprobado ? Colors.primary : Colors.warning,
            shadowOpacity: 0.6,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          }}>
          <Ionicons name={aprobado ? 'checkmark' : 'time'} size={56} color={Colors.ink} />
        </View>
        <Text className="mt-5 font-display text-4xl uppercase text-cream">
          {aprobado ? '¡Listo, parce!' : 'Cupo reservado'}
        </Text>
        <Text className="mt-2 text-center font-body text-sm text-muted">
          {aprobado ? `Quedaste cuadrado en ${cancha}.` : `Te guardamos el cupo. Pagás en efectivo en la cancha.`}
        </Text>
      </FadeIn>

      <FadeIn delay={140}>
        <View className="mt-6 rounded-3xl border border-border bg-card p-4">
          <Dato label="Referencia" valor={pago.referencia} mono />
          <Dato label="Medio de pago" valor={medio.nombre} />
          <Dato label="Estado" valor={aprobado ? 'Aprobado' : 'Pendiente'} tone={aprobado ? 'ok' : 'warn'} />
          <View className="my-2 h-px bg-border" />
          <Dato label="Total" valor={precioCOP(pago.monto)} total />
        </View>
      </FadeIn>

      {recordatorio ? (
        <FadeIn delay={180}>
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-3">
            <Ionicons name="notifications" size={18} color={Colors.primary} />
            <Text className="flex-1 font-body text-sm text-cream">
              Te avisamos <Text className="text-primary">2 horas antes</Text> del partido. 🔔
            </Text>
          </View>
        </FadeIn>
      ) : null}

      <FadeIn delay={220}>
        <View className="mt-6">
          <GlowButton label="Ver mi partido" variant="primary" icon="football" onPress={onClose} />
        </View>
      </FadeIn>
    </ScrollView>
  );
}

function Resumen({ label, valor, total = false }: { label: string; valor: string; total?: boolean }) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Text className={`font-body ${total ? 'text-base text-cream' : 'text-sm text-muted'}`}>{label}</Text>
      <Text className={total ? 'font-display text-xl text-accent' : 'font-body-semibold text-sm text-cream'}>{valor}</Text>
    </View>
  );
}

function Dato({
  label,
  valor,
  mono = false,
  total = false,
  tone,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  total?: boolean;
  tone?: 'ok' | 'warn';
}) {
  const color = tone === 'ok' ? Colors.primary : tone === 'warn' ? Colors.warning : Colors.cream;
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="font-body text-sm text-muted">{label}</Text>
      <Text
        style={{ color, letterSpacing: mono ? 1 : 0 }}
        className={total ? 'font-display text-lg' : 'font-body-semibold text-sm'}>
        {valor}
      </Text>
    </View>
  );
}
