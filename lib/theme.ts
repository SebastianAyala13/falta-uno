/**
 * Hooks reactivos del tema. Usalos en componentes que deban actualizar sus
 * colores JS (íconos, degradados) al instante cuando el usuario cambia de tema.
 */
import { buildVars, getTheme, type Palette, type Theme } from '@/constants/themes';
import { useStore } from '@/lib/store';

/** Paleta del tema activo (reactivo). */
export function useTheme(): Palette {
  const id = useStore((s) => s.temaId);
  return getTheme(id).palette;
}

/** Metadata del tema activo (id, label, dark, swatch). */
export function useThemeMeta(): Theme {
  const id = useStore((s) => s.temaId);
  return getTheme(id);
}

/** Variables CSS del tema activo, para aplicar con NativeWind `vars()`. */
export function useThemeVars(): Record<string, string> {
  const id = useStore((s) => s.temaId);
  return buildVars(getTheme(id).palette);
}
