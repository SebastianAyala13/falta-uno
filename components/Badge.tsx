import { Text, View } from 'react-native';

type Tone = 'primary' | 'accent' | 'neutral' | 'danger';

interface BadgeProps {
  label: string;
  tone?: Tone;
}

const toneStyles: Record<Tone, { box: string; text: string }> = {
  primary: { box: 'bg-primary/15 border border-primary/40', text: 'text-primary' },
  accent: { box: 'bg-accent/15 border border-accent/40', text: 'text-accent' },
  neutral: { box: 'bg-card border border-border', text: 'text-muted' },
  danger: { box: 'bg-red-500/15 border border-red-500/40', text: 'text-red-400' },
};

/** Etiqueta compacta para posición, nivel, formato, etc. */
export default function Badge({ label, tone = 'primary' }: BadgeProps) {
  const s = toneStyles[tone];
  return (
    <View className={`self-start rounded-full px-3 py-1 ${s.box}`}>
      <Text className={`font-body-semibold text-xs uppercase tracking-wide ${s.text}`}>
        {label}
      </Text>
    </View>
  );
}
