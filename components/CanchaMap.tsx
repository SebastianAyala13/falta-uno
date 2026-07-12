import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { useTheme } from '@/lib/theme';

type Props = {
  coords: { latitude: number; longitude: number };
  cancha: string;
  zona: string;
  /** Si se pasa, muestra el botón "Cómo llegar" debajo del mapa. */
  onComoLlegar?: () => void;
};

export default function CanchaMap({ coords, cancha, zona, onComoLlegar }: Props) {
  const c = useTheme();
  return (
    <View className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <MapView
        style={{ height: 160 }}
        pointerEvents="none"
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}>
        <Marker coordinate={coords} title={cancha} description={zona} />
      </MapView>
      {onComoLlegar ? (
        <Pressable
          onPress={onComoLlegar}
          className="flex-row items-center justify-center gap-2 border-t border-border py-3.5 active:bg-border/40">
          <Ionicons name="navigate" size={18} color={c.primary} />
          <Text className="font-body-bold text-sm uppercase tracking-wide text-primary">
            Cómo llegar
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
