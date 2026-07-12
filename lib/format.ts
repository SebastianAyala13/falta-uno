/** Utilidades de formato (fechas, precios) en contexto colombiano. */

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** "2026-06-23" -> "Mar 23 jun" */
export function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS_CORTOS[date.getUTCDay()]} ${d} ${MESES[m - 1]}`;
}

/** "2026-06-23" -> "Martes 23 de junio" */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const mesLargo = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ][m - 1];
  return `${DIAS[date.getUTCDay()]} ${d} de ${mesLargo}`;
}

/** 12000 -> "$12.000" */
export function precioCOP(valor: number): string {
  return '$' + valor.toLocaleString('es-CO');
}

/** Combina fecha ("2026-06-23") + hora ("20:00") en un Date local. */
export function matchDateTime(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

/** ISO -> "hace 2 h", "hace 5 min", "ahora". */
export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const sem = Math.floor(d / 7);
  return `hace ${sem} sem`;
}

/**
 * Copy de urgencia de cupos — **fuente única de verdad** del wording.
 * `faltan<=0` → `fullLabel` (default `'Cupo lleno'`);
 * `faltan===1` → `urgentLabel` (default `'¡Falta 1!'`);
 * si no, `` `Faltan ${faltan}` ``. Pura: no depende del tema ni del store.
 */
export function urgencyLabel(
  faltan: number,
  { urgentLabel = '¡Falta 1!', fullLabel = 'Cupo lleno' }: { urgentLabel?: string; fullLabel?: string } = {},
): string {
  if (faltan <= 0) return fullLabel;
  if (faltan === 1) return urgentLabel;
  return `Faltan ${faltan}`;
}
