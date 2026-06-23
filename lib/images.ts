import * as ImagePicker from 'expo-image-picker';

/**
 * Abre la galería y devuelve la URI de la imagen elegida (o null si cancela /
 * no da permiso). Para cloud real, esta URI se subiría a Supabase Storage; acá
 * la usamos directo (queda en el dispositivo).
 */
export async function elegirImagen(aspect: [number, number] = [1, 1]): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.7,
    });
    if (res.canceled) return null;
    return res.assets[0]?.uri ?? null;
  } catch {
    return null;
  }
}
