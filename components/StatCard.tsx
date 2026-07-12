import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Une clases ignorando vacíos/false. */
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type StatCardProps = {
  /** Valor principal, ya formateado como string. */
  value: string;
  /** Etiqueta descriptiva. */
  label: string;
  /** Ícono opcional. Si se omite, no se dibuja ícono. */
  icon?: IconName;
  /** Tratamiento del ícono: suelto arriba, dentro de un badge circular, o en línea con la etiqueta. */
  iconStyle?: 'plain' | 'badge' | 'inline';
  /** Color de acento del ícono (y del fondo del badge). Default: `primary` del tema. */
  tint?: string;
  /**
   * Color del valor (string crudo — nunca una clase, para admitir `Colors.*` runtime).
   * Default: `cream` del tema.
   */
  valueColor?: string;
  /** Tamaño del valor: `sm` → text-2xl, `md` → text-3xl (con el fix de clipping horneado). */
  size?: 'sm' | 'md';
  /** `stat` → valor en font-display; `info` → valor en font-body-semibold text-sm (info tile). */
  variant?: 'stat' | 'info';
  /** Alineación del contenido. */
  align?: 'left' | 'center';
  /** Etiqueta arriba o abajo del valor. */
  labelPosition?: 'top' | 'bottom';
  /** Tracking de la etiqueta (solo aplica a labels superiores en mayúsculas). */
  labelTracking?: 'wide' | 'wider';
  /** Peso de la etiqueta (solo aplica a labels superiores en mayúsculas). */
  labelWeight?: 'body' | 'semibold';
  /** Estado destacado: recolorea borde, fondo (`color`+'14') y el valor. */
  highlight?: { color: string };
  /** `numberOfLines=1` + `adjustsFontSizeToFit` en el valor (evita desbordes). */
  fitValue?: boolean;
  /** Hace la tarjeta presionable. */
  onPress?: () => void;
  /** Clases externas (flex, márgenes) — el componente NO gestiona layout externo. */
  className?: string;
};

/**
 * Tarjeta de métrica/estadística con borde. Reemplaza las variantes hand-rolled
 * (perfil, info tile de partido, panel de cancha, admin). El color del valor y del
 * ícono siguen el tema activo vía `useTheme()`. El fix anti-clipping de la fuente
 * display va horneado por `size`. No lleva márgenes/flex externos ni `FadeIn`: eso
 * viaja por `className` desde el padre.
 */
export default function StatCard({
  value,
  label,
  icon,
  iconStyle = 'plain',
  tint,
  valueColor,
  size = 'sm',
  variant = 'stat',
  align = 'left',
  labelPosition = 'top',
  labelTracking = 'wide',
  labelWeight = 'semibold',
  highlight,
  fitValue = false,
  onPress,
  className = '',
}: StatCardProps) {
  const c = useTheme();
  const accent = tint ?? c.primary;
  const resolvedValueColor = highlight ? highlight.color : valueColor ?? c.cream;

  const hasTopIcon = !!icon && iconStyle !== 'inline';
  const afterIconGap = hasTopIcon ? (iconStyle === 'badge' ? 'mt-3' : 'mt-2') : '';

  // Contenedor: solo el "look" de la tarjeta; flex/márgenes llegan por className.
  const padding = variant === 'info' ? 'p-3' : align === 'center' ? 'py-4' : 'p-4';
  const containerClass = cx(
    'rounded-2xl border border-border bg-card',
    padding,
    align === 'center' && 'items-center',
    className,
  );
  const containerStyle = highlight
    ? { borderColor: highlight.color, backgroundColor: highlight.color + '14' }
    : undefined;

  // Etiqueta
  const labelClass =
    variant === 'info'
      ? `font-body text-[10px] uppercase tracking-${labelTracking} text-muted`
      : labelPosition === 'top'
        ? `${labelWeight === 'semibold' ? 'font-body-semibold' : 'font-body'} text-xs uppercase tracking-${labelTracking} text-muted`
        : 'font-body text-xs text-muted';

  // Valor: color SIEMPRE por style (nunca clase); clipping horneado por size.
  const valueSizeClass =
    variant === 'info'
      ? 'font-body-semibold text-sm'
      : size === 'md'
        ? 'font-display text-3xl'
        : 'font-display text-2xl';
  const valueStyle =
    variant === 'info'
      ? { color: resolvedValueColor }
      : size === 'md'
        ? { lineHeight: 38, paddingTop: 2, color: resolvedValueColor }
        : { lineHeight: 30, paddingTop: 2, color: resolvedValueColor };

  // Márgenes verticales según el layout concreto.
  const valueGap =
    labelPosition === 'bottom' ? afterIconGap : variant === 'info' ? '' : 'mt-1';
  const labelGap =
    labelPosition === 'bottom'
      ? iconStyle === 'badge'
        ? 'mt-0.5'
        : ''
      : hasTopIcon
        ? afterIconGap
        : '';

  const valueNode = (
    <Text
      className={cx(valueGap, valueSizeClass)}
      style={valueStyle}
      numberOfLines={fitValue ? 1 : undefined}
      adjustsFontSizeToFit={fitValue ? true : undefined}>
      {value}
    </Text>
  );

  let inner;
  if (iconStyle === 'inline' && icon) {
    // No usado por los 6 sitios actuales; disponible para tiles con ícono en línea.
    inner = (
      <>
        <View className="flex-row items-center">
          <Ionicons name={icon} size={18} color={accent} />
          <Text className={cx('ml-2', labelClass)}>{label}</Text>
        </View>
        <Text className={cx('mt-2', valueSizeClass)} style={valueStyle}>
          {value}
        </Text>
      </>
    );
  } else {
    const iconNode =
      !hasTopIcon || !icon ? null : iconStyle === 'badge' ? (
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: accent + '22' }}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
      ) : (
        <Ionicons name={icon} size={18} color={accent} />
      );
    const labelNode = <Text className={cx(labelGap, labelClass)}>{label}</Text>;
    inner =
      labelPosition === 'top' ? (
        <>
          {iconNode}
          {labelNode}
          {valueNode}
        </>
      ) : (
        <>
          {iconNode}
          {valueNode}
          {labelNode}
        </>
      );
  }

  if (onPress) {
    return (
      <Pressable className={containerClass} style={containerStyle} onPress={onPress}>
        {inner}
      </Pressable>
    );
  }
  return (
    <View className={containerClass} style={containerStyle}>
      {inner}
    </View>
  );
}
