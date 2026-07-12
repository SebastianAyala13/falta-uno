import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import CanchaMap from '@/components/CanchaMap';
import Field from '@/components/Field';
import { reverseGeocode } from '@/lib/geo';
import { useTheme } from '@/lib/theme';

export interface Ubicacion {
  lat: number | null;
  lng: number | null;
  direccion: string;
}

interface Props {
  value: Ubicacion;
  ciudad: string;
  onChange: (v: Ubicacion) => void;
}

/**
 * Selector de ubicación (web): botón "Usar mi ubicación" (GPS del navegador) que
 * autocompleta la dirección, más el campo de dirección editable y un preview del
 * mapa (iframe). En web no usamos react-native-maps (es solo nativo).
 */
export default function UbicacionPicker({ value, onChange }: Props) {
  const c = useTheme();
  const [buscando, setBuscando] = useState(false);

  const usarMiUbicacion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dir = await reverseGeocode(lat, lng);
        setBuscando(false);
        onChange({ lat, lng, direccion: dir ?? value.direccion });
      },
      () => setBuscando(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <View>
      <Pressable
        onPress={usarMiUbicacion}
        className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 active:opacity-80">
        {buscando ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <Ionicons name="navigate" size={18} color={c.primary} />
        )}
        <Text className="font-body-bold text-sm text-primary">Usar mi ubicación</Text>
      </Pressable>
      <Field
        label="Dirección"
        icon="location-outline"
        placeholder="Escribí la dirección de tu cancha"
        value={value.direccion}
        onChangeText={(t) => onChange({ ...value, direccion: t })}
        multiline
      />
      {value.lat != null && value.lng != null ? (
        <CanchaMap
          coords={{ latitude: value.lat, longitude: value.lng }}
          cancha="Tu cancha"
          zona={value.direccion}
          onComoLlegar={() => {}}
        />
      ) : null}
    </View>
  );
}
