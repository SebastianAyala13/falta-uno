import type { FranjaInput } from '@/lib/canchas';
import type { CanchaDisponibilidad } from '@/types/database';

/** Días de la semana tal como los indexa `dia_semana` en la base: 0 = domingo. */
export const DIAS_SEMANA = 7;

/** Duración por defecto de un turno, en minutos, cuando la base no dice otra. */
export const DURACION_POR_DEFECTO = 60;

/** Configuración de un día en el editor de horarios. */
export interface DiaConfig {
  abierto: boolean;
  apertura: string; // 'HH:mm'
  cierre: string; // 'HH:mm'
  precio: string; // texto del input numérico
  duracion: number; // minutos por turno; la base guarda uno por franja
}

export const diaInicial = (): DiaConfig => ({
  abierto: false,
  apertura: '08:00',
  cierre: '22:00',
  precio: '',
  duracion: DURACION_POR_DEFECTO,
});

/**
 * Convierte la disponibilidad guardada en la configuración del editor.
 *
 * Lee `duracion_min`. Antes no lo hacía, y como al guardar se escribía un 60
 * fijo, abrir el editor y tocar «Guardar» convertía una cancha de 90 minutos en
 * turnos de una hora con el precio de hora y media: el jugador pagaba 90 por 60.
 */
export function diasDesdeFranjas(franjas: CanchaDisponibilidad[]): DiaConfig[] {
  const dias = Array.from({ length: DIAS_SEMANA }, () => diaInicial());
  for (const f of franjas) {
    if (f.dia_semana < 0 || f.dia_semana >= DIAS_SEMANA) continue;
    dias[f.dia_semana] = {
      abierto: true,
      apertura: f.hora_apertura.slice(0, 5),
      cierre: f.hora_cierre.slice(0, 5),
      precio: String(f.precio),
      duracion: f.duracion_min || DURACION_POR_DEFECTO,
    };
  }
  return dias;
}

/** Convierte la configuración del editor en las franjas que espera el servidor. */
export function franjasDesdeDias(dias: DiaConfig[]): FranjaInput[] {
  return dias
    .map((d, dia_semana) => ({ d, dia_semana }))
    .filter(({ d }) => d.abierto)
    .map(({ d, dia_semana }) => ({
      dia_semana,
      hora_apertura: d.apertura,
      hora_cierre: d.cierre,
      duracion_min: d.duracion,
      precio: Number(d.precio) || 0,
    }));
}
