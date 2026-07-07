import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import DateTimeField from '@/components/DateTimeField';
import FadeIn from '@/components/FadeIn';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { crearReserva, getCancha, slotsDelDia, type Slot } from '@/lib/canchas';
import { fechaLarga, precioCOP } from '@/lib/format';
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
  const [loading, setLoading] = useState(false);
  const [referencia, setReferencia] = useState<string | null>(null);

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

  const reservar = async () => {
    if (!id || !cancha || !slot || !profile) return;
    setLoading(true);
    try {
      const r = await crearReserva({
        canchaId: id,
        jugadorId: profile.id,
        fecha,
        horaInicio: slot.hora_inicio,
        horaFin: slot.hora_fin,
        precio: slot.precio,
        medio: 'efectivo',
        estado: 'confirmada',
      });
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
      setReferencia(r.referencia);
    } catch (e) {
      Alert.alert('No se pudo reservar', e instanceof Error ? e.message : 'Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Comprobante (estado "listo")
  if (referencia && cancha && slot) {
    return (
      <Screen edges={['top']}>
        <FadeIn delay={40} className="flex-1 items-center justify-center px-8">
          <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: Colors.primary + '22' }}>
            <Ionicons name="checkmark" size={52} color={Colors.primary} />
          </View>
          <Text className="mt-6 text-center font-display text-3xl uppercase text-cream" style={{ lineHeight: 40, paddingTop: 2 }}>
            Cupo reservado en {cancha.nombre}
          </Text>
          <Text className="mt-3 font-body-semibold text-base text-primary">{referencia}</Text>
          <Text className="mt-1 font-body text-sm text-muted">
            {fechaLarga(fecha)} · {slot.hora_inicio}
          </Text>
          <View className="mt-8 w-full">
            <GlowButton label="Listo" variant="primary" icon="checkmark" onPress={() => router.replace('/mis-reservas')} />
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

            {slot ? (
              <View className="mt-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-sm text-muted">Total</Text>
                  <Text className="font-display text-2xl text-cream">{precioCOP(slot.precio)}</Text>
                </View>
                <Text className="mt-2 font-body text-xs text-muted">
                  Por ahora pagás en la cancha. El pago online (Mercado Pago) llega pronto.
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
