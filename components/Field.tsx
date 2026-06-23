import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

/** Campo de formulario con etiqueta, estilizado para el tema oscuro. */
export default function Field({ label, hint, ...props }: FieldProps) {
  return (
    <View className="mb-4 w-full">
      <Text className="mb-2 font-body-semibold text-sm text-cream">{label}</Text>
      <TextInput
        placeholderTextColor="#8A968F"
        className="h-14 w-full rounded-2xl border border-border bg-card px-4 font-body text-base text-cream"
        {...props}
      />
      {hint ? <Text className="mt-1 font-body text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}
