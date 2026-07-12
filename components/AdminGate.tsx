import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { esAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

/**
 * Envuelve las pantallas de la Plataforma Madre. Solo renderiza el contenido si
 * el perfil tiene rol admin; si no, muestra "sin acceso". (La seguridad real
 * está en la RLS del servidor; esto es la barrera de UI.)
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const c = useTheme();
  const { profile } = useAuth();

  if (!esAdmin(profile)) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="lock-closed" size={44} color={c.muted} />
          <Text className="mt-4 text-center font-display text-2xl uppercase text-cream" style={{ lineHeight: 30, paddingTop: 2 }}>
            Sin acceso
          </Text>
          <Text className="mt-2 text-center font-body text-sm text-muted">
            Esta sección es solo para el equipo de Falta Uno.
          </Text>
          <Pressable onPress={() => router.back()} className="mt-6 rounded-2xl border border-border bg-card px-6 py-3">
            <Text className="font-body-semibold text-sm text-primary">Volver</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
