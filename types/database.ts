/**
 * Tipos de la base de datos de Supabase para Falta Uno.
 *
 * Estos tipos describen las tablas del backend. Cuando conectes Supabase real,
 * podés regenerarlos automáticamente con:
 *
 *   npx supabase gen types typescript --project-id <TU_PROJECT_ID> > types/database.ts
 *
 * Por ahora están escritos a mano para tipar el cliente y los datos mock.
 */

import type { Formato, Nivel, Posicion } from '@/constants/config';

/** Perfil de un jugador. Relacionado 1:1 con auth.users de Supabase. */
export interface Profile {
  id: string; // uuid (auth.users.id)
  nombre: string;
  email: string;
  ciudad: string;
  posicion: Posicion;
  nivel: Nivel;
  celular: string;
  avatar_url: string | null;
  partidos_jugados: number;
  no_shows: number;
  rating: number; // 0 - 5
  // Prueba de consentimiento (Ley 1581 de 2012 · habeas data)
  politica_version?: string | null; // versión de política aceptada
  politica_aceptada_at?: string | null; // fecha/hora de aceptación
  roles?: string[]; // 'jugador' y/o 'cancha'
  created_at: string; // timestamptz
}

// ----------------------------------------------------------------------------
// MARKETPLACE DE CANCHAS
// ----------------------------------------------------------------------------

/** Amenidades de una cancha (checklist de servicios para el jugador). */
export interface Amenidades {
  duchas?: boolean;
  banos?: boolean;
  tienda?: boolean;
  cafeteria?: boolean;
  gradas?: boolean;
  parqueadero?: boolean;
  cubierta_lluvia?: boolean; // preparada para lluvia (techada)
  iluminacion?: boolean; // luz para jugar de noche
  alquiler_implementos?: boolean; // balón, petos
  wifi?: boolean;
  arbitro?: boolean;
}

/** Una cancha (venue) administrada por un dueño (profiles.roles incluye 'cancha'). */
export interface Cancha {
  id: string;
  owner_id: string;
  nombre: string;
  direccion: string;
  zona: string;
  ciudad: string;
  lat: number | null;
  lng: number | null;
  descripcion: string | null;
  telefono: string | null;
  formatos: Formato[];
  amenidades: Amenidades;
  fotos: string[];
  foto_portada: string | null;
  estado: 'activa' | 'pausada';
  comision_pct: number;
  mp_account_ref: string | null;
  legal_version: string | null;
  legal_aceptado_at: string | null;
  created_at: string;
}

/** Plantilla de horario recurrente de una cancha (genera los slots reservables). */
export interface CanchaDisponibilidad {
  id: string;
  cancha_id: string;
  dia_semana: number; // 0=domingo … 6=sábado
  hora_apertura: string; // 'HH:mm'
  hora_cierre: string; // 'HH:mm'
  duracion_min: number;
  precio: number;
  activo: boolean;
  created_at: string;
}

export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';

/** Reserva de un slot de cancha por un jugador. */
export interface Reserva {
  id: string;
  cancha_id: string;
  jugador_id: string;
  fecha: string; // 'YYYY-MM-DD'
  hora_inicio: string; // 'HH:mm'
  hora_fin: string; // 'HH:mm'
  precio: number;
  comision: number;
  estado: EstadoReserva;
  medio: string; // 'efectivo' | 'online'
  pago_id: string | null;
  partido_id: string | null; // si se abrió como partido para que otros se sumen
  referencia: string;
  created_at: string;
}

export type TipoMovimiento = 'ingreso_reserva' | 'comision' | 'retiro' | 'ajuste';

/** Movimiento del ledger de una cancha (fuente de verdad del saldo). */
export interface MovimientoCancha {
  id: string;
  cancha_id: string;
  tipo: TipoMovimiento;
  monto: number; // con signo
  reserva_id: string | null;
  retiro_id: string | null;
  descripcion: string | null;
  created_at: string;
}

export type EstadoRetiro = 'solicitado' | 'procesando' | 'pagado' | 'rechazado';

/** Solicitud de desembolso del saldo de una cancha. */
export interface Retiro {
  id: string;
  cancha_id: string;
  monto: number;
  estado: EstadoRetiro;
  mp_payout_ref: string | null;
  motivo_rechazo: string | null;
  solicitado_at: string;
  procesado_at: string | null;
}

