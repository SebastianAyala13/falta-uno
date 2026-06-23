import { useEffect, useState } from 'react';

import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import type { Mensaje } from '@/types/database';

export interface Autor {
  id: string;
  nombre: string;
}

/**
 * Chat de un partido. Si Supabase está configurado, usa **Realtime** (mensajes
 * en vivo entre dispositivos); si no —o si la tabla `mensajes` aún no existe—
 * cae a un chat local persistido en el store. Mismo API para ambos.
 */
export function useChatMensajes(partidoId: string) {
  const mensajesLocal = useStore((s) => s.getMensajes(partidoId));
  const enviarLocal = useStore((s) => s.enviarMensaje);

  const [remoto, setRemoto] = useState<Mensaje[]>([]);
  const [usarLocal, setUsarLocal] = useState(!supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let activo = true;

    (async () => {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('partido_id', partidoId)
        .order('created_at', { ascending: true });

      if (!activo) return;
      if (error) {
        // La tabla no existe todavía → usamos el chat local
        setUsarLocal(true);
        return;
      }
      setRemoto((data as Mensaje[]) ?? []);

      canal = supabase
        .channel(`chat-${partidoId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `partido_id=eq.${partidoId}` },
          (payload) => setRemoto((prev) => [...prev, payload.new as Mensaje]),
        )
        .subscribe();
    })();

    return () => {
      activo = false;
      if (canal) supabase.removeChannel(canal);
    };
  }, [partidoId]);

  const enVivo = supabaseConfigurado && !usarLocal;
  const mensajes = enVivo ? remoto : mensajesLocal;

  const enviar = async (autor: Autor, texto: string) => {
    const limpio = texto.trim();
    if (!limpio) return;
    if (!enVivo) {
      enviarLocal(partidoId, autor, limpio);
      return;
    }
    const { error } = await supabase.from('mensajes').insert({
      partido_id: partidoId,
      autor_id: autor.id,
      autor_nombre: autor.nombre,
      texto: limpio,
    } as never);
    if (error) {
      // Si falla (p.ej. tabla/permiso), no perdemos el mensaje: lo guardamos local
      setUsarLocal(true);
      enviarLocal(partidoId, autor, limpio);
    }
  };

  return { mensajes, enviar, enVivo };
}
