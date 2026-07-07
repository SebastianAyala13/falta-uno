/**
 * Capa de datos del marketplace de canchas (Supabase-backed).
 *
 * Todo es server-authoritative y protegido por RLS: cada dueño solo ve/gestiona
 * sus canchas, reservas, saldo y retiros. El saldo se calcula del ledger
 * (`movimientos_cancha`) vía la función `saldo_cancha`. En Fase 1 las reservas
 * se pagan en efectivo; el cobro online (Mercado Pago) llega en Fase 2.
 */
import type { Formato } from '@/constants/config';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type {
  Amenidades,
  Cancha,
  CanchaDisponibilidad,
  MovimientoCancha,
  Reserva,
  Retiro,
} from '@/types/database';

const SIN_CONEXION = 'Necesitás conexión para gestionar canchas.';

/** Referencia legible de reserva tipo FU-RXXXXX. */
export const genRefReserva = () => 'FU-R' + Math.random().toString(36).slice(2, 7).toUpperCase();

// ---------------------------------------------------------------------------
// Helpers de tiempo ('HH:mm' o 'HH:mm:ss' de Postgres)
// ---------------------------------------------------------------------------
const hhmmToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minToHHmm = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Día de la semana (0=domingo) de una fecha 'YYYY-MM-DD' sin problemas de zona. */
export const diaSemanaDe = (fecha: string): number => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
};

// ---------------------------------------------------------------------------
// Canchas (CRUD)
// ---------------------------------------------------------------------------
export interface NuevaCancha {
  nombre: string;
  direccion: string;
  zona: string;
  ciudad?: string;
  lat?: number | null;
  lng?: number | null;
  descripcion?: string | null;
  telefono?: string | null;
  formatos: Formato[];
  amenidades: Amenidades;
  fotos?: string[];
  foto_portada?: string | null;
  legal_version?: string | null;
  legal_aceptado_at?: string | null;
}

export async function crearCancha(ownerId: string, data: NuevaCancha): Promise<Cancha> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const { data: fila, error } = await supabase
    .from('canchas')
    .insert({
      owner_id: ownerId,
      nombre: data.nombre,
      direccion: data.direccion,
      zona: data.zona,
      ciudad: data.ciudad ?? 'Pereira',
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      descripcion: data.descripcion ?? null,
      telefono: data.telefono ?? null,
      formatos: data.formatos,
      amenidades: data.amenidades,
      fotos: data.fotos ?? [],
      foto_portada: data.foto_portada ?? null,
      legal_version: data.legal_version ?? null,
      legal_aceptado_at: data.legal_aceptado_at ?? null,
    } as never)
    .select()
    .single();
  if (error || !fila) throw new Error('No pudimos crear la cancha. Probá de nuevo.');
  return fila as Cancha;
}

export async function actualizarCancha(id: string, cambios: Partial<Cancha>): Promise<void> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const { error } = await supabase.from('canchas').update(cambios as never).eq('id', id);
  if (error) throw new Error('No pudimos guardar los cambios. Probá de nuevo.');
}

export async function misCanchas(ownerId: string): Promise<Cancha[]> {
  if (!supabaseConfigurado) return [];
  const { data } = await supabase
    .from('canchas')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Cancha[];
}

export async function getCancha(id: string): Promise<Cancha | null> {
  if (!supabaseConfigurado) return null;
  const { data } = await supabase.from('canchas').select('*').eq('id', id).maybeSingle();
  return (data as unknown as Cancha | null) ?? null;
}

export interface FiltrosCancha {
  zona?: string | null;
  formato?: Formato | null;
  amenidad?: string | null; // id de amenidad
}

export async function listarCanchas(filtros: FiltrosCancha = {}): Promise<Cancha[]> {
  if (!supabaseConfigurado) return [];
  let q = supabase.from('canchas').select('*').eq('estado', 'activa');
  if (filtros.zona) q = q.eq('zona', filtros.zona);
  const { data } = await q.order('created_at', { ascending: false });
  let filas = (data ?? []) as Cancha[];
  if (filtros.formato) filas = filas.filter((c) => c.formatos?.includes(filtros.formato!));
  if (filtros.amenidad) filas = filas.filter((c) => (c.amenidades as Record<string, boolean>)?.[filtros.amenidad!]);
  return filas;
}