/** Membresía de una cancha (activa ⇒ 0% de comisión). */
export interface MembresiaCancha {
  id: string;
  cancha_id: string;
  plan: string;
  estado: 'activa' | 'vencida' | 'cancelada';
  vigente_hasta: string | null;
  mp_preapproval_ref: string | null;
  created_at: string;
}

/** Un partido publicado por un usuario. */
export interface Partido {
  id: string; // uuid
  organizador_id: string; // profiles.id
  cancha: string;
  zona: string;
  fecha: string; // date (YYYY-MM-DD)
  hora: string; // time (HH:mm)
  formato: Formato;
  nivel: Nivel;
  precio: number; // precio por jugador (COP)
  cupos_totales: number;
  cupos_ocupados: number;
  descripcion: string | null;
  lat?: number | null; // ubicación de la cancha (opcional)
  lng?: number | null;
  foto_url?: string | null; // foto de la cancha (opcional)
  created_at: string; // timestamptz
}

/** Calificación que un jugador deja tras un partido (sistema de reputación). */
export interface Calificacion {
  id: string;
  partido_id: string;
  autor_id: string;
  estrellas: number; // experiencia del partido (1-5)
  organizador_estrellas: number; // calificación al organizador (1-5)
  hubo_no_show: boolean; // ¿faltó alguien sin avisar?
  comentario: string;
  created_at: string;
}

/** Mensaje del chat de un partido. */
export interface Mensaje {
  id: string;
  partido_id: string;
  autor_id: string;
  autor_nombre: string;
  texto: string;
  created_at: string;
}

/** Tipo de publicación del muro social. */
export type PostTipo = 'recap' | 'encuentro' | 'pregunta';

/** Publicación del muro social (recap automático, encuentro o pregunta). */
export interface Post {
  id: string;
  tipo: PostTipo;
  autor_id: string;
  autor_nombre: string;
  autor_avatar: string | null;
  texto: string;
  foto_url: string | null;
  partido_id: string | null; // ligado a un partido (recap/encuentro)
  likes: string[]; // ids de usuarios que dieron like
  created_at: string;
}

/** Comentario sobre un post del muro. */
export interface Comentario {
  id: string;
  post_id: string;
  autor_id: string;
  autor_nombre: string;
  texto: string;
  created_at: string;
}

/** Tipo de contenido que se puede reportar. */
export type TipoContenido = 'post' | 'comentario' | 'mensaje';

/** Motivo por el que se reporta un contenido (moderación UGC). */
export type MotivoReporte = 'spam' | 'acoso' | 'sexual' | 'odio' | 'otro';

/** Reporte de contenido objetable (requisito App Store 1.2 / Google UGC). */
export interface Reporte {
  id: string;
  tipo: TipoContenido;
  contenido_id: string; // id del post/comentario/mensaje reportado
  autor_id: string; // autor del contenido reportado
  reportado_por: string; // usuario que reporta
  motivo: MotivoReporte;
  texto: string; // copia del contenido para revisión
  created_at: string;
}

/** Bloqueo de un usuario por parte de otro (no vuelve a ver su contenido). */
export interface Bloqueo {
  id: string;
  usuario_id: string; // quien bloquea
  bloqueado_id: string; // a quién bloquea
  created_at: string;
}

/** Tabla pivote: jugadores inscritos en un partido. */
export interface PartidoJugador {
  id: string; // uuid
  partido_id: string; // partidos.id
  jugador_id: string; // profiles.id
  posicion: Posicion;
  confirmado: boolean;
  created_at: string; // timestamptz
}

export type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado';

/** Pago de un cupo (procesamiento simulado, real-ready para Wompi). */
export interface Pago {
  id: string; // uuid
  partido_id: string;
  jugador_id: string;
  medio: string; // MedioPagoId
  monto: number; // total cobrado (cupo + comisión)
  comision: number;
  estado: EstadoPago;
  referencia: string; // referencia legible tipo FU-XXXX
  created_at: string;
}

