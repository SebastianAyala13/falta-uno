import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import Field from '@/components/Field';
import { CIUDAD_COORDS, PEREIRA, reverseGeocode } from '@/lib/geo';
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
 * Selector de ubicación (móvil): mapa con pin arrastrable. Al mover el pin, la
 * dirección se completa sola (reverse geocoding) y queda editable.
 */
export default function UbicacionPicker({ value, ciudad, onChange }: Props) {
  const c = useTheme();
  const [buscando, setBuscando] = useState(false);
  const base =
    value.lat != null && value.lng != null
      ? { latitude: value.lat, longitude: value.lng }
      : (CIUDAD_COORDS[ciudad] ?? PEREIRA);

  const mover = async (lat: number, lng: number) => {
    onChange({ ...value, lat, lng });
    setBuscando(true);
    const dir = await reverseGeocode(lat, lng);
    setBuscando(false);
    if (dir) onChange({ lat, lng, direccion: dir });
  };

  return (
    <View>
      <View className="overflow-hidden rounded-lg border border-border">
        <MapView
          style={{ height: 220 }}
          initialRegion={{ ...base, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          onPress={(e) => mover(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}>
          {value.lat != null && value.lng != null ? (
            <Marker
              draggable
              coordinate={{ latitude: value.lat, longitude: value.lng }}
              onDragEnd={(e) => mover(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
            />
          ) : null}
        </MapView>
      </View>
      <View className="mb-2 mt-1 flex-row items-center gap-1">
        <Ionicons name="information-circle-outline" size={14} color={c.muted} />
        <Text className="font-body text-xs text-muted">Tocá el mapa o arrastrá el pin para ubicar tu cancha.</Text>
      </View>
      <Field
        label="Dirección"
        icon="location-outline"
        placeholder="Se completa sola al poner el pin (podés editarla)"
        value={value.direccion}
        onChangeText={(t) => onChange({ ...value, direccion: t })}
        multiline
      />
      {buscando ? (
        <View className="-mt-2 flex-row items-center gap-2">
          <ActivityIndicator size="small" color={c.primary} />
          <Text className="font-body text-xs text-muted">Buscando la dirección…</Text>
        </View>
      ) : null}
    </View>
  );
}
