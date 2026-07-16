import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';

/**
 * Guard del modo invitado (solo-lectura). Devuelve una función que, si el usuario
 * es un invitado corriendo contra el backend real, muestra "Creá una cuenta" y
 * BLOQUEA la acción (devuelve `true` = manejado, no sigas). Si no es invitado,
 * devuelve `false` (seguí normal). Evita que las acciones del invitado fallen
 * contra el backend con un error crudo (mala impresión para el revisor de tiendas).
 *
 * Uso:
 *   const guardInvitado = useGuardInvitado();
 *   const onSubmit = () => {
 *     if (guardInvitado('Creá una cuenta para unirte.')) return;
 *     ...
 *   };
 */
export function useGuardInvitado() {
  const { esInvitado } = useAuth();
  const router = useRouter();
  return (mensaje = 'Creá una cuenta para hacer esto, parce.'): boolean => {
    if (!esInvitado) return false;
    haptics.tap();
    Alert.alert('Necesitás una cuenta', mensaje, [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Crear cuenta', onPress: () => router.push('/(auth)/register') },
    ]);
    return true;
  };
}
