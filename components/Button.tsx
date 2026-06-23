import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-primary active:bg-secondary',
  accent: 'bg-accent active:opacity-80',
  outline: 'bg-transparent border-2 border-primary active:bg-primary/10',
  ghost: 'bg-card active:bg-border',
};

const textByVariant: Record<Variant, string> = {
  primary: 'text-background',
  accent: 'text-background',
  outline: 'text-primary',
  ghost: 'text-cream',
};

/** Botón principal de la app, con variantes de marca. */
export default function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-14 w-full items-center justify-center rounded-2xl px-6 ${containerByVariant[variant]} ${
        disabled || loading ? 'opacity-50' : ''
      }`}
      {...props}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#10B981' : '#0B0F0D'} />
      ) : (
        <Text
          className={`font-body-bold text-base uppercase tracking-wide ${textByVariant[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
