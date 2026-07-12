import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import AdminGate from '@/components/AdminGate';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import StatCard from '@/components/StatCard';
import { ajusteSaldo, listarCanchasAdmin, movimientosCancha, setEstadoCancha } from '@/lib/admin';
import { precioCOP, tiempoRelativo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Cancha, MovimientoCancha } from '@/types/database';

const TIPO_MOVIMIENTO: Record<MovimientoCancha['tipo'], string> = {
  ingreso_reserva: 'Ingreso por reserva',
  comision: 'Comisión',
  retiro: 'Retiro',
  ajuste: 'Ajuste',
};

/** Administración de canchas: pausar/activar, ajustes de saldo y ledger. */
export default function CanchasAdmin() {
  const c = useTheme();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  /** id de la cancha cuyo estado se está cambiando. */
  const [toggleId, setToggleId] = useState<string | null>(null);

  // Modal de ajuste de saldo
  const [ajuste, setAjuste] = useState<Cancha | null>(null);
  const [monto, setMonto] = useState('');
  const [credito, setCredito] = useState(true);
  const [desc, setDesc] = useState('');
  const [enviandoAjuste, setEnviandoAjuste] = useState(false);

  // Modal de saldo / movimientos
  const [saldoDe, setSaldoDe] = useState<Cancha | null>(null);
  const [movs, setMovs] = useState<MovimientoCancha[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  const cargar = useCallback(async () => {
    setCanchas(await listarCanchasAdmin());
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const filas = await listarCanchasAdmin();
        if (activo) setCanchas(filas);
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await cargar();
    } finally {
      setRefreshing(false);
    }
  }, [cargar]);

  const toggleEstado = async (cancha: Cancha) => {
    const nuevo = cancha.estado === 'activa' ? 'pausada' : 'activa';
    setToggleId(cancha.id);
    try {
      await setEstadoCancha(cancha.id, nuevo);
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setToggleId(null);
    }
  };

  const abrirAjuste = (cancha: Cancha) => {
    setMonto('');
    setCredito(true);
    setDesc('');
    setAjuste(cancha);
  };

  const confirmarAjuste = async () => {
    if (!ajuste) return;
    const bruto = Number(monto.trim());
    if (!monto.trim() || Number.isNaN(bruto) || bruto === 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto distinto de cero.');
      return;
    }
    // Signo: manda el toggle, pero si escribieron el monto en negativo es débito.
    const negativo = !credito || bruto < 0;
    const valor = negativo ? -Math.abs(bruto) : Math.abs(bruto);
    setEnviandoAjuste(true);
    try {
      await ajusteSaldo(ajuste.id, valor, desc.trim() || undefined);
      const nombre = ajuste.nombre;
      setAjuste(null);
      Alert.alert(
        'Ajuste registrado',
        `${valor > 0 ? 'Crédito' : 'Débito'} de ${precioCOP(Math.abs(valor))} aplicado al saldo de ${nombre}.`,
      );
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setEnviandoAjuste(false);
    }
  };

  const verSaldo = async (cancha: Cancha) => {
    setSaldoDe(cancha);
    setMovs([]);
    setLoadingMovs(true);
    try {
      setMovs(await movimientosCancha(cancha.id));
    } catch (e) {
      setSaldoDe(null);
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setLoadingMovs(false);
    }
  };

  const s = q.trim().toLowerCase();
  const filtradas = s
    ? canchas.filter((cancha) => `${cancha.nombre} ${cancha.ciudad} ${cancha.zona}`.toLowerCase().includes(s))
    : canchas;
  const saldo = movs.reduce((acc, m) => acc + m.monto, 0);

  const renderCancha = (cancha: Cancha) => {
    const activa = cancha.estado === 'activa';
    const estadoColor = activa ? c.primary : c.muted;
    const cambiando = toggleId === cancha.id;
    return (
      <View key={cancha.id} className="mb-3 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <Text className="font-display text-lg text-cream" style={{ lineHeight: 24, paddingTop: 2 }}>
              {cancha.nombre}
            </Text>
            <Text className="mt-0.5 font-body text-xs text-muted">
              {cancha.ciudad} · {cancha.zona}
            </Text>
            <Text className="mt-0.5 font-body text-xs text-muted">
              Comisión {Math.round(cancha.comision_pct * 100)}%
            </Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: estadoColor + '22' }}>
            <Text
              className="font-body-bold text-[11px] uppercase tracking-wide"
              style={{ color: estadoColor }}>
              {activa ? 'Activa' : 'Pausada'}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => void toggleEstado(cancha)}
            disabled={toggleId !== null}
            className="flex-row items-center rounded-xl border border-border bg-background px-3 py-2"
            style={{ opacity: toggleId !== null && !cambiando ? 0.5 : 1 }}>
            {cambiando ? (
              <ActivityIndicator size="small" color={activa ? c.warning : c.primary} />
            ) : (
              <Ionicons
                name={activa ? 'pause-circle-outline' : 'play-circle-outline'}
                size={16}
                color={activa ? c.warning : c.primary}
              />
            )}
            <Text className="ml-1.5 font-body-semibold text-xs text-cream">
              {activa ? 'Pausar' : 'Activar'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => abrirAjuste(cancha)}
            className="flex-row items-center rounded-xl border border-border bg-background px-3 py-2">
            <Ionicons name="create-outline" size={16} color={c.accentText} />
            <Text className="ml-1.5 font-body-semibold text-xs text-cream">Ajuste de saldo</Text>
          </Pressable>

          <Pressable
            onPress={() => void verSaldo(cancha)}
            className="flex-row items-center rounded-xl border border-border bg-background px-3 py-2">
            <Ionicons name="wallet-outline" size={16} color={c.primary} />
            <Text className="ml-1.5 font-body-semibold text-xs text-cream">Ver saldo</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Header */}
        <ScreenHeader title="Canchas" className="px-6 pb-2 pt-2" />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: 40,
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
            }>
            <FadeIn delay={40}>
              <Field
                icon="search"
                placeholder="Buscar por nombre, ciudad o zona"
                value={q}
                onChangeText={setQ}
              />
            </FadeIn>

            {canchas.length === 0 ? (
              <EmptyState
                icon="business-outline"
                titulo="Sin canchas"
                texto="Todavía no hay canchas registradas en la plataforma."
              />
            ) : filtradas.length === 0 ? (
              <Text className="mt-2 font-body text-sm text-muted">
                No hay canchas que coincidan con tu búsqueda.
              </Text>
            ) : (
              <FadeIn delay={100}>
                <Text className="mb-3 font-body text-xs uppercase tracking-wider text-muted">
                  {filtradas.length} {filtradas.length === 1 ? 'cancha' : 'canchas'}
                </Text>
                {filtradas.map(renderCancha)}
              </FadeIn>
            )}
          </ScrollView>
        )}

        {/* Modal: ajuste de saldo */}
        <Modal
          visible={ajuste !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setAjuste(null)}>
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View className="w-full rounded-3xl border border-borderStrong bg-background p-6" style={{ maxWidth: 480 }}>
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
                  Ajuste de saldo
                </Text>
                <Pressable onPress={() => setAjuste(null)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={c.muted} />
                </Pressable>
              </View>
              <Text className="mb-4 mt-1 font-body text-sm text-muted">{ajuste?.nombre ?? ''}</Text>

              <View className="mb-4 flex-row gap-2">
                <Pressable
                  onPress={() => setCredito(true)}
                  className="flex-1 items-center rounded-2xl border px-3 py-3"
                  style={{
                    borderColor: credito ? c.primary : c.border,
                    backgroundColor: credito ? c.primary + '22' : c.card,
                  }}>
                  <Text
                    className="font-body-bold text-sm"
                    style={{ color: credito ? c.primary : c.muted }}>
                    Crédito (+)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setCredito(false)}
                  className="flex-1 items-center rounded-2xl border px-3 py-3"
                  style={{
                    borderColor: !credito ? c.danger : c.border,
                    backgroundColor: !credito ? c.danger + '22' : c.card,
                  }}>
                  <Text
                    className="font-body-bold text-sm"
                    style={{ color: !credito ? c.danger : c.muted }}>
                    Débito (-)
                  </Text>
                </Pressable>
              </View>

              <Field
                label="Monto"
                icon="cash-outline"
                placeholder="Ej: 50000"
                keyboardType="numeric"
                hint="Positivo = crédito, negativo = débito. El signo lo define el toggle."
                value={monto}
                onChangeText={setMonto}
              />
              <Field
                label="Descripción"
                icon="chatbox-ellipses-outline"
                placeholder="Ej: corrección por reserva duplicada"
                value={desc}
                onChangeText={setDesc}
              />
              <GlowButton
                label="Registrar ajuste"
                variant="primary"
                icon="checkmark"
                loading={enviandoAjuste}
                onPress={() => void confirmarAjuste()}
              />
            </View>
          </View>
        </Modal>

        {/* Modal: saldo y movimientos */}
        <Modal
          visible={saldoDe !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSaldoDe(null)}>
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View
              className="w-full rounded-3xl border border-borderStrong bg-background p-6"
              style={{ maxWidth: 520, maxHeight: '85%' }}>
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
                  Saldo
                </Text>
                <Pressable onPress={() => setSaldoDe(null)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={c.muted} />
                </Pressable>
              </View>
              <Text className="mt-1 font-body text-sm text-muted">{saldoDe?.nombre ?? ''}</Text>

              {loadingMovs ? (
                <View className="items-center py-10">
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : (
                <>
                  <StatCard
                    className="mt-4"
                    size="md"
                    labelWeight="body"
                    labelTracking="wider"
                    label="Saldo (suma del ledger)"
                    value={`${saldo < 0 ? '-' : ''}${precioCOP(Math.abs(saldo))}`}
                    valueColor={saldo >= 0 ? c.cream : c.danger}
                  />

                  <ScrollView className="mt-4" style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                    {movs.length === 0 ? (
                      <Text className="font-body text-sm text-muted">Sin movimientos todavía.</Text>
                    ) : (
                      movs.map((m) => {
                        const positivo = m.monto >= 0;
                        return (
                          <View
                            key={m.id}
                            className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-3 py-2.5">
                            <View className="flex-1 pr-2">
                              <Text className="font-body-semibold text-xs text-cream">
                                {TIPO_MOVIMIENTO[m.tipo]}
                              </Text>
                              {m.descripcion ? (
                                <Text className="font-body text-[11px] text-muted" numberOfLines={1}>
                                  {m.descripcion}
                                </Text>
                              ) : null}
                              <Text className="font-body text-[11px] text-muted">
                                {tiempoRelativo(m.created_at)}
                              </Text>
                            </View>
                            <Text
                              className="font-body-bold text-sm"
                              style={{ color: positivo ? c.primary : c.danger }}>
                              {positivo ? '+' : '-'}
                              {precioCOP(Math.abs(m.monto))}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>
      </Screen>
    </AdminGate>
  );
}
