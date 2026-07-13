import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { useTheme, useThemeMeta } from '@/lib/theme';

export default function TabsLayout() {
  const c = useTheme();
  const meta = useThemeMeta();
  const { profile } = useAuth();
  const hidratar = useStore((s) => s.hidratar);

  // Al entrar a la app autenticado, traemos los datos reales desde Supabase.
  useEffect(() => {
    if (profile?.id) hidratar(profile.id);
  }, [profile?.id, hidratar]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          position: 'absolute',
          // Fondo translúcido derivado del tema (D9 ≈ 85% alpha) sobre el blur; sigue
          // el background real de cada tema en vez de un rgba fijo (arregla Blanco).
          backgroundColor: c.background + 'D9',
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={30}
            tint={meta.dark ? 'dark' : 'light'}
            style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
          />
        ),
        tabBarLabelStyle: { fontFamily: 'Archivo-SemiBold', fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="crear"
        options={{
          title: 'Crear',
          // El ícono custom ya dibuja el texto "Crear"; ocultamos la etiqueta
          // automática para que no aparezca duplicado.
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', top: Platform.OS === 'ios' ? -8 : -12 }}>
              <View
                style={{
                  height: 54,
                  width: 54,
                  borderRadius: 27,
                  backgroundColor: c.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: c.accent,
                  shadowOpacity: 0.6,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 10,
                  transform: [{ scale: focused ? 1.05 : 1 }],
                }}>
                <Ionicons name="add" size={32} color={c.ink} />
              </View>
              <Text style={{ marginTop: 2, fontFamily: 'Archivo-SemiBold', fontSize: 11, color: c.muted }}>
                Crear
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="muro"
        options={{
          title: 'Muro',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
