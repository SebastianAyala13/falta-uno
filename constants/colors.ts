/**
 * `Colors` — acceso a la paleta del **tema activo** desde JS (íconos, degradados,
 * props nativas). Es un proxy: `Colors.primary` siempre devuelve el color del
 * tema seleccionado. Para que un componente se re-renderice al instante cuando
 * cambia el tema, usá el hook `useTheme()` de `@/lib/theme`.
 *
 * Los tokens y temas viven en `constants/themes.ts`.
 */
import { DEFAULT_THEME_ID, getTheme, type Palette } from '@/constants/themes';

let _activeId: string = DEFAULT_THEME_ID;

/** Cambia el tema activo para los lectores de `Colors` (lo llama el store). */
export function setActiveColors(id: string) {
  _activeId = id;
}

export const Colors = new Proxy({} as Palette, {
  get(_target, prop: string) {
    return getTheme(_activeId).palette[prop as keyof Palette];
  },
}) as Palette;

export type ColorToken = keyof Palette;

export default Colors;
