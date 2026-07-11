import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import DateTimeField from '@/components/DateTimeField';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { COMISION_CANCHA_DEFAULT, WOMPI_CONFIGURADO } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { crearReserva, getCancha, slotsDelDia, type Slot } from '@/lib/canchas';
import { fechaLarga, precioCOP } from '@/lib/format';
import { crearCheckoutReserva } from '@/lib/payments';
import { useStore } from '@/lib/store';
import type { Cancha } from '@/types/database';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Reservar() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const crearPartido = useStore((s) => s.crearPartido);

  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState(hoy());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [abrirPartido, setAbrirPartido] = useState(false);
  const [medio, setMedio] = useState<'efectivo' | 'online'>(WOMPI_CONFIGURADO ? 'online' : 'efectivo');
  const [loading, setLoading] = useState(false);
  const [referencia, setReferencia] = useState<string | null>(null);
  const [online, setOnline] = useState(false); // el comprobante fue de un pago online (queda pendiente)

  useEffect(() => {
    if (!id) return;
    getCancha(id)
      .then(setCancha)
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (!id || !fecha) return;
    let vigente = true;
    setCargandoSlots(true);
    setSlot(null);
    slotsDelDia(id, fecha)
      .then((s) => {
        if (vigente) setSlots(s);
      })
      .finally(() => {
        if (vigente) setCargandoSlots(false);
      });
    return () => {
      vigente = false;
    };
  }, [id, fecha]);

  const pagaOnline = medio === 'online' && WOMPI_CONFIGURADO;

  const reservar = async () => {
    if (!id || !cancha || !slot || !profile) return;
    setLoading(true);
    try {
      // Online: la reserva nace 'pendiente' y Wompi la confirma por webhook.
      // Efectivo: queda 'confirmada' (se paga en la cancha).
      const comision = Math.round(slot.precio * (cancha.comision_pct ?? COMISION_CANCHA_DEFAULT));
      const r = await crearReserva({
        canchaId: id,
        jugadorId: profile.id,
        fecha,
        horaInicio: slot.hora_inicio,
        horaFin: slot.hora_fin,
        precio: slot.precio,
        comision: pagaOnline ? comision : 0,
        medio: pagaOnline ? 'online' : 'efectivo',
        estado: pagaOnline ? 'pendiente' : 'confirmada',
      });

      if (pagaOnline) {
        const { url } = await crearCheckoutReserva({
          reservaId: r.id,
          referencia: r.referencia,
          email: profile.email,
        });
        await WebBrowser.openBrowserAsync(url);
      }

      if (abrirPartido) {
        await crearPartido(
          {
            cancha: cancha.nombre,
            zona: cancha.zona,
            fecha,
            hora: slot.hora_inicio,
            formato: cancha.formatos[0] ?? '5v5',
            nivel: 'Casual',
            precio: slot.precio,
            descripcion: `Reserva en ${cancha.nombre}`,
            foto_url: cancha.foto_portada,
          },
          { id: profile.id, nombre: profile.nombre ?? 'Vos' },
        );
      }
      setOnline(pagaOnline);
      setReferencia(r.referencia);
    } catch (e) {
      Alert.alert('No se pudo reservar', e instanceof Error ? e.message : 'Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Comprobante (estado "listo"). Online → pendiente hasta que Wompi confirme.
  if (referencia && cancha && slot) {
    const tint = online ? Colors.warning : Colors.primary;
    return (
      <Screen edges={['top']}>
        <FadeIn delay={40} className="flex-1 items-center justify-center px-8">
          <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: tint + '22' }}>
            <Ionicons name={online ? 'time' : 'checkmark'} size={52} color={tint} />
          </View>
          <Text className="mt-6 text-center font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
            {online ? 'Cupo reservado' : `Cupo reservado en ${cancha.nombre}`}
          </Text>
          <Text className="mt-3 font-body-semibold text-base" style={{ color: tint }}>{referencia}</Text>
          <Text className="mt-1 font-body text-sm text-muted">
            {fechaLarga(fecha)} · {slot.hora_inicio}
          </Text>
          <Text className="mt-3 text-center font-body text-sm text-muted">
            {online
              ? 'Tu cupo se confirma apenas Wompi verifique el pago. Lo ves en "Mis reservas".'
              : `Pagás en la cancha al llegar.`}
          </Text>
          <View className="mt-8 w-full">
            <GlowButton label="Ver mis reservas" variant="primary" icon="calendar" onPress={() => router.replace('/mis-reservas')} />
          </View>
        </FadeIn>
      </Screen>
    );
  }

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
          Reservar
        </Text>
      </View>

      {cargando ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !cancha ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={42} color={Colors.muted} />
          <Text className="mt-3 text-center font-body text-base text-muted">Esta cancha ya no existe</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <FadeIn delay={40}>
            <Text className="mb-3 font-body-semibold text-base text-cream">{cancha.nombre}</Text>
            <DateTimeField label="Fecha" mode="date" value={fecha} onChange={setFecha} minToday />

            <Text className="mb-2 font-body-semibold text-sm text-cream">Horarios</Text>
            {cargandoSlots ? (
              <View className="items-center py-8">
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : slots.length === 0 ? (
              <Text className="py-4 font-body text-sm text-muted">
                La cancha no tiene horarios para ese día. Probá con otra fecha.
              </Text>
            ) : (
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {slots.map((s) => {
                  const elegido = slot?.hora_inicio === s.hora_inicio;
                  return (
                    <View key={s.hora_inicio} className="w-1/3 p-1">
                      <Pressable
                        disabled={s.ocupado}
                        onPress={() => setSlot(s)}
                        className="items-center rounded-2xl border px-2 py-3"
                        style={{
                          opacity: s.ocupado ? 0.4 : 1,
                          borderColor: elegido ? Colors.primary : Colors.border,
                          backgroundColor: elegido ? Colors.primary : Colors.card,
                        }}>
                        <Text className={`font-body-bold text-sm ${elegido ? 'text-ink' : 'text-cream'}`}>
                          {s.hora_inicio}
                        </Text>
                        <Text className={`mt-0.5 font-body text-xs ${elegido ? 'text-ink' : 'text-muted'}`}>
                          {s.ocupado ? 'Reservado' : precioCOP(s.precio)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-border bg-card p-4">
              <View className="mr-3 flex-1">
                <Text className="font-body-semibold text-base text-cream">Abrir como partido</Text>
                <Text className="mt-0.5 font-body text-xs text-muted">Otros jugadores se pueden sumar a tu reserva.</Text>
              </View>
              <Switch
                value={abrirPartido}
                onValueChange={setAbrirPartido}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.cream}
              />
            </View>

            {/* Medio de pago (online con Wompi solo si está habilitado) */}
            {WOMPI_CONFIGURADO ? (
              <View className="mt-4">
                <Text className="mb-2 font-body-semibold text-sm text-cream">¿Cómo pagás?</Text>
                <View className="flex-row gap-3">
                  {[
                    { key: 'online' as const, label: 'Online', hint: 'Nequi, PSE o tarjeta', icon: 'card' as const },
                    { key: 'efectivo' as const, label: 'En la cancha', hint: 'Pagás al llegar', icon: 'cash' as const },
                  ].map((m) => {
                    const sel = medio === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => setMedio(m.key)}
                        className="flex-1 rounded-2xl border p-3"
                        style={{ backgroundColor: sel ? Colors.primary + '1A' : Colors.card, borderColor: sel ? Colors.primary : Colors.border }}>
                        <Ionicons name={m.icon} size={20} color={sel ? Colors.primary : Colors.muted} />
                        <Text className="mt-1.5 font-body-bold text-sm" style={{ color: sel ? Colors.primary : Colors.cream }}>{m.label}</Text>
                        <Text className="font-body text-xs text-muted">{m.hint}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {slot ? (
              <View className="mt-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-sm text-muted">Total</Text>
                  <Text className="font-display text-2xl text-cream">{precioCOP(slot.precio)}</Text>
                </View>
                <Text className="mt-2 font-body text-xs text-muted">
                  {pagaOnline
                    ? 'Pago seguro con Wompi (Nequi, PSE o tarjeta). Tu cupo se confirma al pagar.'
                    : 'Pagás en la cancha al llegar. Tu cupo queda reservado.'}
                </Text>
              </View>
            ) : null}

            <View className="mt-6">
              <GlowButton
                label="Reservar"
                variant="accent"
                icon="calendar"
                loading={loading}
                disabled={!slot}
                onPress={reservar}
              />
            </View>
          </FadeIn>
        </ScrollView>
      )}
    </Screen>
  );
}
