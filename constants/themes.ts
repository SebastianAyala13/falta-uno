/**
 * Sistema de temas de Falta Uno.
 *
 * Cada tema define una paleta completa. Los colores se aplican de dos formas:
 *  - **NativeWind / clases**: vía variables CSS (ver `buildVars` + `global.css`
 *    + `tailwind.config.js`). Cambiar de tema actualiza TODAS las clases
 *    (`bg-primary`, `text-cream`, etc.) en vivo, sin tocar pantallas.
 *  - **JS** (íconos, degradados): vía el hook `useTheme()` o la constante
 *    `Colors` (proxy que sigue al tema activo).
 */

export interface Palette {
  primary: string;
  primary2: string;
  accent: string;
  secondary: string;
  background: string;
  card: string;
  cream: string;
  muted: string;
  border: string;
  borderStrong: string;
  /** Texto/ícono sobre superficies de color (accent/primary). Siempre legible. */
  ink: string;
  danger: string;
  warning: string;
}

export interface Theme {
  id: string;
  label: string;
  /** ¿Fondo oscuro? Define el estilo de la StatusBar y los degradados. */
  dark: boolean;
  /** Color representativo para el selector de temas. */
  swatch: string;
  palette: Palette;
}

// Bases compartidas por los temas oscuros (solo cambia el color de marca)
const DARK_NEUTRALS = {
  background: '#0B0F0D',
  card: '#141A17',
  cream: '#F6F9F6',
  muted: '#9AA69F',
  border: '#1F2A24',
  borderStrong: '#243A2F',
  ink: '#0B0F0D',
  danger: '#EF4444',
  warning: '#F59E0B',
};

export const THEMES: Theme[] = [
  {
    id: 'esmeralda',
    label: 'Esmeralda',
    dark: true,
    swatch: '#10B981',
    palette: { ...DARK_NEUTRALS, primary: '#10B981', primary2: '#34D399', accent: '#C6FF3D', secondary: '#047857' },
  },
  {
    id: 'azul',
    label: 'Azul',
    dark: true,
    swatch: '#3B82F6',
    palette: { ...DARK_NEUTRALS, primary: '#3B82F6', primary2: '#60A5FA', accent: '#38BDF8', secondary: '#1D4ED8' },
  },
  {
    id: 'morado',
    label: 'Morado',
    dark: true,
    swatch: '#8B5CF6',
    palette: { ...DARK_NEUTRALS, primary: '#8B5CF6', primary2: '#A78BFA', accent: '#C4B5FD', secondary: '#6D28D9' },
  },
  {
    id: 'rosado',
    label: 'Rosado',
    dark: true,
    swatch: '#EC4899',
    palette: { ...DARK_NEUTRALS, primary: '#EC4899', primary2: '#F472B6', accent: '#FBCFE8', secondary: '#BE185D' },
  },
  {
    id: 'rojo',
    label: 'Rojo',
    dark: true,
    swatch: '#EF4444',
    palette: { ...DARK_NEUTRALS, primary: '#EF4444', primary2: '#F87171', accent: '#FCA5A5', secondary: '#B91C1C' },
  },
  {
    id: 'naranja',
    label: 'Naranja',
    dark: true,
    swatch: '#F97316',
    palette: { ...DARK_NEUTRALS, primary: '#F97316', primary2: '#FB923C', accent: '#FDBA74', secondary: '#C2410C' },
  },
  {
    id: 'blanco',
    label: 'Blanco',
    dark: false,
    swatch: '#FFFFFF',
    palette: {
      primary: '#10B981',
      primary2: '#34D399',
      accent: '#C6FF3D',
      secondary: '#047857',
      background: '#F2F5F2', // Crema Cal — fondo claro
      card: '#FFFFFF',
      cream: '#101512', // texto principal (oscuro sobre claro)
      muted: '#5B6660',
      border: '#E3E9E5',
      borderStrong: '#CDD6D0',
      ink: '#0B0F0D', // texto sobre CTA (emerald/lima) — siempre oscuro
      danger: '#DC2626',
      warning: '#D97706',
    },
  },
];

export const DEFAULT_THEME_ID = 'esmeralda';

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

export function getTheme(id: string | undefined): Theme {
  return (id && THEME_BY_ID[id]) || THEME_BY_ID[DEFAULT_THEME_ID];
}

/** "#10B981" -> "16 185 129" (formato que esperan las variables CSS). */
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Construye el objeto de variables CSS para NativeWind `vars()`. */
export function buildVars(p: Palette): Record<string, string> {
  return {
    '--c-primary': hexToRgbTriplet(p.primary),
    '--c-primary2': hexToRgbTriplet(p.primary2),
    '--c-accent': hexToRgbTriplet(p.accent),
    '--c-secondary': hexToRgbTriplet(p.secondary),
    '--c-bg': hexToRgbTriplet(p.background),
    '--c-card': hexToRgbTriplet(p.card),
    '--c-text': hexToRgbTriplet(p.cream),
    '--c-muted': hexToRgbTriplet(p.muted),
    '--c-border': hexToRgbTriplet(p.border),
    '--c-border-strong': hexToRgbTriplet(p.borderStrong),
    '--c-ink': hexToRgbTriplet(p.ink),
  };
}
