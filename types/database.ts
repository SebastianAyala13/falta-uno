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
  created_at: string; // timestamptz
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
