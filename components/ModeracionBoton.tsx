import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable } from 'react-native';

import { useAuth } from '@/lib/auth';
import { MOTIVOS_REPORTE } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import type { MotivoReporte, TipoContenido } from '@/types/database';

interface Props {
  tipo: TipoContenido;
  contenidoId: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  color?: string;
  size?: number;
}

/**
 * Botón "⋯" que abre el menú de moderación de un contenido (post, comentario o
 * mensaje): reportar o bloquear al autor. Requisito de App Store (Guideline 1.2)
 * y Google Play para apps con contenido generado por usuarios.
 *
 * No se muestra sobre el contenido propio ni el del sistema.
 */
export default function ModeracionBoton({
  tipo,
  contenidoId,
  autorId,
  autorNombre,
  texto,
  color,
  size = 18,
}: Props) {
  const c = useTheme();
  const col = color ?? c.muted;
  const { profile } = useAuth();
  const uid = profile?.id ?? 'demo';
  const reportarContenido = useStore((s) => s.reportarContenido);
  const bloquearUsuario = useStore((s) => s.bloquearUsuario);

  if (autorId === uid || autorId === 'sistema') return null;

  const confirmarReporte = (motivo: MotivoReporte) => {
    reportarContenido({
      tipo,
      contenido_id: contenidoId,
      autor_id: autorId,
      reportado_por: uid,
      motivo,
      texto,
    });
    Alert.alert(
      'Gracias, parce',
      'Recibimos tu reporte. Lo revisamos en menos de 24 horas y tomamos acción si incumple las normas de la comunidad.',
    );
  };

  const menuReportar = () => {
    Alert.alert('Reportar contenido', '¿Por qué lo estás reportando?', [
      ...MOTIVOS_REPORTE.map((m) => ({ text: m.label, onPress: () => confirmarReporte(m.id) })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const confirmarBloqueo = () => {
    Alert.alert(
      `¿Bloquear a ${autorNombre}?`,
      'No volverás a ver sus publicaciones, comentarios ni mensajes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () => {
            bloquearUsuario(autorId);
            Alert.alert('Listo', `Bloqueaste a ${autorNombre}.`);
          },
        },
      ],
    );
  };

  const abrirMenu = () => {
    Alert.alert('Opciones', undefined, [
      { text: 'Reportar contenido', onPress: menuReportar },
      { text: `Bloquear a ${autorNombre}`, style: 'destructive', onPress: confirmarBloqueo },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={abrirMenu} hitSlop={10} accessibilityLabel="Opciones de moderación">
      <Ionicons name="ellipsis-horizontal" size={size} color={col} />
    </Pressable>
  );
}
