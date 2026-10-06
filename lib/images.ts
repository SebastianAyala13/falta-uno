import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Abre la galería y devuelve la URI de la imagen elegida (o null si cancela /
 * permite acceso sólo a la imagen seleccionada, sin permiso a toda la galería.
 */
export async function elegirImagen(aspect: [number, number] = [1, 1]): Promise<string | null> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS !== 'ios',
      aspect,
      quality: 0.7,
    });
    if (res.canceled) return null;
    return res.assets[0]?.uri ?? null;
  } catch {
    return null;
  }
}
