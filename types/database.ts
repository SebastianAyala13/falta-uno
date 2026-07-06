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
  created_at: string; // timestamptz
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Partido enriquecido con datos del organizador (para la UI / feeds). */
export interface PartidoConOrganizador extends Partido {
  organizador?: Pick<Profile, 'nombre' | 'avatar_url' | 'rating'>;
}
