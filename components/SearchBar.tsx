import { Ionicons } from '@expo/vector-icons';
import { TextInput, View } from 'react-native';

import { cx } from '@/lib/cx';
import { useTheme } from '@/lib/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** Layout externo (márgenes) — el componente no gestiona su posición. */
  className?: string;
}

/**
 * Barra de búsqueda: ícono + input + botón de limpiar. Sigue los tokens de `Field`
 * (rounded-sm, border-border, bg-card, text-cream). Reemplaza los buscadores
 * hand-rolled de `buscar` y `canchas`.
 */
export default function SearchBar({ value, onChangeText, placeholder = 'Buscar...', className = '' }: SearchBarProps) {
  const c = useTheme();
  return (
    <View className={cx('h-14 flex-row items-center rounded-sm border border-border bg-card px-4', className)}>
      <Ionicons name="search" size={20} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        className="ml-3 flex-1 font-body text-base text-cream"
      />
      {value ? (
        <Ionicons name="close-circle" size={20} color={c.muted} onPress={() => onChangeText('')} />
      ) : null}
    </View>
  );
}
