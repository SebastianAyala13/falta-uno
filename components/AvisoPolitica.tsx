import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { URL_PRIVACIDAD } from '@/constants/config';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

/**
 * Aviso de que la política de privacidad cambió desde que esta persona la
 * aceptó, con el enlace para leerla y el botón para aceptarla.
 *
 * Por qué existe: la aceptación se guarda como prueba del consentimiento
 * (Ley 1581 de 2012, habeas data). Si la política cambia, el consentimiento
 * guardado ya no corresponde a lo que la app hace hoy. Actualizar la versión
 * por detrás sería fabricar una aceptación que nunca ocurrió, así que la tiene
 * que dar la persona.
 *
 * No pinta nada cuando la versión aceptada es la vigente.
 */
export default function AvisoPolitica({ className }: { className?: string }) {
  const { politicaDesactualizada, aceptarPolitica } = useAuth();
  const [guardando, setGuardando] = useState(false);
  const c = useTheme();

  if (!politicaDesactualizada) return null;

  const leer = () => {
    haptics.tap();
    Linking.openURL(URL_PRIVACIDAD).catch(() => Alert.alert('No pudimos abrir la política', URL_PRIVACIDAD));
  };

  const aceptar = async () => {
    haptics.tap();
    setGuardando(true);
    try {
      await aceptarPolitica();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View className={`rounded-sm border border-borderStrong bg-card p-4 ${className ?? ''}`}>
      <View className="flex-row items-center gap-2">
        <Ionicons name="document-text-outline" size={18} color={c.primary} />
        <Text className="font-body-bold text-sm text-cream">Actualizamos la política de privacidad</Text>
      </View>
      <Text className="mt-1 font-body text-xs text-muted">
        Cambió lo que contamos sobre tus datos de pago y sobre qué se conserva cuando borrás tu cuenta. Leela y
        confirmanos que estás de acuerdo.
      </Text>
      <View className="mt-3 flex-row items-center gap-4">
        <Pressable accessibilityRole="button" onPress={leer}>
          <Text className="font-body-semibold text-xs text-primary">Leer la política</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={guardando}
          onPress={aceptar}
          className="rounded-sm bg-primary px-4 py-2 active:opacity-80"
          style={guardando ? { opacity: 0.6 } : undefined}>
          <Text className="font-body-bold text-xs uppercase text-ink">{guardando ? 'Guardando…' : 'Acepto'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
