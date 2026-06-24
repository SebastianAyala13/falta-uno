import { Pressable, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/** Pastilla seleccionable — para selectores (posición, nivel, formato) y filtros. */
export default function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-4 py-2 ${
        selected
          ? 'border-primary bg-primary'
          : 'border-border bg-card active:border-primary/50'
      }`}>
      <Text
        className={`font-body-semibold text-sm ${
          selected ? 'text-ink' : 'text-cream'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}
