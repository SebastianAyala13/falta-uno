import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Colors } from '@/constants/colors';

type Props = {
  coords: { latitude: number; longitude: number };
  cancha: string;
  zona: string;
  onComoLlegar: () => void;
};

export default function CanchaMap({ coords, cancha, zona, onComoLlegar }: Props) {
  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-border bg-card">
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
      <Pressable
        onPress={onComoLlegar}
        className="flex-row items-center justify-center gap-2 border-t border-border py-3.5 active:bg-border/40">
        <Ionicons name="navigate" size={18} color={Colors.primary} />
        <Text className="font-body-bold text-sm uppercase tracking-wide text-primary">
          Cómo llegar
        </Text>
      </Pressable>
    </View>
  );
}
