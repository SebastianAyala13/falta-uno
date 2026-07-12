import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { urgencyLabel } from '@/lib/format';
import { useTheme } from '@/lib/theme';

type Tone = 'solid' | 'tint';
type Shape = 'strip' | 'pill';
type Size = 'sm' | 'md';

interface UrgencyPillProps {
  /** Cupos que faltan; deriva el estado (lleno / urgente / normal). */
  faltan: number;
  /** `solid`: fondo pleno + texto `ink`. `tint`: fondo `color+'22'` + texto color pleno. */
  tone?: Tone;
  /** `strip`: franja sin radio propio (la recorta el contenedor). `pill`: `rounded-full` self-sized. */
  shape?: Shape;
  size?: Size;
  urgentLabel?: string;
  fullLabel?: string;
  /** Si `false`, nunca renderiza el estado "lleno" (el consumidor pre-filtra `faltan>0`). */
  showFull?: boolean;
  /** Contenido al otro extremo de la franja, compartiendo su fondo (p.ej. el formato). */
  trailing?: ReactNode;
  /** La franja ocupa el ancho del contenedor (uso `strip`). */
  fill?: boolean;
  className?: string;
}

const PAD: Record<`${Shape}-${Size}`, string> = {
  'strip-md': 'px-4 py-2',
  'strip-sm': 'px-3 py-1.5',
  'pill-md': 'px-3 py-1.5',
  'pill-sm': 'px-2.5 py-1',
};

const TEXT: Record<`${Shape}-${Size}`, string> = {
  'strip-md': 'font-body-bold text-xs uppercase tracking-wider',
  'strip-sm': 'font-body-bold text-xs uppercase tracking-wide',
  'pill-md': 'font-body-bold text-xs uppercase',
  'pill-sm': 'font-body-bold text-xs uppercase',
};

/**
 * Pastilla de urgencia de cupos ("¡Falta 1!" / "Faltan N" / "Cupo lleno").
 * Unifica las 3 variantes que estaban duplicadas (GameCard, UrgentCard, detalle del
 * partido) en un solo componente. El estado y el copy salen de {@link urgencyLabel}.
 */
export default function UrgencyPill({
  faltan,
  tone = 'solid',
  shape = 'strip',
  size = 'md',
  urgentLabel,
  fullLabel,
  showFull = true,
  trailing,
  fill = false,
  className,
}: UrgencyPillProps) {
  const c = useTheme();
  const full = showFull && faltan <= 0;
  const urgente = faltan === 1;

  // Color base por estado (usado tal cual por `tint`; `solid` lo matiza).
  const stateColor = full ? c.muted : urgente ? c.accent : c.primary;

  let bg: string;
  let fg: string;
  if (tone === 'solid') {
    bg = full ? c.border : urgente ? c.accent : c.primary;
    fg = full ? c.muted : c.ink;
  } else {
    bg = stateColor + '22';
    fg = stateColor;
  }

  const key = `${shape}-${size}` as `${Shape}-${Size}`;
  const gap = size === 'md' ? 'gap-1.5' : 'gap-1';
  const iconSize = size === 'md' ? 13 : 12;

  const container = [
    'flex-row items-center',
    trailing ? 'justify-between' : '',
    shape === 'pill' ? 'rounded-full' : '',
    fill ? 'w-full' : '',
    PAD[key],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={container} style={{ backgroundColor: bg }}>
      <View className={`flex-row items-center ${gap}`}>
        <Ionicons name={full ? 'lock-closed' : 'flame'} size={iconSize} color={fg} />
        <Text className={TEXT[key]} style={{ color: fg }}>
          {urgencyLabel(faltan, { urgentLabel, fullLabel })}
        </Text>
      </View>
      {trailing}
    </View>
  );
}
