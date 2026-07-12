/**
 * Datos de prueba (mock) en contexto colombiano / Pereira.
 * Se usan mientras no haya backend conectado. Cuando integres Supabase,
 * reemplazá estas constantes por queries reales a `supabase.from(...)`.
 */
import { urgencyLabel } from '@/components/UrgencyPill';
import type { PartidoConOrganizador, Post, Profile } from '@/types/database';

export const usuarioActual: Profile = {
  id: 'mock-user-1',
  nombre: 'Santiago',
  email: 'santiago@faltauno.app',
  ciudad: 'Pereira',
  posicion: 'Mediocampista',
  nivel: 'Intermedio',
  celular: '+57 310 555 1234',
  avatar_url: null,
  partidos_jugados: 27,
  no_shows: 1,
  rating: 4.6,
  created_at: '2025-01-12T10:00:00Z',
};

export const partidosCerca: PartidoConOrganizador[] = [
  {
    id: 'p1',
    organizador_id: 'u2',
    cancha: 'Cancha La Bombonera',
    zona: 'Cuba',
    fecha: '2026-06-23',
    hora: '20:00',
    formato: '5v5',
    nivel: 'Intermedio',
    precio: 12000,
    cupos_totales: 10,
    cupos_ocupados: 9,
    descripcion: 'Falta uno parce, ya están las llaves armadas. Buena vibra.',
    created_at: '2026-06-20T09:00:00Z',
    organizador: { nombre: 'Andrés', avatar_url: null, rating: 4.8 },
  },
  {
    id: 'p2',
    organizador_id: 'u3',
    cancha: 'Sintética El Jardín',
    zona: 'Pinares',
    fecha: '2026-06-24',
    hora: '19:30',
    formato: '7v7',
    nivel: 'Competitivo',
    precio: 15000,
    cupos_totales: 14,
    cupos_ocupados: 12,
    descripcion: 'Para los que juegan en serio. Cuadramos arbitraje entre todos.',
    created_at: '2026-06-20T11:30:00Z',
    organizador: { nombre: 'Mateo', avatar_url: null, rating: 4.5 },
  },
  {
    id: 'p3',
    organizador_id: 'u4',
    cancha: 'Polideportivo El Centro',
    zona: 'Centro',
    fecha: '2026-06-25',
    hora: '21:00',
    formato: '11v11',
    nivel: 'Casual',
    precio: 10000,
    cupos_totales: 22,
    cupos_ocupados: 20,
    descripcion: 'Pa pasarla bueno un miércoles. Llevá la del equipo.',
    created_at: '2026-06-21T08:00:00Z',
    organizador: { nombre: 'Camilo', avatar_url: null, rating: 4.2 },
  },
];

/** Lista más larga para la pantalla Buscar. */
export const partidosDisponibles: PartidoConOrganizador[] = [
  ...partidosCerca,
  {
    id: 'p4',
    organizador_id: 'u5',
    cancha: 'Cancha Los Álamos',
    zona: 'Álamos',
    fecha: '2026-06-23',
    hora: '18:00',
    formato: '5v5',
    nivel: 'Casual',
    precio: 11000,
    cupos_totales: 10,
    cupos_ocupados: 6,
    descripcion: 'Tarde de fútbol, todos bienvenidos.',
    created_at: '2026-06-21T12:00:00Z',
    organizador: { nombre: 'Juan', avatar_url: null, rating: 4.0 },
  },
  {
    id: 'p5',
    organizador_id: 'u6',
    cancha: 'Mundialito Dosquebradas',
    zona: 'Dosquebradas',
    fecha: '2026-06-26',
    hora: '20:30',
    formato: '7v7',
    nivel: 'Intermedio',
    precio: 13000,
    cupos_totales: 14,
    cupos_ocupados: 8,
    descripcion: 'Llave de toda la vida busca rivales. Cuadrá tu equipo.',
    created_at: '2026-06-22T07:00:00Z',
    organizador: { nombre: 'Felipe', avatar_url: null, rating: 4.7 },
  },
];

/** Posts de ejemplo para que el muro se sienta vivo desde el arranque. */
export const postsSeed: Post[] = [
  {
    id: 'post-seed-1',
    tipo: 'encuentro',
    autor_id: 'u2',
    autor_nombre: 'Andrés',
    autor_avatar: null,
    texto: 'Partidazo anoche en La Bombonera 🔥 quedó 6-5, se definió en el último minuto. ¿Quién se le mide la otra semana?',
    foto_url: null,
    partido_id: 'p1',
    likes: ['u3', 'u4', 'u5'],
    created_at: '2026-06-22T23:30:00Z',
  },
  {
    id: 'post-seed-2',
    tipo: 'pregunta',
    autor_id: 'u4',
    autor_nombre: 'Camilo',
    autor_avatar: null,
    texto: '¿Mejor cancha sintética en Pereira para 7v7? Estoy armando un parche fijo los jueves, parce 🙌',
    foto_url: null,
    partido_id: null,
    likes: ['u2'],
    created_at: '2026-06-22T15:10:00Z',
  },
  {
    id: 'post-seed-3',
    tipo: 'pregunta',
    autor_id: 'u6',
    autor_nombre: 'Felipe',
    autor_avatar: null,
    texto: '¿Ustedes con qué guayos juegan en sintética? Las mías ya están lisas y me resbalo todo el tiempo 😅',
    foto_url: null,
    partido_id: null,
    likes: ['u3', 'u5'],
    created_at: '2026-06-21T19:45:00Z',
  },
];

/** Formatea un precio en pesos colombianos. */
export function formatearPrecio(valor: number): string {
  return '$' + valor.toLocaleString('es-CO');
}

/** Cupos que faltan, en copy de la app: "¡Falta 1!", "Faltan 2", "Cupo lleno". */
export function cuposFaltantes(p: { cupos_totales: number; cupos_ocupados: number }): string {
  return urgencyLabel(p.cupos_totales - p.cupos_ocupados);
}
