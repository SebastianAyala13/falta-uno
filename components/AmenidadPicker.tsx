import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { AMENIDADES } from '@/constants/config';
import { useTheme } from '@/lib/theme';
import type { Amenidades } from '@/types/database';

interface AmenidadPickerProps {
  value: Amenidades;
  onChange: (a: Amenidades) => void;
}

/** Grid de toggles para elegir las amenidades de una cancha (duchas, parqueadero, etc.). */
export default function AmenidadPicker({ value, onChange }: AmenidadPickerProps) {
  const c = useTheme();
  const toggle = (id: string) => {
    const key = id as keyof Amenidades;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <View className="flex-row flex-wrap">
      {AMENIDADES.map((a) => {
        const activo = !!value[a.id as keyof Amenidades];
        return (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => toggle(a.id)}
            className="mb-2 mr-2 flex-row items-center rounded-full border px-3.5 py-2"
            style={{
              backgroundColor: activo ? c.primary + '1A' : c.card,
              borderColor: activo ? c.primary : c.border,
            }}>
            <Ionicons
              name={a.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={activo ? c.primary : c.muted}
            />
            <Text
              className="ml-1.5 font-body-semibold text-xs"
              style={{ color: activo ? c.primary : c.cream }}>
              {a.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
