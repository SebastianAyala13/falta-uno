/** Helpers compartidos por las consultas y sus pruebas de regresión. */
export const PAGE_SIZE = 30;

export function comprobarRespuesta<T>(resultado: { data: T | null; error: { message?: string } | null }): T | null {
  if (resultado.error) throw new Error(resultado.error.message || 'No pudimos cargar los datos.');
  return resultado.data;
}

export function unirPorId<T extends { id: string }>(anteriores: T[], nuevos: T[]): T[] {
  const filas = new Map(anteriores.map(f => [f.id, f]));
  for (const fila of nuevos) filas.set(fila.id, fila);
  return [...filas.values()];
}

/** Fecha del negocio en Colombia, independiente de la zona del dispositivo. */
export function hoyColombia(ahora = Date.now()): string {
  return new Date(ahora - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function leerPaginas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{
  data: T[] | null; error: { message?: string } | null;
}>): Promise<T[]> {
  const filas: T[] = [];
  const tamano = 200;
  for (let desde = 0; ; desde += tamano) {
    const pagina = comprobarRespuesta(await consulta(desde, desde + tamano - 1)) ?? [];
    filas.push(...pagina);
    if (pagina.length < tamano) return filas;
  }
}
