import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
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
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import type { Palette } from '@/constants/themes';
import { procesarRetiro, retirosTodos } from '@/lib/admin';
import { precioCOP, tiempoRelativo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Retiro } from '@/types/database';

const ESTADO_RETIRO = (c: Palette): Record<Retiro['estado'], { label: string; color: string }> => ({
  solicitado: { label: 'Solicitado', color: c.warning },
  procesando: { label: 'Procesando', color: c.warning },
  pagado: { label: 'Pagado', color: c.primary },
  rechazado: { label: 'Rechazado', color: c.danger },
});

/** Cola de retiros de la Plataforma Madre: aprobar (pagado) o rechazar desembolsos. */
export default function RetirosAdmin() {
  const c = useTheme();
  const estadoRetiro = ESTADO_RETIRO(c);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** id del retiro que se está procesando (deshabilita las acciones de la fila). */
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Modal de rechazo
  const [rechazo, setRechazo] = useState<Retiro | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviandoRechazo, setEnviandoRechazo] = useState(false);

  const cargar = useCallback(async (conSkeleton = true) => {
    if (conSkeleton) setLoading(true);
    setError(null);
    try {
      setRetiros(await retirosTodos());
      return true;
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
      return false;
    } finally {
      if (conSkeleton) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const filas = await retirosTodos();
        if (activo) setRetiros(filas);
      } catch {
        if (activo) setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
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
      await cargar(false);
    } finally {
      setRefreshing(false);
    }
  }, [cargar]);

  const marcarPagado = useCallback(
    async (id: string) => {
      setProcesandoId(id);
      try {
        await procesarRetiro(id, 'pagado');
        const refrescado = await cargar(false);
        Alert.alert(
          '¡Listo!',
          refrescado
            ? 'Retiro marcado como pagado. El saldo de la cancha se descontó.'
            : 'Retiro marcado como pagado. No se pudo refrescar la lista, deslizá para actualizar.',
        );
      } catch (e) {
        Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
      } finally {
        setProcesandoId(null);
      }
    },
    [cargar],
  );

  const aprobar = (r: Retiro) => {
    Alert.alert(
      'Aprobar retiro',
      `¿Ya hiciste la transferencia de ${precioCOP(r.monto)} a la cancha? Al aprobar se descuenta del saldo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar', onPress: () => void marcarPagado(r.id) },
      ],
    );
  };

  const confirmarRechazo = async () => {
    if (!rechazo) return;
    if (!motivo.trim()) {
      Alert.alert('Falta el motivo', 'Contale a la cancha por qué se rechaza el retiro.');
      return;
    }
    setEnviandoRechazo(true);
    try {
      await procesarRetiro(rechazo.id, 'rechazado', motivo.trim());
      setRechazo(null);
      setMotivo('');
      const refrescado = await cargar(false);
      Alert.alert(
        'Retiro rechazado',
        refrescado
          ? 'La cancha va a ver el motivo en sus finanzas.'
          : 'Retiro rechazado. No se pudo refrescar la lista, deslizá para actualizar.',
      );
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo.');
    } finally {
      setEnviandoRechazo(false);
    }
  };

  const pendientes = retiros.filter((r) => r.estado === 'solicitado');
  const historial = retiros.filter((r) => r.estado !== 'solicitado');

  const renderRetiro = (r: Retiro, pendiente: boolean) => {
    const estado = estadoRetiro[r.estado];
    const ocupado = procesandoId !== null;
    return (
      <View key={r.id} className="mb-3 rounded-md border border-border bg-card p-4">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="font-display text-xl text-cream" style={{ lineHeight: 26, paddingTop: 2 }}>
              {precioCOP(r.monto)}
            </Text>
            <Text className="mt-0.5 font-body text-xs text-muted">
              Cancha {r.cancha_id.slice(0, 8)} · {tiempoRelativo(r.solicitado_at)}
            </Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: estado.color + '22' }}>
            <Text
              className="font-body-bold text-[11px] uppercase tracking-wide"
              style={{ color: estado.color }}>
              {estado.label}
            </Text>
          </View>
        </View>

        {r.estado === 'rechazado' && r.motivo_rechazo ? (
          <Text className="mt-2 font-body text-xs text-muted">Motivo: {r.motivo_rechazo}</Text>
        ) : null}

        {pendiente ? (
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <GlowButton
                label="Aprobar (pagado)"
                variant="primary"
                icon="checkmark-circle-outline"
                loading={procesandoId === r.id}
                disabled={ocupado}
                onPress={() => aprobar(r)}
              />
            </View>
            <View className="flex-1">
              <GlowButton
                label="Rechazar"
                variant="dark"
                icon="close-circle-outline"
                disabled={ocupado}
                onPress={() => {
                  setMotivo('');
                  setRechazo(r);
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Header */}
        <ScreenHeader title="Retiros" className="px-6 pb-2 pt-2" />

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
          {/* Nota operativa */}
          <FadeIn delay={40}>
            <View className="mb-4 flex-row items-start rounded-md border border-border bg-card p-4">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={c.warning}
                style={{ marginTop: 1 }}
              />
              <Text className="ml-2 flex-1 font-body text-xs text-muted">
                Aprobá el retiro DESPUÉS de haber hecho la transferencia a la cancha. Al aprobar, se
                descuenta del saldo (ledger).
              </Text>
            </View>
          </FadeIn>

          {loading ? (
            <CardListSkeleton rows={4} />
          ) : error && retiros.length === 0 ? (
            <ErrorBanner message={error} action={{ label: 'Reintentar', onPress: () => cargar() }} />
          ) : retiros.length === 0 ? (
            <EmptyState
              icon="cash-outline"
              titulo="Sin retiros"
              texto="Cuando una cancha solicite un retiro, aparece acá para que lo proceses."
            />
          ) : (
            <>
              {/* Pendientes de acción */}
              <FadeIn delay={100}>
                <Text
                  className="mb-3 font-display text-xl uppercase text-cream"
                  style={{ lineHeight: 26, paddingTop: 2 }}>
                  Pendientes ({pendientes.length})
                </Text>
                {pendientes.length === 0 ? (
                  <Text className="mb-2 font-body text-sm text-muted">
                    No hay retiros esperando acción. Todo al día.
                  </Text>
                ) : (
                  pendientes.map((r) => renderRetiro(r, true))
                )}
              </FadeIn>

              {/* Historial */}
              {historial.length > 0 ? (
                <FadeIn delay={160}>
                  <Text
                    className="mb-3 mt-6 font-display text-xl uppercase text-cream"
                    style={{ lineHeight: 26, paddingTop: 2 }}>
                    Historial
                  </Text>
                  {historial.map((r) => renderRetiro(r, false))}
                </FadeIn>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Modal: motivo del rechazo */}
        <Modal
          visible={rechazo !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setRechazo(null)}>
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <View className="w-full rounded-lg border border-borderStrong bg-background p-6" style={{ maxWidth: 480 }}>
              <View className="flex-row items-center justify-between">
                <Text className="font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
                  Rechazar retiro
                </Text>
                <Pressable onPress={() => setRechazo(null)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={c.muted} />
                </Pressable>
              </View>
              <Text className="mb-4 mt-1 font-body text-sm text-muted">
                {rechazo ? `${precioCOP(rechazo.monto)} · Cancha ${rechazo.cancha_id.slice(0, 8)}` : ''}
              </Text>
              <Field
                label="Motivo del rechazo"
                icon="chatbox-ellipses-outline"
                placeholder="Ej: datos bancarios incompletos"
                multiline
                value={motivo}
                onChangeText={setMotivo}
              />
              <GlowButton
                label="Confirmar rechazo"
                variant="primary"
                icon="close-circle-outline"
                loading={enviandoRechazo}
                onPress={() => void confirmarRechazo()}
              />
            </View>
          </View>
        </Modal>
      </Screen>
    </AdminGate>
  );
}
