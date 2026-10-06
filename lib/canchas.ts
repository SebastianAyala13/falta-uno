import { subirImagen } from '@/lib/media';
import { patronBusqueda } from '@/lib/partidos';
/**
 * Capa de datos del marketplace de canchas (Supabase-backed).
 *
 * Todo es server-authoritative y protegido por RLS: cada dueño solo ve/gestiona
 * sus canchas, reservas, saldo y retiros. El saldo se calcula del ledger
 * (`movimientos_cancha`) vía la función `saldo_cancha`. En Fase 1 las reservas
 * se pagan en efectivo; el cobro online (PayU) llega en Fase 2.
 */
import type { Formato } from '@/constants/config';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { comprobarRespuesta, hoyColombia } from '@/lib/data-utils';
import { diaSemanaDe, generarSlots, type Slot } from '@/lib/slots';
export { diaSemanaDe, type Slot } from '@/lib/slots';
import type {
  Amenidades,
  Cancha,
  CanchaDisponibilidad,
  DatosDesembolso,
  MovimientoCancha,
  Reserva,
  Retiro,
} from '@/types/database';

const SIN_CONEXION = 'Necesitás conexión para gestionar canchas.';

/** Referencia legible de reserva tipo FU-RXXXXX. */
export const genRefReserva = () => 'FU-R' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,12).toUpperCase();

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
  const { data, error } = await supabase
    .from('canchas')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data ?? []) as Cancha[];
}

export async function getCancha(id: string): Promise<Cancha | null> {
  if (!supabaseConfigurado) return null;
  const { data, error } = await supabase.from('canchas').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data as unknown as Cancha | null) ?? null;
}

export interface FiltrosCancha {
  texto?: string;
  pagina?: number;
  zona?: string | null;
  formato?: Formato | null;
  amenidad?: string | null; // id de amenidad
}

export async function listarCanchas(filtros: FiltrosCancha = {}): Promise<Cancha[]> {
  if (!supabaseConfigurado) return [];
  let q = supabase.from('canchas').select('*').eq('estado', 'activa').eq('oculto',false);
  if (filtros.zona) q = q.eq('zona', filtros.zona);
  if (filtros.formato) q = q.contains('formatos', [filtros.formato]);
  if (filtros.amenidad) q = q.contains('amenidades', {[filtros.amenidad]:true});
  if (filtros.texto?.trim()) {
    const patron = patronBusqueda(filtros.texto.trim());
    q = q.or(`nombre.ilike.${patron},zona.ilike.${patron}`);
  }
  const inicio = Math.max(0, filtros.pagina ?? 0) * 30;
  q = q.order('created_at', { ascending: false }).order('id', {ascending:false});
  if (filtros.pagina !== undefined) q = q.range(inicio,inicio+29);
  const { data, error } = await q;
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data ?? []) as Cancha[];
}

// ---------------------------------------------------------------------------
// Disponibilidad (plantilla de horarios) + slots derivados
// ---------------------------------------------------------------------------
export async function getDisponibilidad(canchaId: string): Promise<CanchaDisponibilidad[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('cancha_disponibilidad')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('dia_semana', { ascending: true });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
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
  comprobarRespuesta(await supabase.rpc('reemplazar_disponibilidad', {p_cancha:canchaId,p_franjas:franjas} as never));
}

/** Horarios reservables; ocupación pública sin revelar jugadores ni pagos. */
export async function slotsDelDia(canchaId: string, fecha: string): Promise<Slot[]> {
  if (!supabaseConfigurado) return [];
  const [disp,res] = await Promise.all([
    supabase.from('cancha_disponibilidad').select('*').eq('cancha_id',canchaId)
      .eq('dia_semana',diaSemanaDe(fecha)).eq('activo',true).order('id'),
    supabase.rpc('horarios_ocupados',{p_cancha:canchaId,p_fecha:fecha} as never),
  ]);
  const franjas = (comprobarRespuesta(disp) ?? []) as CanchaDisponibilidad[];
  const ocupados = (comprobarRespuesta(res) ?? []) as unknown as {hora_inicio:string;hora_fin:string}[];
  return generarSlots(franjas,ocupados,fecha);
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
    if (error.code === '23505' || error.code === '23P01') throw new Error('Ese horario ya está reservado, parce. Elegí otro.');
    throw new Error('No pudimos reservar. Probá de nuevo.');
  }
  if (!fila) throw new Error('No pudimos confirmar el registro de la reserva.');
  return fila as Reserva;
}

export async function misReservas(jugadorId: string): Promise<Reserva[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('jugador_id', jugadorId)
    .order('fecha', { ascending: false });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data ?? []) as Reserva[];
}

export async function reservasDeCancha(canchaId: string, fecha?: string): Promise<Reserva[]> {
  if (!supabaseConfigurado) return [];
  let q = supabase.from('reservas').select('*').eq('cancha_id', canchaId);
  if (fecha) q = q.eq('fecha', fecha);
  const { data, error } = await q.order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
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
  const saldo = comprobarRespuesta(await supabase.rpc('saldo_cancha',{p_cancha:canchaId} as never));
  return Number(saldo ?? 0);
}

