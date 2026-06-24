/**
 * Tokens de marca — Falta Uno
 * Estos colores también están declarados en `tailwind.config.js` para NativeWind.
 * Usá esta constante cuando necesités el valor en JS/TS (ej. props nativas como
 * `barStyle`, `tintColor`, gradientes o íconos) en vez de clases de Tailwind.
 */
export const Colors = {
  primary: '#10B981', // Esmeralda — color principal de la marca
  primary2: '#34D399', // Esmeralda clara — variante / highlights
  background: '#0B0F0D', // Negro Tribuna — fondo de la app
  accent: '#C6FF3D', // Lima Eléctrica — SOLO urgencia + CTA principal
  secondary: '#047857', // Verde Bosque — gradientes
  cream: '#F6F9F6', // Crema Cal — texto principal

  // Apoyo (derivados para tarjetas, bordes y texto secundario)
  card: '#141A17',
  border: '#1F2A24',
  borderStrong: '#243A2F', // bordes de tarjetas destacadas
  muted: '#9AA69F', // texto secundario — subido para contraste AA
  danger: '#EF4444',
  warning: '#F59E0B',
} as const;

export type ColorToken = keyof typeof Colors;

export default Colors;
