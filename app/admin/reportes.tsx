import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
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
import Screen from '@/components/Screen';
import { CardListSkeleton } from '@/components/Skeleton';
import type { Palette } from '@/constants/themes';
import { reportesAdmin } from '@/lib/admin';
import { tiempoRelativo } from '@/lib/format';
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
                Revisá el contenido reportado y tomá acción con el dueño de la cancha/usuario si
                corresponde.
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
                              className="font-body-bold text-[11px] uppercase tracking-wide"
                              style={{ color: motivo.color }}>
                              {motivo.label}
                            </Text>
                          </View>
                          <View className="mr-2 flex-row items-center">
                            <Ionicons name={tipo.icon} size={14} color={c.muted} />
                            <Text className="ml-1 font-body-semibold text-xs text-cream">{tipo.label}</Text>
                          </View>
                          <Text className="ml-auto font-body text-[11px] text-muted">
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
                              {idCorto(r.autor_id)}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Text className="font-body text-xs text-muted">Reportado por: </Text>
                            <Text className="font-body-semibold text-xs text-cream">
                              {idCorto(r.reportado_por)}
                            </Text>
                          </View>
                        </View>
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