export async function movimientos(canchaId: string): Promise<MovimientoCancha[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('movimientos_cancha')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data ?? []) as MovimientoCancha[];
}

export async function retirosDeCancha(canchaId: string): Promise<Retiro[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from('retiros')
    .select('*')
    .eq('cancha_id', canchaId)
    .order('solicitado_at', { ascending: false });
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data ?? []) as Retiro[];
}

export async function solicitarRetiro(canchaId: string, monto: number): Promise<Retiro> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  if (!Number.isSafeInteger(monto) || monto <= 0) throw new Error('Ingresá un monto válido.');
  const { data: fila, error } = await supabase
    .from('retiros')
    .insert({ cancha_id: canchaId, monto, estado: 'solicitado' } as never)
    .select()
    .single();
  if (error || !fila) throw new Error(error?.message?.includes('saldo') ? 'El monto supera tu saldo disponible.' : 'No pudimos registrar el retiro. Probá de nuevo.');
  return fila as Retiro;
}

// ---------------------------------------------------------------------------
// Membresía (Fase 1: solo lectura del estado)
// ---------------------------------------------------------------------------
export async function membresiaActiva(canchaId: string): Promise<boolean> {
  if (!supabaseConfigurado) return false;
  const { data, error } = await supabase
    .from('membresias_cancha')
    .select('estado, vigente_hasta')
    .eq('cancha_id', canchaId)
    .eq('estado', 'activa')
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoyColombia()}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return !!data;
}

// ---------------------------------------------------------------------------
// Storage: subir foto de cancha al bucket público 'canchas'
// ---------------------------------------------------------------------------
export async function subirFotoCancha(uri: string): Promise<string> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const {data,error} = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Necesitás iniciar sesión para subir fotos.');
  const url = await subirImagen(uri,data.user.id);
  if (!url) throw new Error('No pudimos subir la foto.');
  return url;
}

// ---------------------------------------------------------------------------
// Onboarding: un establecimiento crea N canchas (cada una es una fila reservable)
// ---------------------------------------------------------------------------
export interface CanchaDelEstablecimiento {
  nombre: string;
  formato: Formato;
  precio: number;
  duracion: number; // minutos
  fotos: string[];
}
export interface HorarioEstablecimiento {
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
}
export interface NuevoEstablecimiento {
  direccion: string;
  zona: string;
  ciudad: string;
  lat?: number | null;
  lng?: number | null;
  telefono?: string | null;
  descripcion?: string | null;
  amenidades: Amenidades;
  canchas: CanchaDelEstablecimiento[];
  horarios: HorarioEstablecimiento[];
  legal_version?: string | null;
  legal_aceptado_at?: string | null;
}

/**
 * Crea el establecimiento: una fila `canchas` por cada cancha física (compartiendo
 * dirección/zona/ciudad/amenidades/teléfono) + su disponibilidad (los horarios del
 * establecimiento con la duración y el precio de cada cancha). Devuelve las canchas
 * creadas. No rompe nada: cada cancha sigue siendo una fila reservable normal.
 */
export async function crearEstablecimiento(
  ownerId: string,
  data: NuevoEstablecimiento,
): Promise<Cancha[]> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const creadas: Cancha[] = [];
  for (const c of data.canchas) {
    const cancha = await crearCancha(ownerId, {
      nombre: c.nombre,
      direccion: data.direccion,
      zona: data.zona,
      ciudad: data.ciudad,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      descripcion: data.descripcion ?? null,
      telefono: data.telefono ?? null,
      formatos: [c.formato],
      amenidades: data.amenidades,
      fotos: c.fotos,
      foto_portada: c.fotos[0] ?? null,
      legal_version: data.legal_version ?? null,
      legal_aceptado_at: data.legal_aceptado_at ?? null,
    });
    if (data.horarios.length) {
      await setDisponibilidad(
        cancha.id,
        data.horarios.map((h) => ({
          dia_semana: h.dia_semana,
          hora_apertura: h.hora_apertura,
          hora_cierre: h.hora_cierre,
          duracion_min: c.duracion,
          precio: c.precio,
        })),
      );
    }
    creadas.push(cancha);
  }
  return creadas;
}

// ---------------------------------------------------------------------------
// Datos de desembolso (cuenta del dueño) — se editan en el panel de Finanzas
// ---------------------------------------------------------------------------
export async function getDatosDesembolso(ownerId: string): Promise<DatosDesembolso | null> {
  if (!supabaseConfigurado) return null;
  const { data, error } = await supabase
    .from('datos_desembolso')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error('No pudimos cargar los datos de la cancha. Revisá tu conexión.');
  return (data as unknown as DatosDesembolso | null) ?? null;
}

export async function guardarDatosDesembolso(
  ownerId: string,
  datos: Pick<DatosDesembolso, 'banco' | 'tipo_cuenta' | 'numero' | 'titular' | 'documento'>,
): Promise<void> {
  if (!supabaseConfigurado) throw new Error(SIN_CONEXION);
  const { error } = await supabase
    .from('datos_desembolso')
    .upsert({ owner_id: ownerId, ...datos, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error('No pudimos guardar tus datos de desembolso. Probá de nuevo.');
}
