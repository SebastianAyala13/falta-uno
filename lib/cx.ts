/** Une clases de NativeWind ignorando vacíos/false/null/undefined. */
export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');
