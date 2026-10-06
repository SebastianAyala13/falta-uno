import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { comprobarRespuesta, unirPorId } from '@/lib/data-utils';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import type { Mensaje } from '@/types/database';

export interface Autor { id: string; nombre: string }
const CHAT_PAGE = 50;
const CHAT_WINDOW = 200;
function ordenar(filas: Mensaje[]) {
  return filas.sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** El chat remoto nunca simula entregas guardándolas sólo en este dispositivo. */
export function useChatMensajes(partidoId: string) {
  const mensajesLocal = useStore(useShallow(s => s.getMensajes(partidoId)));
  const enviarLocal = useStore(s => s.enviarMensaje);
  const usuarioId = useStore(s => s.usuarioId);
  const [remoto,setRemoto] = useState<Mensaje[]>([]);
  const [enVivo,setEnVivo] = useState(false);
  const [errorCarga,setErrorCarga] = useState<string | null>(null);
  const [cargando,setCargando] = useState(false);
  const [hayMas,setHayMas] = useState(false);
  const [revision,setRevision] = useState(0);
  const contexto = useRef(0);
  const anteriorPendiente = useRef(false);
  const reintentar = () => setRevision(r => r+1);

  // Screens remain mounted in the navigation stack: subscribe only when visible.
  useFocusEffect(useCallback(() => {
    const version = ++contexto.current;
    setRemoto([]); setErrorCarga(null); setEnVivo(false); setHayMas(false);
    if (!supabaseConfigurado) return;
    setCargando(true);
    let sincronizando = false;
    let repetirSincronizacion = false;
    const sincronizar = async () => {
      if (sincronizando) { repetirSincronizacion = true; return; }
      sincronizando = true;
      try {
        const filas = (comprobarRespuesta(await supabase.from('mensajes').select('*')
          .eq('partido_id',partidoId).order('created_at',{ascending:false})
          .order('id',{ascending:false}).limit(CHAT_PAGE)) ?? []) as Mensaje[];
        if (version !== contexto.current) return;
        setRemoto(prev => ordenar(unirPorId(prev,filas)).slice(-CHAT_WINDOW));
        setHayMas(filas.length === CHAT_PAGE); setErrorCarga(null);
      } catch {
        if (version === contexto.current) setErrorCarga('No pudimos cargar el chat. Revisá tu conexión o tu inscripción.');
      } finally {
        sincronizando = false;
        if (version === contexto.current) {
          setCargando(false);
          if (repetirSincronizacion) { repetirSincronizacion = false; void sincronizar(); }
        }
      }
    };
    // Subscribe before fetching: avoids a gap between snapshot and live events.
    const canal = supabase.channel(`chat-${partidoId}-${version}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'mensajes',filter:`partido_id=eq.${partidoId}`}, payload => {
        if (version !== contexto.current) return;
        if (payload.eventType === 'DELETE') setRemoto(prev => prev.filter(m => m.id !== payload.old.id));
        else setRemoto(prev => ordenar(unirPorId(prev,[payload.new as Mensaje])).slice(-CHAT_WINDOW));
      }).subscribe(status => {
        if (version !== contexto.current) return;
        setEnVivo(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void sincronizar();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setCargando(false); setErrorCarga('El chat está desconectado. Reintentá para recibir nuevos mensajes.');
        }
      });
    void sincronizar();
    return () => { contexto.current++; void supabase.removeChannel(canal); };
  },[partidoId,usuarioId,revision]));

  const cargarAnteriores = async () => {
    if (!supabaseConfigurado || !hayMas || anteriorPendiente.current || !remoto.length) return;
    anteriorPendiente.current = true;
    const version = contexto.current, primero = remoto[0];
    try {
      const filas = (comprobarRespuesta(await supabase.from('mensajes').select('*').eq('partido_id',partidoId)
        .or(`created_at.lt.${primero.created_at},and(created_at.eq.${primero.created_at},id.lt.${primero.id})`)
        .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(CHAT_PAGE)) ?? []) as Mensaje[];
      if (version !== contexto.current) return;
      // Keep a bounded window; user explicitly chooses to move to older history.
      setRemoto(prev => ordenar(unirPorId(prev,filas)).slice(0,CHAT_WINDOW));
      setHayMas(filas.length === CHAT_PAGE); setErrorCarga(null);
    } catch { if (version === contexto.current) setErrorCarga('No pudimos cargar los mensajes anteriores.'); }
    finally { anteriorPendiente.current = false; }
  };

  const enviar = async (autor: Autor,texto: string) => {
    const limpio = texto.trim();
    if (!limpio) return;
    if (limpio.length > 500) throw new Error('El mensaje puede tener hasta 500 caracteres.');
    if (!supabaseConfigurado) { enviarLocal(partidoId,autor,limpio); return; }
    const version = contexto.current;
    const fila = comprobarRespuesta(await supabase.from('mensajes').insert({
      partido_id:partidoId,autor_id:autor.id,autor_nombre:autor.nombre,texto:limpio,
    } as never).select().single());
    if (!fila) throw new Error('No pudimos enviar el mensaje.');
    if (version === contexto.current) setRemoto(prev => ordenar(unirPorId(prev,[fila as Mensaje])).slice(-CHAT_WINDOW));
  };
  return {mensajes:supabaseConfigurado ? remoto : mensajesLocal,enviar,enVivo,errorCarga,cargando,hayMas,cargarAnteriores,reintentar};
}
