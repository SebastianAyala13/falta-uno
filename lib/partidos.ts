import { comprobarRespuesta, hoyColombia, PAGE_SIZE } from '@/lib/data-utils';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type { PartidoConOrganizador } from '@/types/database';

export interface FiltrosPartido { texto?: string; zona?: string | null; nivel?: string | null; formato?: string | null }

export async function conOrganizadores(partidos: PartidoConOrganizador[]) {
  if (!partidos.length) return partidos;
  const perfiles: {id:string;nombre:string;avatar_url:string|null;rating:number}[] = [];
  for (let i=0;i<partidos.length;i+=100) {
    const filas = comprobarRespuesta(await supabase.rpc('organizadores_partidos',{
      p_partidos:partidos.slice(i,i+100).map(p=>p.id),
    } as never)) ?? [];
    perfiles.push(...filas as unknown as typeof perfiles);
  }
  const autores = new Map(perfiles.map(p=>[p.id,p]));
  return partidos.map(p=>({...p,organizador:autores.get(p.organizador_id) ?? {nombre:'Organizador',avatar_url:null,rating:0}}));
}

/** Quote a PostgREST pattern without interpreting commas/parentheses as filters. */
export function patronBusqueda(texto: string) {
  return JSON.stringify('%' + texto.replace(/[\\%_]/g, '\\$&') + '%');
}

export async function buscarPartidos(filtros: FiltrosPartido, ultimo?: PartidoConOrganizador) {
  if (!supabaseConfigurado) return {filas:[] as PartidoConOrganizador[],hayMas:false,cursor:undefined};
  let q = supabase.from('partidos').select('*').gte('fecha',hoyColombia()).eq('oculto',false);
  if (filtros.zona) q=q.eq('zona',filtros.zona);
  if (filtros.nivel) q=q.eq('nivel',filtros.nivel);
  if (filtros.formato) q=q.eq('formato',filtros.formato);
  if (filtros.texto?.trim()) {
    const patron=patronBusqueda(filtros.texto.trim());
    q=q.or(`cancha.ilike.${patron},zona.ilike.${patron}`);
  }
  if (ultimo) q=q.or(`fecha.gt.${ultimo.fecha},and(fecha.eq.${ultimo.fecha},hora.gt.${ultimo.hora}),and(fecha.eq.${ultimo.fecha},hora.eq.${ultimo.hora},id.gt.${ultimo.id})`);
  const raw=(comprobarRespuesta(await q.order('fecha').order('hora').order('id').limit(PAGE_SIZE)) ?? []) as PartidoConOrganizador[];
  return {filas:await conOrganizadores(raw),hayMas:raw.length===PAGE_SIZE,cursor:raw[raw.length-1]};
}
