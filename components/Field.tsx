import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/lib/theme';

interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Activa el botón de mostrar/ocultar para contraseñas. */
  toggleSecure?: boolean;
}

/** Campo de formulario premium: ícono, glow al enfocar y tema oscuro. */
export default function Field({ label, hint, icon, toggleSecure, style, ...props }: FieldProps) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const multiline = props.multiline;

  return (
    <View className="mb-4 w-full">
      {label ? (
        <Text className="mb-2 font-body-semibold text-sm text-cream">{label}</Text>
      ) : null}

      <View
        className="flex-row items-center rounded-sm border bg-card px-4"
        style={{
          borderColor: focused ? c.primary : c.border,
          minHeight: multiline ? 100 : 56,
          alignItems: multiline ? 'flex-start' : 'center',
          paddingVertical: multiline ? 14 : 0,
          boxShadow: focused ? `0px 0px 12px ${c.primary}40` : undefined,
        }}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? c.primary : c.muted}
            style={{ marginRight: 10, marginTop: multiline ? 2 : 0 }}
          />
        ) : null}

        <TextInput
          placeholderTextColor={c.muted}
          secureTextEntry={toggleSecure ? hidden : props.secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 font-body text-base text-cream"
          style={[{ height: multiline ? 80 : 54, textAlignVertical: multiline ? 'top' : 'center' }, style]}
          {...props}
        />

        {toggleSecure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} className="pl-2">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </View>

      {hint ? <Text className="mt-1.5 font-body text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}
