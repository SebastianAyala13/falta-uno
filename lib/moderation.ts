/**
 * Moderación de contenido generado por usuarios (UGC).
 *
 * Requisito de App Store (Guideline 1.2) y Google Play (UGC policy): toda app
 * con chat/muro debe (1) filtrar contenido objetable, (2) permitir reportar,
 * (3) permitir bloquear usuarios y (4) tener un EULA de tolerancia cero.
 *
 * Este módulo cubre (1): un filtro básico de lenguaje objetable. El reportar y
 * bloquear viven en el store (`lib/store.ts`); el EULA se acepta en el registro.
 */

import type { MotivoReporte } from '@/types/database';

/**
 * Lista base de términos objetables (insultos, odio, acoso) en español.
 * No pretende ser exhaustiva: es una primera barrera. La moderación real se
 * complementa con el reporte de usuarios y la revisión manual del backend.
 */
const TERMINOS_OBJETABLES: string[] = [
  'hijueputa', 'hijodeputa', 'malparid', 'gonorrea', 'marica', 'maricon',
  'puta', 'puto', 'perra', 'zorra', 'cabron', 'pirobo', 'gamin',
  'imbecil', 'idiota', 'estupid', 'retrasad', 'mongol', 'subnormal',
  'negro de mierda', 'sapo hp', 'care verga', 'verga', 'pendej',
  'violar', 'matar a', 'te voy a matar', 'nazi', 'sida',
];

/** Rango de marcas diacríticas combinadas (tildes) en Unicode. */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Normaliza: minúsculas y sin tildes, para comparar de forma robusta. */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

/**
 * Devuelve `true` si el texto contiene lenguaje objetable según el filtro base.
 * Se usa al publicar posts, comentarios y mensajes de chat.
 */
export function contieneContenidoObjetable(texto: string): boolean {
  const t = normalizar(texto);
  return TERMINOS_OBJETABLES.some((w) => t.includes(normalizar(w)));
}

/** Mensaje estándar cuando se bloquea una publicación por el filtro. */
export const MENSAJE_BLOQUEO_FILTRO =
  'Tu mensaje parece tener lenguaje ofensivo. En Falta Uno tenemos tolerancia cero con el acoso y el contenido objetable. Editalo y volvé a intentar, parce.';

/** Motivos de reporte que se le muestran al usuario. */
export const MOTIVOS_REPORTE: { id: MotivoReporte; label: string }[] = [
  { id: 'spam', label: 'Spam o estafa' },
  { id: 'acoso', label: 'Acoso o bullying' },
  { id: 'sexual', label: 'Contenido sexual' },
  { id: 'odio', label: 'Odio o violencia' },
  { id: 'otro', label: 'Otro' },
];
