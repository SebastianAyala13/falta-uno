import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import AdminGate from '@/components/AdminGate';
import Badge from '@/components/Badge';
import { ScreenHeader } from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import type { Palette } from '@/constants/themes';
import { reportesAdmin, resolverReporte, suspenderUsuario } from '@/lib/admin';
import { tiempoRelativo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';
import type { Reporte } from '@/types/database';

const MOTIVO_CHIP = (c: Palette): Record<Reporte['motivo'], { label: string; color: string }> => ({
  spam: { label: 'Spam', color: c.warning },
  acoso: { label: 'Acoso', color: c.danger },
  sexual: { label: 'Contenido sexual', color: c.danger },
  odio: { label: 'Odio', color: c.danger },
  otro: { label: 'Otro', color: c.warning },
});

const TIPO_CONTENIDO: Record<Reporte['tipo'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  post: { label: 'Post', icon: 'newspaper-outline' },
  comentario: { label: 'Comentario', icon: 'chatbubble-outline' },
  mensaje: { label: 'Mensaje', icon: 'mail-outline' },
};

/** Id corto para mostrar en la UI (los uuid completos no aportan). */
function idCorto(id: string): string {
  return id.slice(0, 8);
}

/** Botón compacto de acción de moderación, tonalizado por token. */
function AccionBtn({
  label,
  icon,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center rounded-sm border px-3 py-2 active:opacity-70"
      style={{ borderColor: tone + '55', backgroundColor: tone + '18', opacity: disabled ? 0.5 : 1 }}>
      <Ionicons name={icon} size={14} color={tone} />
      <Text className="ml-1.5 font-body-bold text-xs" style={{ color: tone }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AdminReportes() {
  const c = useTheme();
  const motivoChip = MOTIVO_CHIP(c);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (conSkeleton = true) => {
    if (conSkeleton) setCargando(true);
    setError(null);
    try {
      const filas = await reportesAdmin();
      setReportes(filas);
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      if (conSkeleton) setCargando(false);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const filas = await reportesAdmin();
        if (activo) setReportes(filas);
      } catch {
        if (activo) setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
      } finally {
        if (activo) setCargando(false);
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

  const [procesando, setProcesando] = useState<string | null>(null);

  const ejecutar = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      setProcesando(id);
      try {
        await fn();
        haptics.success();
        await cargar(false);
      } catch (e) {
        Alert.alert('No se pudo', e instanceof Error ? e.message : 'Intentá de nuevo, parce.');
      } finally {
        setProcesando(null);
      }
    },
    [cargar],
  );

  const eliminarContenido = (r: Reporte) => {
    haptics.tap();
    Alert.alert('¿Eliminar el contenido?', 'Se borra el contenido reportado de forma permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => ejecutar(r.id, () => resolverReporte(r.id, 'resuelto', true)) },
    ]);
  };

  const descartar = (r: Reporte) => {
    haptics.tap();
    ejecutar(r.id, () => resolverReporte(r.id, 'descartado', false));
  };

  const suspenderAutor = (r: Reporte) => {
    if (!r.autor_id) return;
    haptics.tap();
    Alert.alert('¿Suspender al autor?', 'El usuario queda suspendido y no podrá seguir publicando.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Suspender', style: 'destructive', onPress: () => ejecutar(r.id, () => suspenderUsuario(r.autor_id, true)) },
    ]);
  };

  return (
    <AdminGate>
      <Screen edges={['top']}>
        {/* Header */}
        <ScreenHeader title="Reportes" className="px-6 pb-2 pt-2" />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }>
          {/* Nota de moderación */}
          <FadeIn delay={40}>
            <View className="mb-4 flex-row items-start rounded-md border border-border bg-card p-4">
              <Ionicons
                name="shield-half-outline"
                size={20}
                color={c.muted}
                style={{ marginTop: 1 }}
              />
              <Text className="ml-2 flex-1 font-body text-xs text-muted">
                Revisá cada reporte y actuá: eliminá el contenido, descartá el reporte o suspendé al
                autor. Los reportes que atendés quedan marcados.
              </Text>
            </View>
          </FadeIn>

          {cargando ? (
            <CardListSkeleton rows={4} />
          ) : error && reportes.length === 0 ? (
            <ErrorBanner message={error} action={{ label: 'Reintentar', onPress: () => cargar() }} />
          ) : reportes.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              titulo="Sin reportes"
              texto="No hay contenido reportado por revisar. Todo tranquilo por acá."
            />
          ) : (
            <>
                <Text className="mb-3 font-body text-xs uppercase tracking-wider text-muted">
                  {reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'}
                </Text>

                {reportes.map((r, i) => {
                  const motivo = motivoChip[r.motivo];
                  const tipo = TIPO_CONTENIDO[r.tipo];
                  return (
                    <FadeIn key={r.id} delay={Math.min(80 + i * 30, 380)}>
                      <View className="mb-3 rounded-md border border-border bg-card p-4">
                        {/* Motivo + tipo + tiempo */}
                        <View className="flex-row flex-wrap items-center">
                          <View
                            className="mr-2 rounded-full px-3 py-1"
                            style={{ backgroundColor: motivo.color + '22' }}>
                            <Text
                              className="font-body-bold text-xs uppercase tracking-wide"
                              style={{ color: motivo.color }}>
                              {motivo.label}
                            </Text>
                          </View>
                          <View className="mr-2 flex-row items-center">
                            <Ionicons name={tipo.icon} size={14} color={c.muted} />
                            <Text className="ml-1 font-body-semibold text-xs text-cream">{tipo.label}</Text>
                          </View>
                          <Text className="ml-auto font-body text-xs text-muted">
                            {tiempoRelativo(r.created_at)}
                          </Text>
                        </View>

                        {/* Contenido reportado */}
                        <View className="mt-3 rounded-sm border border-borderStrong bg-background p-3">
                          <Text className="font-body text-sm text-cream">{r.texto}</Text>
                        </View>

                        {/* Quién escribió y quién reportó */}
                        <View className="mt-3 flex-row flex-wrap items-center">
                          <View className="mr-4 flex-row items-center">
                            <Text className="font-body text-xs text-muted">Contenido de: </Text>
                            <Text className="font-body-semibold text-xs text-cream">
                              {r.autor_id ? idCorto(r.autor_id) : 'anónimo'}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Text className="font-body text-xs text-muted">Reportado por: </Text>
                            <Text className="font-body-semibold text-xs text-cream">
                              {idCorto(r.reportado_por)}
                            </Text>
                          </View>
                        </View>

                        {/* Acciones de moderación */}
                        {r.estado === 'pendiente' ? (
                          <View className="mt-3 flex-row flex-wrap gap-2 border-t border-border pt-3">
                            <AccionBtn label="Eliminar" icon="trash-outline" tone={c.danger} disabled={procesando === r.id} onPress={() => eliminarContenido(r)} />
                            <AccionBtn label="Descartar" icon="close-circle-outline" tone={c.muted} disabled={procesando === r.id} onPress={() => descartar(r)} />
                            {r.autor_id ? (
                              <AccionBtn label="Suspender autor" icon="ban-outline" tone={c.warning} disabled={procesando === r.id} onPress={() => suspenderAutor(r)} />
                            ) : null}
                          </View>
                        ) : (
                          <View className="mt-3 flex-row border-t border-border pt-3">
                            <Badge
                              label={r.estado === 'resuelto' ? 'Resuelto' : 'Descartado'}
                              tone={r.estado === 'resuelto' ? 'primary' : 'neutral'}
                            />
                          </View>
                        )}
                      </View>
                    </FadeIn>
                  );
                })}
              </>
            )}
        </ScrollView>
      </Screen>
    </AdminGate>
  );
}
