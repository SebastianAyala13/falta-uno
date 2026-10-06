import type { CanchaDisponibilidad } from '@/types/database';
import { matchDateTime } from '@/lib/format';

export interface Slot {
  hora_inicio: string;
  hora_fin: string;
  precio: number;
  ocupado: boolean;
}

export const diaSemanaDe = (fecha: string): number => new Date(`${fecha}T12:00:00Z`).getUTCDay();

function minutos(hora: string): number {
  const [h,m] = hora.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error('Horario inválido.');
  }
  return h * 60 + m;
}

const hora = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

/** Half-open intervals: adjacent slots are allowed, any actual overlap is occupied. */
export function generarSlots(
  franjas: Pick<CanchaDisponibilidad,'hora_apertura'|'hora_cierre'|'duracion_min'|'precio'>[],
  reservas: { hora_inicio: string; hora_fin: string }[],
  fecha: string,
  ahora = Date.now(),
): Slot[] {
  const ocupados = reservas.map(r => ({inicio:minutos(r.hora_inicio),fin:minutos(r.hora_fin)}));
  const slots = new Map<string,Slot>();
  for (const f of franjas) {
    const inicio = minutos(f.hora_apertura), fin = minutos(f.hora_cierre);
    if (!Number.isInteger(f.duracion_min) || f.duracion_min <= 0 || fin <= inicio || !Number.isFinite(f.precio) || f.precio < 0) {
      throw new Error('La cancha tiene horarios inválidos. Contactá al dueño.');
    }
    for (let t = inicio; t + f.duracion_min <= fin; t += f.duracion_min) {
      const h = hora(t);
      const pasado = matchDateTime(fecha,h).getTime() <= ahora;
      slots.set(h,{hora_inicio:h,hora_fin:hora(t+f.duracion_min),precio:f.precio,
        ocupado:pasado || ocupados.some(r => t < r.fin && t+f.duracion_min > r.inicio)});
    }
  }
  return [...slots.values()].sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
}
