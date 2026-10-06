import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  // A store release must never silently ship the local/demo backend.
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !/^https:\/\//.test(url) || /TU-PROYECTO|localhost|127\.0\.0\.1/i.test(url)
      || !key || key === 'TU_ANON_KEY_AQUI') {
      throw new Error('Producción requiere EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY reales en EAS.');
    }
    if (process.env.EAS_BUILD_PLATFORM === 'android' && (!mapsKey || mapsKey.startsWith('TU_'))) {
      throw new Error('Producción requiere GOOGLE_MAPS_ANDROID_API_KEY restringida al paquete y certificado de Android.');
    }
  }
  return {
    ...config,
    name: config.name ?? 'Falta Uno',
    slug: config.slug ?? 'falta-uno',
    android: {
      ...config.android,
      config: mapsKey ? { ...config.android?.config, googleMaps: {apiKey: mapsKey} } : config.android?.config,
    },
    plugins: (config.plugins ?? []).map(plugin => plugin === 'react-native-maps'
      ? ['react-native-maps', mapsKey ? {androidGoogleMapsApiKey: mapsKey} : {}]
      : plugin),
  };
};
