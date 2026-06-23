import { Image } from 'expo-image';
import { Text, View } from 'react-native';

interface AvatarProps {
  nombre: string;
  uri?: string | null;
  size?: number;
}

/** Avatar circular: muestra la foto si existe, o las iniciales del nombre. */
export default function Avatar({ nombre, uri, size = 44 }: AvatarProps) {
  const iniciales = nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-secondary"
      style={{ width: size, height: size }}>
      <Text className="font-display text-cream" style={{ fontSize: size * 0.4 }}>
        {iniciales}
      </Text>
    </View>
  );
}
