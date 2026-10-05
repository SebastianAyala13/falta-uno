import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Pantallas de dueño de cancha: su raíz es el panel, no Inicio. */
const RUTAS_DUENO = [
  '/cancha/panel',
  '/cancha/agenda',
  '/cancha/finanzas',
  '/cancha/editar',
  '/cancha/registrar',
];

export interface DestinoInicio {
  ruta: string;
  icon: IconName;
  /** Se usa en el accessibilityLabel: "Ir a Inicio". */
  nombre: string;
}

const INICIO: DestinoInicio = { ruta: '/(tabs)', icon: 'home-outline', nombre: 'Inicio' };
const ADMIN: DestinoInicio = {
  ruta: '/admin',
  icon: 'shield-checkmark-outline',
  nombre: 'la Plataforma Madre',
};
const PANEL: DestinoInicio = {
  ruta: '/cancha/panel',
  icon: 'football-outline',
  nombre: 'Mi cancha',
};

/**
 * A dónde lleva el botón de inicio desde `pathname`. Pura a propósito: toda la
 * decisión vive acá y se puede razonar sin montar una pantalla.
 *
 * Estando YA en la raíz de una sección lleva a Inicio: apuntar a uno mismo sería
 * un botón muerto.
 */
export function destinoInicio(pathname: string): DestinoInicio {
  if (pathname === ADMIN.ruta || pathname === PANEL.ruta) return INICIO;
  if (pathname.startsWith('/admin')) return ADMIN;
  if (RUTAS_DUENO.some((r) => pathname.startsWith(r))) return PANEL;
  // Ojo: `/cancha/[id]` NO cae acá. Es la ficha pública que ve un jugador
  // buscando dónde jugar, así que su inicio es Inicio.
  return INICIO;
}

type HomeButtonProps = {
  /** Clases externas (márgenes) — el componente NO gestiona layout externo. */
  className?: string;
  /** Tamaño del ícono. Default: 22. */
  size?: number;
  /** Color del ícono (string crudo). Default: `cream` del tema activo. */
  color?: string;
  /** Área táctil extra. Default: 12. */
  hitSlop?: number;
};

/**
 * Botón circular que salta a la raíz de la sección actual. Hermano de `BackButton`:
 * mismo círculo, mismo háptico de navegación, mismo contrato de `className`.
 */
export default function HomeButton({
  className = '',
  size = 22,
  color,
  hitSlop = 12,
}: HomeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const destino = destinoInicio(pathname);

  const handlePress = () => {
    haptics.tap();
    // navigate (no push): si la raíz ya está en la pila, vuelve a ella en vez de
    // apilar un duplicado.
    router.navigate(destino.ruta);
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${destino.nombre}`}
      className={cx('h-10 w-10 items-center justify-center rounded-full bg-card', className)}>
      <Ionicons name={destino.icon} size={size} color={color ?? theme.cream} />
    </Pressable>
  );
}