// ---------------------------------------------------------------------------
// Disponibilidad (plantilla de horarios) + slots derivados
// ---------------------------------------------------------------------------
export async function getDisponibilidad(canchaId: string): Promise<CanchaDisponibilidad[]> {
  if (!supabaseConfigurado) return [];
  const { data } = await supabase
    .from('cancha_disponibilidad')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('dia_semana', { ascending: true });
  return (data ?? []) as CanchaDisponibilidad[];
}

export interface FranjaInput {
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
  duracion_min: number;
  precio: number;
}

/** Reemplaza toda la disponibilidad de una cancha por el set nuevo. */
export async function setDisponibilidad(canchaId: string, franjas: FranjaInput[]): Promise<void> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  await supabase.from('cancha_disponibilidad').delete().eq('cancha_id', canchaId);
  if (!franjas.length) return;
  const { error } = await supabase.from('cancha_disponibilidad').insert(
    franjas.map((f) => ({
      cancha_id: canchaId,
      dia_semana: f.dia_semana,
      hora_apertura: f.hora_apertura,
      hora_cierre: f.hora_cierre,
      duracion_min: f.duracion_min,
      precio: f.precio,
      activo: true,
    })) as never,
  );
  if (error) throw new Error('No pudimos guardar los horarios. Probá de nuevo.');
}

export interface Slot {
  hora_inicio: string; // 'HH:mm'
  hora_fin: string; // 'HH:mm'
  precio: number;
  ocupado: boolean;
}

/**
 * Slots reservables de una cancha en una fecha concreta: genera los turnos de la
 * plantilla del día y marca como `ocupado` los que ya tienen reserva activa.
 */
export async function slotsDelDia(canchaId: string, fecha: string): Promise<Slot[]> {
  if (!supabaseConfigurado) return [];
  const dia = diaSemanaDe(fecha);
  const [{ data: dispRaw }, { data: resRaw }] = await Promise.all([
    supabase
      .from('cancha_disponibilidad')
      .select('*')
      .eq('cancha_id', canchaId)
      .eq('dia_semana', dia)
      .eq('activo', true),
    supabase
      .from('reservas')
      .select('hora_inicio, estado')
      .eq('cancha_id', canchaId)
      .eq('fecha', fecha),
  ]);

  const ocupados = new Set(
    ((resRaw ?? []) as { hora_inicio: string; estado: string }[])
      .filter((r) => r.estado !== 'cancelada')
      .map((r) => hhmmToMin(r.hora_inicio)),
  );

  const slots: Slot[] = [];
  for (const f of (dispRaw ?? []) as CanchaDisponibilidad[]) {
    const ini = hhmmToMin(f.hora_apertura);
    const fin = hhmmToMin(f.hora_cierre);
    for (let t = ini; t + f.duracion_min <= fin; t += f.duracion_min) {
      slots.push({
        hora_inicio: minToHHmm(t),
        hora_fin: minToHHmm(t + f.duracion_min),
        precio: f.precio,
        ocupado: ocupados.has(t),
      });
    }
  }
  return slots.sort((a, b) => hhmmToMin(a.hora_inicio) - hhmmToMin(b.hora_inicio));
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------
export interface NuevaReserva {
  canchaId: string;
  jugadorId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precio: number;
  comision?: number;
  medio?: string; // 'efectivo' | 'online'
  estado?: 'pendiente' | 'confirmada';
  partidoId?: string | null;
  referencia?: string;
}

export async function crearReserva(data: NuevaReserva): Promise<Reserva> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const referencia = data.referencia ?? genRefReserva();
  const { data: fila, error } = await supabase
    .from('reservas')
    .insert({
      cancha_id: data.canchaId,
      jugador_id: data.jugadorId,
      fecha: data.fecha,
      hora_inicio: data.horaInicio,
      hora_fin: data.horaFin,
      precio: data.precio,
      comision: data.comision ?? 0,
      estado: data.estado ?? (data.medio === 'online' ? 'pendiente' : 'confirmada'),
      medio: data.medio ?? 'efectivo',
      partido_id: data.partidoId ?? null,
      referencia,
    } as never)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Ese horario ya está reservado, parce. Elegí otro.');
    throw new Error('No pudimos reservar. Probá de nuevo.');
  }
  return fila as Reserva;
}

