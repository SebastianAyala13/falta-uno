import { Text, View } from 'react-native';

type Tone = 'primary' | 'accent' | 'neutral' | 'danger' | 'warning';

interface BadgeProps {
  label: string;
  tone?: Tone;
}

const toneStyles: Record<Tone, { box: string; text: string }> = {
  primary: { box: 'bg-primary/15 border border-primary/40', text: 'text-primary' },
  accent: { box: 'bg-accent border border-accent', text: 'text-ink' },
  neutral: { box: 'bg-card border border-border', text: 'text-muted' },
  danger: { box: 'bg-danger/15 border border-danger/40', text: 'text-danger' },
  warning: { box: 'bg-warning/15 border border-warning/40', text: 'text-warning' },
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
