/**
 * Plataforma Madre (Admin) — capa de datos.
 *
 * Visibilidad total (RLS con is_admin() en el servidor) y control del flujo de
 * plata: procesar retiros, pausar canchas y ajustar saldo pasan por funciones
 * `security definer` que revalidan is_admin() (server-authoritative). El cliente
 * nunca escribe estados sensibles a mano.
 */
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type {
  Cancha,
  MovimientoCancha,
  Pago,
  Profile,
  Reporte,
  Reserva,
  Retiro,
} from '@/types/database';

/** ¿El perfil actual tiene rol admin? (chequeo de UI; la seguridad real es RLS). */
export function esAdmin(perfil: { roles?: string[] | null } | null | undefined): boolean {
  return !!perfil?.roles?.includes('admin');
}

export interface MetricasAdmin {
  usuarios: number;
  canchas: number;
  reservas: number;
  pagosAprobados: number;
  gmv: number; // suma de pagos aprobados (COP)
  retirosPendientes: number;
  porCiudad: { ciudad: string; canchas: number }[];
}

const VACIO: MetricasAdmin = {
  usuarios: 0,
  canchas: 0,
  reservas: 0,
  pagosAprobados: 0,
  gmv: 0,
  retirosPendientes: 0,
  porCiudad: [],
};

export async function metricas(): Promise<MetricasAdmin> {
  if (!supabaseConfigurado) return VACIO;
  const [u, c, r, pagos, retiros, ciudades] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('canchas').select('*', { count: 'exact', head: true }),
    supabase.from('reservas').select('*', { count: 'exact', head: true }),
    supabase.from('pagos').select('monto').eq('estado', 'aprobado'),
    supabase.from('retiros').select('*', { count: 'exact', head: true }).eq('estado', 'solicitado'),
    supabase.from('canchas').select('ciudad'),
  ]);

  // supabase-js no lanza ante errores de servidor/RLS: los devuelve en `.error`.
  // Sin este chequeo, un fallo se disfrazaría de "plataforma vacía" (todo en cero).
  for (const res of [u, c, r, pagos, retiros, ciudades]) {
    if (res.error) throw new Error(res.error.message ?? 'No se pudieron cargar las métricas.');
  }

  const pagosArr = (pagos.data ?? []) as { monto: number }[];
  const gmv = pagosArr.reduce((s, p) => s + (p.monto ?? 0), 0);

  const porCiudadMap: Record<string, number> = {};
  for (const row of (ciudades.data ?? []) as { ciudad: string }[]) {
    porCiudadMap[row.ciudad] = (porCiudadMap[row.ciudad] ?? 0) + 1;
  }

  return {
    usuarios: u.count ?? 0,
    canchas: c.count ?? 0,
    reservas: r.count ?? 0,
    pagosAprobados: pagosArr.length,
    gmv,
    retirosPendientes: retiros.count ?? 0,
    porCiudad: Object.entries(porCiudadMap)
      .map(([ciudad, canchas]) => ({ ciudad, canchas }))
      .sort((a, b) => b.canchas - a.canchas),
  };
}

// ---------------------------------------------------------------------------
// Listados globales (RLS admin permite leer todo)
// ---------------------------------------------------------------------------
export async function listarUsuarios(q?: string): Promise<Profile[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error('No se pudieron cargar los usuarios.');
  let filas = (data ?? []) as Profile[];
  if (q) {
    const s = q.toLowerCase();
    filas = filas.filter((u) => `${u.nombre} ${u.email} ${u.ciudad}`.toLowerCase().includes(s));
  }
  return filas;
}

export async function listarCanchasAdmin(): Promise<Cancha[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase.from('canchas').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('No se pudieron cargar las canchas.');
  return (data ?? []) as Cancha[];
}

export async function listarReservasAdmin(estado?: string): Promise<Reserva[]> {
  if (!supabaseConfigurado) return [];
  let query = supabase.from('reservas').select('*').order('fecha', { ascending: false }).limit(300);
  if (estado) query = query.eq('estado', estado);
  const { data, error } = await query;
  if (error) throw new Error('No se pudieron cargar las reservas.');
  return (data ?? []) as Reserva[];
}

export async function listarPagosAdmin(estado?: string): Promise<Pago[]> {
  if (!supabaseConfigurado) return [];
  let query = supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(300);
  if (estado) query = query.eq('estado', estado);
  const { data, error } = await query;
  if (error) throw new Error('No se pudieron cargar los pagos.');
  return (data ?? []) as Pago[];
}

export async function retirosTodos(): Promise<Retiro[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('retiros')
    .select('*')
    .order('solicitado_at', { ascending: false })
    .limit(300);
  if (error) throw new Error('No se pudieron cargar los retiros.');
  return (data ?? []) as Retiro[];
}

export async function reportesAdmin(): Promise<Reporte[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('reportes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error('No se pudieron cargar los reportes.');
  return (data ?? []) as Reporte[];
}

export async function movimientosCancha(canchaId: string): Promise<MovimientoCancha[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('movimientos_cancha')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('No se pudieron cargar los movimientos.');
  return (data ?? []) as MovimientoCancha[];
}

// ---------------------------------------------------------------------------
// Acciones sensibles (server-authoritative vía funciones security definer)
// ---------------------------------------------------------------------------
export async function procesarRetiro(
  id: string,
  estado: 'pagado' | 'rechazado',
  motivo?: string,
): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Necesitás conexión.');
  const { error } = await supabase.rpc('admin_procesar_retiro', {
    p_retiro: id,
    p_estado: estado,
    p_motivo: motivo,
  } as never);
  if (error) {
    throw new Error(
      error.message?.includes('procesado')
        ? 'Ese retiro ya fue procesado.'
        : 'No se pudo procesar el retiro. Probá de nuevo.',
    );
  }
}

export async function setEstadoCancha(id: string, estado: 'activa' | 'pausada'): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Necesitás conexión.');
  const { error } = await supabase.rpc('admin_set_estado_cancha', { p_cancha: id, p_estado: estado } as never);
  if (error) throw new Error('No se pudo actualizar la cancha.');
}

export async function ajusteSaldo(canchaId: string, monto: number, desc?: string): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Necesitás conexión.');
  const { error } = await supabase.rpc('admin_ajuste_saldo', {
    p_cancha: canchaId,
    p_monto: monto,
    p_desc: desc,
  } as never);
  if (error) throw new Error('No se pudo registrar el ajuste.');
}

/**
 * Resuelve un reporte de moderación: opcionalmente elimina el contenido reportado
 * (post/comentario/mensaje) y marca el estado. Server-authoritative (revalida is_admin()).
 */
export async function resolverReporte(
  id: string,
  estado: 'resuelto' | 'descartado',
  eliminar = false,
): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Necesitás conexión.');
  const { error } = await supabase.rpc('admin_resolver_reporte', {
    p_reporte: id,
    p_estado: estado,
    p_eliminar: eliminar,
  } as never);
  if (error) throw new Error('No se pudo resolver el reporte.');
}

/** Suspende o reactiva a un usuario (expulsión por moderación). */
export async function suspenderUsuario(usuarioId: string, suspendido: boolean): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Necesitás conexión.');
  const { error } = await supabase.rpc('admin_suspender_usuario', {
    p_usuario: usuarioId,
    p_suspendido: suspendido,
  } as never);
  if (error) throw new Error('No se pudo actualizar el usuario.');
}
