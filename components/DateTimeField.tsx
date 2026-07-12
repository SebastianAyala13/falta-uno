import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme, useThemeMeta } from '@/lib/theme';

interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  /** Valor: "YYYY-MM-DD" para fecha, "HH:mm" para hora. */
  value: string;
  onChange: (valor: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Fecha mínima seleccionable (solo modo date). */
  minToday?: boolean;
}

function dosDigitos(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function aTexto(d: Date, mode: 'date' | 'time') {
  return mode === 'date'
    ? `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
    : `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}
function aFecha(value: string, mode: 'date' | 'time'): Date {
  const base = new Date();
  if (!value) return base;
  if (mode === 'date') {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  } else {
    const [h, min] = value.split(':').map(Number);
    if (!Number.isNaN(h)) base.setHours(h, min || 0, 0, 0);
  }
  return base;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Campo premium que abre el selector nativo de fecha u hora. */
export default function DateTimeField({ label, mode, value, onChange, icon, minToday }: DateTimeFieldProps) {
  const c = useTheme();
  const meta = useThemeMeta();
  const [show, setShow] = useState(false);
  const fecha = aFecha(value, mode);

  const display = (() => {
    if (!value) return mode === 'date' ? 'Elegí fecha' : 'Elegí hora';
    if (mode === 'time') return value;
    return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  })();

  const onPicked = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && selected) onChange(aTexto(selected, mode));
  };

  return (
    <View className="mb-4 w-full">
      <Text className="mb-2 font-body-semibold text-sm text-cream">{label}</Text>

      <Pressable
        onPress={() => setShow((s) => !s)}
        className="h-14 flex-row items-center rounded-sm border bg-card px-4"
        style={{ borderColor: show ? c.primary : c.border }}>
        <Ionicons
          name={icon ?? (mode === 'date' ? 'calendar-outline' : 'time-outline')}
          size={20}
          color={show ? c.primary : c.muted}
          style={{ marginRight: 10 }}
        />
        <Text className={`flex-1 font-body text-base ${value ? 'text-cream' : 'text-muted'}`}>{display}</Text>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>

      {show && Platform.OS === 'ios' ? (
        <View className="mt-2 rounded-lg border border-border bg-card p-2">
          <DateTimePicker
            value={fecha}
            mode={mode}
            display="spinner"
            is24Hour
            themeVariant={meta.dark ? 'dark' : 'light'}
            minimumDate={minToday && mode === 'date' ? new Date() : undefined}
            onChange={onPicked}
          />
          <Pressable onPress={() => setShow(false)} className="mx-2 mb-1 items-center rounded-sm bg-primary py-2.5">
            <Text className="font-body-bold text-sm uppercase text-background">Listo</Text>
          </Pressable>
        </View>
      ) : null}

      {show && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={fecha}
          mode={mode}
          is24Hour
          minimumDate={minToday && mode === 'date' ? new Date() : undefined}
          onChange={onPicked}
        />
      ) : null}
    </View>
  );
}
