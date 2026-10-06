import type { Partido } from '@/types/database';

// Expo local notifications are native-only. Keep their native module out of the
// browser bundle and avoid requesting permissions for an unsupported operation.
export function configurarNotificaciones() {}
export async function pedirPermiso() { return false; }
export interface ResultadoRecordatorio {
  ok: boolean;
  cuando?: Date;
  motivo?: 'sin-permiso' | 'partido-pasado' | 'error' | 'no-compatible';
}
export async function programarRecordatorio(
  _partido: Pick<Partido,'id'|'cancha'|'fecha'|'hora'>,
): Promise<ResultadoRecordatorio> { return {ok:false,motivo:'no-compatible'}; }
export async function cancelarRecordatorio(_partidoId: string) {}

export async function cancelarTodosRecordatorios() {}
