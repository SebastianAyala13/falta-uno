import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

import { Colors } from '@/constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(13,18,15,0.85)',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={30}
            tint="dark"
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
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                top: Platform.OS === 'ios' ? -8 : -12,
                height: 58,
                width: 58,
                borderRadius: 29,
                backgroundColor: Colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: Colors.accent,
                shadowOpacity: 0.6,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 4 },
                elevation: 10,
              }}>
              <Ionicons name="add" size={34} color={Colors.background} />
            </View>
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