/**
 * Forma del esquema esperado por `@supabase/supabase-js`.
 * Tiparlo así habilita autocompletado en `supabase.from('...')`.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'partidos_jugados' | 'no_shows' | 'rating'> &
          Partial<Pick<Profile, 'partidos_jugados' | 'no_shows' | 'rating'>>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      partidos: {
        Row: Partido;
        Insert: Omit<Partido, 'id' | 'created_at' | 'cupos_ocupados'> &
          Partial<Pick<Partido, 'cupos_ocupados'>>;
        Update: Partial<Partido>;
        Relationships: [];
      };
      partido_jugadores: {
        Row: PartidoJugador;
        Insert: Omit<PartidoJugador, 'id' | 'created_at' | 'confirmado'> &
          Partial<Pick<PartidoJugador, 'confirmado'>>;
        Update: Partial<PartidoJugador>;
        Relationships: [];
      };
      pagos: {
        Row: Pago;
        Insert: Omit<Pago, 'id' | 'created_at'>;
        Update: Partial<Pago>;
        Relationships: [];
      };
      mensajes: {
        Row: Mensaje;
        Insert: Omit<Mensaje, 'id' | 'created_at'>;
        Update: Partial<Mensaje>;
        Relationships: [];
      };
      calificaciones: {
        Row: Calificacion;
        Insert: Omit<Calificacion, 'id' | 'created_at'>;
        Update: Partial<Calificacion>;
        Relationships: [];
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'likes'> & Partial<Pick<Post, 'likes'>>;
        Update: Partial<Post>;
        Relationships: [];
      };
      comentarios: {
        Row: Comentario;
        Insert: Omit<Comentario, 'id' | 'created_at'>;
        Update: Partial<Comentario>;
        Relationships: [];
      };
      post_likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string };
        Update: Partial<{ post_id: string; user_id: string }>;
        Relationships: [];
      };
      canchas: {
        Row: Cancha;
        Insert: Omit<Cancha, 'id' | 'created_at'> & Partial<Pick<Cancha, 'comision_pct'>>;
        Update: Partial<Cancha>;
        Relationships: [];
      };
      cancha_disponibilidad: {
        Row: CanchaDisponibilidad;
        Insert: Omit<CanchaDisponibilidad, 'id' | 'created_at'>;
        Update: Partial<CanchaDisponibilidad>;
        Relationships: [];
      };
      reservas: {
        Row: Reserva;
        Insert: Omit<Reserva, 'id' | 'created_at'>;
        Update: Partial<Reserva>;
        Relationships: [];
      };
      movimientos_cancha: {
        Row: MovimientoCancha;
        Insert: Omit<MovimientoCancha, 'id' | 'created_at'>;
        Update: Partial<MovimientoCancha>;
        Relationships: [];
      };
      retiros: {
        Row: Retiro;
        Insert: Omit<Retiro, 'id' | 'solicitado_at' | 'procesado_at'>;
        Update: Partial<Retiro>;
        Relationships: [];
      };
      membresias_cancha: {
        Row: MembresiaCancha;
        Insert: Omit<MembresiaCancha, 'id' | 'created_at'>;
        Update: Partial<MembresiaCancha>;
        Relationships: [];
      };
      reportes: {
        Row: Reporte;
        Insert: Omit<Reporte, 'id' | 'created_at'>;
        Update: Partial<Reporte>;
        Relationships: [];
      };
      bloqueos: {
        Row: Bloqueo;
        Insert: Omit<Bloqueo, 'id' | 'created_at'>;
        Update: Partial<Bloqueo>;
        Relationships: [];
      };
    };
    Views: {
      // Vista pública con solo columnas seguras de otros jugadores (sin PII).
      // La lectura directa de `profiles` está restringida al dueño por RLS.
      perfiles_publicos: {
        Row: Pick<Profile, 'id' | 'nombre' | 'avatar_url' | 'posicion' | 'nivel' | 'rating'>;
        Relationships: [];
      };
    };
    Functions: {
      saldo_cancha: {
        Args: { p_cancha: string };
        Returns: number;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_procesar_retiro: {
        Args: { p_retiro: string; p_estado: string; p_motivo?: string };
        Returns: undefined;
      };
      admin_set_estado_cancha: {
        Args: { p_cancha: string; p_estado: string };
        Returns: undefined;
      };
      admin_ajuste_saldo: {
        Args: { p_cancha: string; p_monto: number; p_desc?: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Partido enriquecido con datos del organizador (para la UI / feeds). */
export interface PartidoConOrganizador extends Partido {
  organizador?: Pick<Profile, 'nombre' | 'avatar_url' | 'rating'>;
}
