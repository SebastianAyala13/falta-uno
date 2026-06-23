/**
 * Configuración general de la app Falta Uno.
 */

export const APP = {
  name: 'Falta Uno',
  tagline: 'Vos ponés las ganas, nosotros el equipo',
  defaultCity: 'Pereira',
} as const;

/** Posiciones de juego disponibles en el registro y perfil. */
export const POSICIONES = ['Portero', 'Defensa', 'Mediocampista', 'Delantero'] as const;
export type Posicion = (typeof POSICIONES)[number];

/** Niveles de juego. */
export const NIVELES = ['Casual', 'Intermedio', 'Competitivo'] as const;
export type Nivel = (typeof NIVELES)[number];

/** Formatos de partido (jugadores por equipo). */
export const FORMATOS = ['5v5', '7v7', '11v11'] as const;
export type Formato = (typeof FORMATOS)[number];

/** Cupos totales por formato (ambos equipos). */
export const CUPOS_POR_FORMATO: Record<Formato, number> = {
  '5v5': 10,
  '7v7': 14,
  '11v11': 22,
};

/** Zonas de Pereira para los filtros de búsqueda. */
export const ZONAS = [
  'Centro',
  'Cuba',
  'Dosquebradas',
  'Pinares',
  'La Villa',
  'El Poblado',
  'Álamos',
] as const;
export type Zona = (typeof ZONAS)[number];

/**
 * Medios de pago (contexto colombiano).
 * El procesamiento es simulado; `provider` marca a qué pasarela se enchufaría
 * en producción (Wompi soporta Nequi, PSE, tarjeta y Bancolombia).
 */
export type MedioPagoId = 'nequi' | 'pse' | 'tarjeta' | 'efectivo';

export interface MedioPago {
  id: MedioPagoId;
  nombre: string;
  detalle: string;
  icon: string; // nombre de Ionicons
  provider: 'wompi' | 'efectivo';
  instantaneo: boolean;
}

export const MEDIOS_PAGO: MedioPago[] = [
  {
    id: 'nequi',
    nombre: 'Nequi',
    detalle: 'Pago instantáneo desde tu Nequi',
    icon: 'phone-portrait',
    provider: 'wompi',
    instantaneo: true,
  },
  {
    id: 'pse',
    nombre: 'PSE',
    detalle: 'Débito desde tu banco',
    icon: 'business',
    provider: 'wompi',
    instantaneo: true,
  },
  {
    id: 'tarjeta',
    nombre: 'Tarjeta',
    detalle: 'Crédito o débito',
    icon: 'card',
    provider: 'wompi',
    instantaneo: true,
  },
  {
    id: 'efectivo',
    nombre: 'Efectivo en cancha',
    detalle: 'Le pagás al organizador al llegar',
    icon: 'cash',
    provider: 'efectivo',
    instantaneo: false,
  },
];

/** Comisión de servicio de Falta Uno (sobre el precio del cupo). */
export const COMISION_SERVICIO = 0.08; // 8%
