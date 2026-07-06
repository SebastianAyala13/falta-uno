/**
 * Configuración general de la app Falta Uno.
 */

export const APP = {
  name: 'Falta Uno',
  tagline: 'Vos ponés las ganas, nosotros el equipo',
  defaultCity: 'Pereira',
} as const;

/**
 * Base pública donde se hostean las páginas legales (repo público falta-uno-legal en GitHub Pages).
 * Si más adelante usás un dominio propio, cambiá solo esta constante.
 * Lo usan el registro (aceptación de términos) y el Perfil.
 */
export const LEGAL_URL = 'https://sebastianayala13.github.io/falta-uno-legal';
export const URL_PRIVACIDAD = `${LEGAL_URL}/privacidad.html`;
export const URL_TERMINOS = `${LEGAL_URL}/terminos.html`;

/**
 * Versión vigente de la Política de Privacidad / autorización de tratamiento de
 * datos (Ley 1581 de 2012). Se guarda junto a la aceptación del usuario como
 * prueba del consentimiento (habeas data). Subila cuando cambie la política.
 */
export const POLITICA_VERSION = '2026-06-25';

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
 * `true` cuando la pasarela Lemon Squeezy está habilitada para esta build.
 * La llave secreta de la API NUNCA va en el cliente: vive en las Edge Functions
 * de Supabase (`create-checkout` y `lemonsqueezy-webhook`).
 */
export const LEMONSQUEEZY_CONFIGURADO = !!process.env.EXPO_PUBLIC_LEMONSQUEEZY_ENABLED;

/**
 * Medios de pago (contexto colombiano).
 * `provider` marca qué pasarela procesa el pago: 'lemonsqueezy' abre un
 * checkout real en el navegador; 'efectivo' es acuerdo directo con el
 * organizador. Los medios con provider 'wompi' quedan como referencia futura.
 */
export type MedioPagoId = 'nequi' | 'pse' | 'tarjeta' | 'efectivo' | 'online';

export interface MedioPago {
  id: MedioPagoId;
  nombre: string;
  detalle: string;
  icon: string; // nombre de Ionicons
  provider: 'wompi' | 'efectivo' | 'lemonsqueezy';
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
  {
    id: 'online',
    nombre: 'Tarjeta / PSE / Nequi',
    detalle: 'Pago seguro con Lemon Squeezy',
    icon: 'card',
    provider: 'lemonsqueezy',
    instantaneo: true,
  },
];

/**
 * Medios de pago ACTIVOS en producción.
 *
 * "Efectivo" está siempre (pago real al organizador en la cancha). "Online"
 * (Lemon Squeezy) aparece solo cuando `EXPO_PUBLIC_LEMONSQUEEZY_ENABLED` está
 * seteada: es un checkout REAL procesado por la pasarela y confirmado por
 * webhook en el servidor. Nunca mostramos un pago simulado que finja
 * "Aprobado": eso es causa de rechazo en App Store (2.1) y Google Play.
 */
export const MEDIOS_PAGO_ACTIVOS: MedioPago[] = MEDIOS_PAGO.filter(
  (m) => m.id === 'efectivo' || (m.id === 'online' && LEMONSQUEEZY_CONFIGURADO),
);

/** Comisión de servicio de Falta Uno (sobre el precio del cupo). */
export const COMISION_SERVICIO = 0.08; // 8%
