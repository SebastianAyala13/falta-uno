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
