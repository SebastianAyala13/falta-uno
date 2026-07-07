import '../global.css';

import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { vars } from 'nativewind';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { configurarNotificaciones } from '@/lib/notifications';
import { Colors } from '@/constants/colors';
import { useThemeMeta, useThemeVars } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configurarNotificaciones();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Anton: Anton_400Regular,
    Archivo: Archivo_400Regular,
    'Archivo-Medium': Archivo_500Medium,
    'Archivo-SemiBold': Archivo_600SemiBold,
    'Archivo-Bold': Archivo_700Bold,
  });

  const themeVars = useThemeVars();
  const themeMeta = useThemeMeta();

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* La capa de variables del tema: todas las clases de color heredan de acá */}
      <View style={[{ flex: 1 }, vars(themeVars)]}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style={themeMeta.dark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="partido/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="calificar/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen
              name="checkout/[id]"
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="crear-post"
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen name="mis-partidos" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="mis-pagos" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="editar-perfil" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="apariencia" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="reset" options={{ animation: 'slide_from_bottom' }} />
            {/* Marketplace de canchas */}
            <Stack.Screen name="canchas" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="mis-reservas" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/panel" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/agenda" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/finanzas" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/editar" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/[id]/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cancha/[id]/reservar" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}
