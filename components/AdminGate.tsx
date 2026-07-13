import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import GlowButton from '@/components/GlowButton';
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
  const { profile, loading } = useAuth();

  // Auth aún resolviendo: no mostramos "sin acceso" (evita el flash para un admin real).
  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      </Screen>
    );
  }

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
          <View className="mt-6 w-full max-w-[240px]">
            <GlowButton label="Volver" variant="dark" icon="arrow-back" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