export async function misReservas(jugadorId: string): Promise<Reserva[]> {
  if (!supabaseConfigurado) return [];
  const { data } = await supabase
    .from('reservas')
    .select('*')
    .eq('jugador_id', jugadorId)
    .order('fecha', { ascending: false });
  return (data ?? []) as Reserva[];
}

export async function reservasDeCancha(canchaId: string, fecha?: string): Promise<Reserva[]> {
  if (!supabaseConfigurado) return [];
  let q = supabase.from('reservas').select('*').eq('cancha_id', canchaId);
  if (fecha) q = q.eq('fecha', fecha);
  const { data } = await q.order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
  return (data ?? []) as Reserva[];
}

export async function cancelarReserva(reservaId: string): Promise<void> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const { error } = await supabase
    .from('reservas')
    .update({ estado: 'cancelada' } as never)
    .eq('id', reservaId);
  if (error) throw new Error('No pudimos cancelar la reserva.');
}

// ---------------------------------------------------------------------------
// Saldo, ledger, retiros
// ---------------------------------------------------------------------------
export async function saldoCancha(canchaId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;
  // El saldo es la suma del ledger. RLS garantiza que solo el dueño lee sus
  // movimientos, así que este cálculo es seguro y no expone saldos ajenos.
  const { data } = await supabase.from('movimientos_cancha').select('monto').eq('cancha_id', canchaId);
  return ((data ?? []) as { monto: number }[]).reduce((s, m) => s + (m.monto ?? 0), 0);
}

export async function movimientos(canchaId: string): Promise<MovimientoCancha[]> {
  if (!supabaseConfigurado) return [];
  const { data } = await supabase
    .from('movimientos_cancha')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('created_at', { ascending: false });
  return (data ?? []) as MovimientoCancha[];
}

export async function retirosDeCancha(canchaId: string): Promise<Retiro[]> {
  if (!supabaseConfigurado) return [];
  const { data } = await supabase
    .from('retiros')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('solicitado_at', { ascending: false });
  return (data ?? []) as Retiro[];
}

export async function solicitarRetiro(canchaId: string, monto: number): Promise<Retiro> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const saldo = await saldoCancha(canchaId);
  if (monto <= 0) throw new Error('Ingresá un monto válido.');
  if (monto > saldo) throw new Error('El monto supera tu saldo disponible.');
  const { data: fila, error } = await supabase
    .from('retiros')
    .insert({ cancha_id: canchaId, monto, estado: 'solicitado' } as never)
    .select()
    .single();
  if (error || !fila) throw new Error('No pudimos registrar el retiro. Probá de nuevo.');
  return fila as Retiro;
}

// ---------------------------------------------------------------------------
// Membresía (Fase 1: solo lectura del estado)
// ---------------------------------------------------------------------------
export async function membresiaActiva(canchaId: string): Promise<boolean> {
  if (!supabaseConfigurado) return false;
  const { data } = await supabase
    .from('membresias_cancha')
    .select('estado, vigente_hasta')
    .eq('cancha_id', canchaId)
    .eq('estado', 'activa')
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// Storage: subir foto de cancha al bucket público 'canchas'
// ---------------------------------------------------------------------------
export async function subirFotoCancha(uri: string): Promise<string> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const resp = await fetch(uri);
  const arrayBuffer = await resp.arrayBuffer();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${Math.random().toString(36).slice(2)}-${arrayBuffer.byteLength}.${ext}`;
  const { error } = await supabase.storage
    .from('canchas')
    .upload(path, arrayBuffer, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: false });
  if (error) throw new Error('No pudimos subir la foto. Probá de nuevo.');
  return supabase.storage.from('canchas').getPublicUrl(path).data.publicUrl;
}
