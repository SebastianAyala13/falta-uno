/**
 * Configuración general de la app Falta Uno.
 */

export const APP = {
  name: 'Falta Uno',
  tagline: 'Vos ponés las ganas, nosotros el equipo',
  defaultCity: 'Pereira',
} as const;

/**
 * URL pública del sitio (app web + páginas legales). Configurable por entorno:
 * poné EXPO_PUBLIC_SITE_URL en `.env` (o en los build args de Dokploy).
 * De ahí se deriva LEGAL_URL = <SITE_URL>/legal (privacidad y términos viven ahí).
 * Fallback sin la var: el hosting actual en GitHub Pages, para no romper builds.
 * Lo usan el registro (aceptación de términos) y el Perfil.
 */
const SITE_URL_ENV = process.env.EXPO_PUBLIC_SITE_URL?.trim();
const SITE_URL = SITE_URL_ENV || 'https://sebastianayala13.github.io/falta-uno-legal';
export const LEGAL_URL = SITE_URL_ENV ? `${SITE_URL}/legal` : SITE_URL;
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

// ----------------------------------------------------------------------------
// MARKETPLACE DE CANCHAS
// ----------------------------------------------------------------------------

/** Roles que puede tener un perfil. Un usuario puede ser ambos. */
export const ROLES = ['jugador', 'cancha'] as const;
export type Rol = (typeof ROLES)[number];

/**
 * Comisión que Falta Uno cobra a la cancha por cada reserva pagada online.
 * Se vuelve 0 si la cancha tiene una membresía activa.
 */
export const COMISION_CANCHA_DEFAULT = 0.1; // 10%

/**
 * Membresía de cancha: mientras esté activa, la cancha no paga comisión.
 * El precio es un default a confirmar con negocio; el cobro real se activa en
 * Fase 2 (Mercado Pago). Ajustá acá cuando definas el valor definitivo.
 */
export const MEMBRESIA = {
  nombre: 'Cancha Pro',
  precioMensual: 49900, // COP/mes (default a confirmar)
  beneficio: '0% de comisión en todas tus reservas',
} as const;

/**
 * `true` cuando Mercado Pago está habilitado para esta build (Fase 2).
 * Igual que Lemon Squeezy: la llave privada NUNCA va en el cliente, vive en las
 * Edge Functions. Con el flag apagado, las reservas solo aceptan efectivo y los
 * retiros/membresías quedan como "Próximamente".
 */
export const MERCADOPAGO_CONFIGURADO = !!process.env.EXPO_PUBLIC_MERCADOPAGO_ENABLED;

/** Amenidades de una cancha (para el editor del dueño y el perfil del jugador). */
export interface AmenidadDef {
  id: string;
  label: string;
  icon: string; // Ionicons
}

export const AMENIDADES: AmenidadDef[] = [
  { id: 'duchas', label: 'Duchas', icon: 'water' },
  { id: 'banos', label: 'Baños', icon: 'man' },
  { id: 'tienda', label: 'Tienda', icon: 'storefront' },
  { id: 'cafeteria', label: 'Cafetería', icon: 'cafe' },
  { id: 'gradas', label: 'Gradas', icon: 'people' },
  { id: 'parqueadero', label: 'Parqueadero', icon: 'car' },
  { id: 'cubierta_lluvia', label: 'Techada (lluvia)', icon: 'umbrella' },
  { id: 'iluminacion', label: 'Iluminación', icon: 'flashlight' },
  { id: 'alquiler_implementos', label: 'Alquiler de balón/petos', icon: 'football' },
  { id: 'wifi', label: 'WiFi', icon: 'wifi' },
  { id: 'arbitro', label: 'Árbitro', icon: 'flag' },
];

/** URLs legales específicas del marketplace de canchas. */
export const URL_MANDATO_RECAUDO = `${LEGAL_URL}/mandato-recaudo.html`;
export const URL_TERMINOS_MARKETPLACE = `${LEGAL_URL}/terminos-marketplace.html`;
export const URL_CANCELACIONES = `${LEGAL_URL}/cancelaciones.html`;

/** Versión vigente del mandato de recaudo + T&C de canchas (prueba de aceptación). */
export const LEGAL_CANCHA_VERSION = '2026-07-07';
