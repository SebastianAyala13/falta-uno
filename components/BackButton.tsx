import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

/** Une clases ignorando vacíos/false. */
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Íconos admitidos por el botón de volver/cerrar. */
type BackIcon = 'chevron-back' | 'chevron-down' | 'close';
/** `card` → círculo sobre `bg-card`; `overlay` → sobre foto (`bg-black/30`). */
type BackVariant = 'card' | 'overlay';

type BackButtonProps = {
  /** Acción al presionar. Default: `router.back()`. */
  onPress?: () => void;
  /** Ícono central. Default: `chevron-back`. */
  icon?: BackIcon;
  /** Fondo del círculo. Default: `card`. */
  variant?: BackVariant;
  /** Color del ícono (string crudo). Default: `cream` del tema activo (reactivo). */
  color?: string;
  /** Tamaño del ícono. Default: 22. */
  size?: number;
  /** Clases externas (márgenes) — el componente NO gestiona layout externo. */
  className?: string;
  /** Área táctil extra. Default: 12. */
  hitSlop?: number;
};

/**
 * Botón circular de volver/cerrar. Reemplaza el `Pressable` hand-rolled que cada
 * pantalla repetía en su header. El color del ícono sigue el tema activo vía
 * `useTheme()`. Siempre `rounded-full` (la escala de radio del design system).
 */
export function BackButton({
  onPress,
  icon = 'chevron-back',
  variant = 'card',
  color,
  size = 22,
  className = '',
  hitSlop = 12,
}: BackButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  const resolvedColor = color ?? theme.cream;
  const bg = variant === 'overlay' ? 'bg-black/30' : 'bg-card';

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={hitSlop}
      className={cx('h-10 w-10 items-center justify-center rounded-full', bg, className)}>
      <Ionicons name={icon} size={size} color={resolvedColor} />
    </Pressable>
  );
}

/** Tamaños de título con el fix anti-clipping de la fuente display horneado. */
type TitleSize = 'xl' | '2xl' | '3xl';
type TitleAlign = 'left' | 'center';

const TITLE_SPEC: Record<TitleSize, { sizeClass: string; lineHeight: number }> = {
  xl: { sizeClass: 'text-xl', lineHeight: 26 },
  '2xl': { sizeClass: 'text-2xl', lineHeight: 30 },
  '3xl': { sizeClass: 'text-3xl', lineHeight: 40 },
};

type ScreenHeaderProps = {
  /** Texto del título. Se ignora si se pasa `children`. */
  title?: string;
  /** Tamaño del título. Default: `3xl`. */
  titleSize?: TitleSize;
  /** Alineación del título. `center` activa `justify-between` + spacer derecho. */
  titleAlign?: TitleAlign;
  /** Slot a la derecha del título; activa `justify-between`. */
  right?: ReactNode;
  /** Reemplaza el título por contenido propio (headers compuestos). */
  children?: ReactNode;
  /** Agrega `border-b border-border` a la fila. */
  borderBottom?: boolean;
  /** Ícono del botón de volver. Default: `chevron-back`. */
  backIcon?: BackIcon;
  /** Variante del botón de volver. Default: `card`. */
  backVariant?: BackVariant;
  /** Acción del botón de volver. Default: `router.back()`. */
  onBack?: () => void;
  /** Muestra el botón de volver. `false` → placeholder para no mover el título. */
  showBack?: boolean;
  /** Clases del botón de volver (o del placeholder). Default: `mr-3`. */
  backClassName?: string;
  /** Clases externas de la fila (padding, ancho) — el componente NO las gestiona. */
  className?: string;
};

/**
 * Header estándar de pantalla: `BackButton` + título `font-display uppercase`
 * con el fix anti-clipping (`lineHeight`/`paddingTop`) horneado por `titleSize`.
 * El padding externo (`px-6 pb-2 pt-2`, etc.) viaja por `className`; el componente
 * no impone márgenes propios. `right`/`titleAlign=center` activan `justify-between`,
 * `children` reemplaza el título y `borderBottom` agrega el separador inferior.
 */
export function ScreenHeader({
  title,
  titleSize = '3xl',
  titleAlign = 'left',
  right,
  children,
  borderBottom = false,
  backIcon = 'chevron-back',
  backVariant = 'card',
  onBack,
  showBack = true,
  backClassName = 'mr-3',
  className = '',
}: ScreenHeaderProps) {
  const spec = TITLE_SPEC[titleSize];

  const rowClass = cx(
    'flex-row items-center',
    (right != null || titleAlign === 'center') && 'justify-between',
    borderBottom && 'border-b border-border',
    className,
  );

  const back = showBack ? (
    <BackButton icon={backIcon} variant={backVariant} onPress={onBack} className={backClassName} />
  ) : (
    <View className={cx('h-10 w-10', backClassName)} />
  );

  const titleNode =
    children ??
    (title != null ? (
      <Text
        className={cx(
          'font-display uppercase text-cream',
          spec.sizeClass,
          titleAlign === 'center' && 'text-center',
        )}
        style={{ lineHeight: spec.lineHeight, paddingTop: 2 }}>
        {title}
      </Text>
    ) : null);

  const rightNode = right ?? (titleAlign === 'center' ? <View className="w-10" /> : null);

  return (
    <View className={rowClass}>
      {back}
      {titleNode}
      {rightNode}
    </View>
  );
}
