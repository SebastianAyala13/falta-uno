import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { COMISION_SERVICIO, MEDIOS_PAGO_ACTIVOS, type MedioPago } from '@/constants/config';
import { Duration, MotionEasing } from '@/constants/motion';
import { useAuth } from '@/lib/auth';
import { precioCOP } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { programarRecordatorio } from '@/lib/notifications';
import { crearCheckoutOnline, procesarPago } from '@/lib/payments';
import { genRef, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useGuardInvitado } from '@/lib/useGuardInvitado';
import type { Pago } from '@/types/database';

type Paso = 'metodo' | 'procesando' | 'listo';

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();
  const guardInvitado = useGuardInvitado();

  const partido = useStore((s) => s.getPartido(id));
  const inscribirse = useStore((s) => s.inscribirse);

  const [paso, setPaso] = useState<Paso>('metodo');
  const [medio, setMedio] = useState<MedioPago>(MEDIOS_PAGO_ACTIVOS[0]);
  const [pago, setPago] = useState<Pago | null>(null);
  const [recordatorio, setRecordatorio] = useState(false);

  if (!partido) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Pagar cupo" titleSize="2xl" backIcon="chevron-down" className="px-6 pb-2 pt-2" />
        <EmptyState
          icon="alert-circle-outline"
          titulo="Partido no encontrado"
          texto="Este partido ya no está disponible o cerró la inscripción."
          cta={{ label: 'Volver', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  // El servicio de Falta Uno solo aplica al pago online (que la app procesa).
  // En efectivo la app no cobra nada, así que no se suma comisión.
  const comision = medio.provider === 'rapyd' ? Math.round(partido.precio * COMISION_SERVICIO) : 0;
  const total = partido.precio + comision;

  const pagar = async () => {
    if (guardInvitado('Creá una cuenta para unirte a un partido.')) return;
    setPaso('procesando');
    try {
      let nuevoPago: Pago;
      if (medio.id === 'online') {
        // Checkout real de Rapyd en el navegador externo. El pago queda
        // 'pendiente' en el cliente: el estado 'aprobado' lo escribe SOLO el
        // servidor (rapyd-webhook) cuando Rapyd confirma el cobro.
        const referencia = genRef();
        const { url } = await crearCheckoutOnline({
          partidoId: id,
          jugadorId: profile?.id ?? 'demo',
          monto: total,
          referencia,
          email: profile?.email,
        });
        await WebBrowser.openBrowserAsync(url);
        nuevoPago = await inscribirse(id, profile?.id ?? 'demo', medio.id, 'pendiente', referencia);
      } else {
        const res = await procesarPago(medio.id, total);
        nuevoPago = await inscribirse(id, profile?.id ?? 'demo', medio.id, res.estado);
      }
      setPago(nuevoPago);
      const rec = await programarRecordatorio(partido);
      setRecordatorio(rec.ok);
      haptics.success();
      setPaso('listo');
    } catch (e) {
      setPaso('metodo');
      Alert.alert(
        'No se pudo procesar el pago',
        e instanceof Error ? e.message : 'Intentá de nuevo en un momento, parce.',
      );
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <ScreenHeader
        title={paso === 'listo' ? 'Comprobante' : 'Pagar cupo'}
        titleSize="2xl"
        backIcon="chevron-down"
        showBack={paso === 'metodo'}
        className="px-6 pb-2 pt-2"
      />

      {paso === 'procesando' ? <Procesando medio={medio} /> : null}
      {paso === 'listo' && pago ? <Comprobante pago={pago} medio={medio} cancha={partido.cancha} recordatorio={recordatorio} onClose={() => router.replace({ pathname: '/partido/[id]', params: { id } })} /> : null}

      {paso === 'metodo' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Resumen */}
          <FadeIn delay={40}>
            <View className="mb-5 rounded-lg border border-border bg-card p-4">
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
              {MEDIOS_PAGO_ACTIVOS.map((m) => {
                const sel = medio.id === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => { haptics.select(); setMedio(m); }}
                    className="flex-row items-center rounded-md border bg-card p-4"
                    style={{ borderColor: sel ? c.primary : c.border }}>
                    <View
                      className="h-11 w-11 items-center justify-center rounded-sm"
                      style={{ backgroundColor: sel ? c.primary + '22' : c.background }}>
                      <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={22} color={sel ? c.primary : c.muted} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="font-body-bold text-base text-cream">{m.nombre}</Text>
                      <Text className="font-body text-xs text-muted">{m.detalle}</Text>
                    </View>
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full border-2"
                      style={{ borderColor: sel ? c.primary : c.border }}>
                      {sel ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          <FadeIn delay={200}>
            <View className="mt-4 flex-row items-center gap-2 rounded-sm border border-border bg-card/60 px-3 py-2.5">
              <Ionicons name="information-circle" size={16} color={c.primary} />
              <Text className="flex-1 font-body text-xs text-muted">
                Falta Uno no custodia tu dinero: el pago es un acuerdo con el organizador del partido.
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
  const c = useTheme();
  const reducedMotion = useReducedMotion();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    rot.value = withRepeat(withTiming(1, { duration: Duration.spin, easing: MotionEasing.linear }), -1);
  }, [rot, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));

  return (
    <View className="flex-1 items-center justify-center px-10">
      <Animated.View style={style}>
        <Ionicons name="football" size={68} color={c.primary} />
      </Animated.View>
      <Text className="mt-6 font-display text-2xl uppercase text-cream">Procesando…</Text>
      <Text className="mt-2 text-center font-body text-sm text-muted">
        {medio.id === 'online'
          ? 'Te llevamos al pago seguro de PayU en tu navegador.'
          : `Confirmando tu pago con ${medio.nombre}. No cierres la app, parce.`}
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
  const c = useTheme();
  const aprobado = pago.estado === 'aprobado';
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <FadeIn delay={40} className="items-center">
        <View
          className="mt-4 h-24 w-24 items-center justify-center rounded-full"
          style={{
            backgroundColor: aprobado ? c.primary : c.warning,
            boxShadow: `0px 0px 24px ${aprobado ? c.primary : c.warning}99`,
          }}>
          <Ionicons name={aprobado ? 'checkmark' : 'time'} size={56} color={c.ink} />
        </View>
        <Text className="mt-5 font-display text-4xl uppercase text-cream" style={{ lineHeight: 44, paddingTop: 2 }}>
          {aprobado ? '¡Listo, parce!' : 'Cupo reservado'}
        </Text>
        <Text className="mt-2 text-center font-body text-sm text-muted">
          {aprobado
            ? `Quedaste cuadrado en ${cancha}.`
            : medio.id === 'online'
              ? 'Tu cupo queda confirmado apenas verifiquemos el pago con la pasarela. Lo ves actualizado en "Mis pagos".'
              : `Te guardamos el cupo. Pagás en efectivo en la cancha.`}
        </Text>
      </FadeIn>

      <FadeIn delay={140}>
        <View className="mt-6 rounded-lg border border-border bg-card p-4">
          <Dato label="Referencia" valor={pago.referencia} mono />
          <Dato label="Medio de pago" valor={medio.nombre} />
          <Dato label="Estado" valor={aprobado ? 'Aprobado' : 'Pendiente'} tone={aprobado ? 'ok' : 'warn'} />
          <View className="my-2 h-px bg-border" />
          <Dato label="Total" valor={precioCOP(pago.monto)} total />
        </View>
      </FadeIn>

      {recordatorio ? (
        <FadeIn delay={180}>
          <View className="mt-4 flex-row items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-3">
            <Ionicons name="notifications" size={18} color={c.primary} />
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
      <Text className={total ? 'font-display text-xl text-accentText' : 'font-body-semibold text-sm text-cream'}>{valor}</Text>
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
  const c = useTheme();
  const color = tone === 'ok' ? c.primary : tone === 'warn' ? c.warning : c.cream;
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
