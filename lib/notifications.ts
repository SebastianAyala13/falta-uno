import * as Notifications from 'expo-notifications';

import type { Partido } from '@/types/database';

/**
 * Notificaciones locales — recordatorio antes del partido.
 *
 * Nota: en Expo Go las notificaciones push remotas están limitadas, pero las
 * **locales programadas** funcionan. Para push remotas (cuando se cae un partido,
 * etc.) se necesita un build de desarrollo/EAS y un token de Expo Push.
 */

/** Configura cómo se muestran las notificaciones en primer plano. */
export function configurarNotificaciones() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Pide permiso de notificaciones. Devuelve si quedó concedido. */
export async function pedirPermiso(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

function fechaPartido(p: Pick<Partido, 'fecha' | 'hora'>): Date | null {
  const [y, m, d] = p.fecha.split('-').map(Number);
  const [hh, mm] = p.hora.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh)) return null;
  return new Date(y, m - 1, d, hh, mm || 0, 0);
}

export interface ResultadoRecordatorio {
  ok: boolean;
  /** Cuándo sonará el recordatorio (si se programó). */
  cuando?: Date;
  motivo?: 'sin-permiso' | 'partido-pasado' | 'error';
}

/**
 * Programa un recordatorio local ~2 horas antes del partido (o, si falta menos
 * de 2h, 1 minuto después como confirmación inmediata).
 */
export async function programarRecordatorio(
  partido: Pick<Partido, 'id' | 'cancha' | 'fecha' | 'hora'>,
): Promise<ResultadoRecordatorio> {
  try {
    const permitido = await pedirPermiso();
    if (!permitido) return { ok: false, motivo: 'sin-permiso' };

    const inicio = fechaPartido(partido);
    if (!inicio) return { ok: false, motivo: 'error' };

    const ahora = new Date();
    const dosHorasAntes = new Date(inicio.getTime() - 2 * 60 * 60 * 1000);
    if (inicio.getTime() < ahora.getTime()) return { ok: false, motivo: 'partido-pasado' };

    const cuando = dosHorasAntes.getTime() > ahora.getTime()
      ? dosHorasAntes
      : new Date(ahora.getTime() + 60 * 1000);

    await Notifications.scheduleNotificationAsync({
      identifier: `partido-${partido.id}`,
      content: {
        title: '⚽ ¡Se acerca tu partido!',
        body: `Hoy juegan en ${partido.cancha} a las ${partido.hora}. Alistá los guayos, parce.`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando },
    });

    return { ok: true, cuando };
  } catch {
    return { ok: false, motivo: 'error' };
  }
}

/** Cancela el recordatorio de un partido (al salirse). */
export async function cancelarRecordatorio(partidoId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`partido-${partidoId}`);
  } catch {
    // sin notificación programada: nada que hacer
  }
}
