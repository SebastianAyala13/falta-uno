import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { misCanchas } from '@/lib/canchas';
import { useStore } from '@/lib/store';
import type { Cancha } from '@/types/database';

/**
 * Cuál de las canchas del dueño está activa.
 *
 * Si el id guardado ya no está en la lista (cancha dada de baja, otra cuenta,
 * primera vez) cae a la primera en vez de dejar la pantalla vacía: un dueño con
 * canchas nunca debe ver "no tenés cancha" por una preferencia vieja.
 */
export function resolverCanchaActiva(canchas: Cancha[], activaId: string | null): Cancha | null {
  return canchas.find((c) => c.id === activaId) ?? canchas[0] ?? null;
}

export interface CanchasDelDueno {
  /** Todas las canchas del dueño, de la más nueva a la más vieja. */
  canchas: Cancha[];
  /** La que está gestionando ahora. `null` si todavía no tiene ninguna. */
  cancha: Cancha | null;
  /** Cambia la cancha activa. La elección se comparte con las otras pantallas. */
  elegir: (id: string) => void;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir la lista; no toca la elección si la cancha sigue existiendo. */
  recargar: () => Promise<void>;
}

/**
 * Las canchas del dueño y cuál está gestionando.
 *
 * Por qué existe: panel, agenda, editor y finanzas resolvían la cancha con
 * `canchas[0]`, y `misCanchas` ordena por fecha de creación descendente. Un
 * dueño con tres canchas solo podía ver, editar y cobrar la última que cargó;
 * las otras dos quedaban inaccesibles desde la app aunque el alta las creara.
 *
 * La elección vive en el store y se persiste, así que no se pierde al pasar de
 * una pantalla a otra. Eso importa más de lo que parece: ver la agenda de una
 * cancha y el saldo de otra, cada pantalla con su propia selección, es la clase
 * de confusión que termina en un retiro mal pedido.
 *
 * Modo demo: `misCanchas` devuelve `[]` sin Supabase configurado, así que el
 * hook entrega lista vacía y las pantallas siguen mostrando su estado vacío.
 */
export function useCanchasDelDueno(): CanchasDelDueno {
  const { profile, loading: authCargando } = useAuth();
  const canchaActivaId = useStore((s) => s.canchaActivaId);
  const setCanchaActiva = useStore((s) => s.setCanchaActiva);

  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!profile?.id) return;
    setError(null);
    try {
      setCanchas(await misCanchas(profile.id));
    } catch {
      setError('No se pudo cargar. Revisá tu conexión e intentá de nuevo.');
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      // Auth aún resolviendo → mantenemos el skeleton; ya resolvió sin perfil → cerramos.
      if (!authCargando) setCargando(false);
      return;
    }
    let vigente = true;
    (async () => {
      setCargando(true);
      await recargar();
      if (vigente) setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, [profile?.id, authCargando, recargar]);

  const cancha = useMemo(() => resolverCanchaActiva(canchas, canchaActivaId), [canchas, canchaActivaId]);

  return { canchas, cancha, elegir: setCanchaActiva, cargando, error, recargar };
}
