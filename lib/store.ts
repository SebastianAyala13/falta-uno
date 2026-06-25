import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setActiveColors } from '@/constants/colors';
import { COMISION_SERVICIO, CUPOS_POR_FORMATO, type Formato, type Nivel } from '@/constants/config';
import { DEFAULT_THEME_ID } from '@/constants/themes';
import { matchDateTime } from '@/lib/format';
import { partidosDisponibles, postsSeed } from '@/lib/mockData';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import type {
  Calificacion,
  Comentario,
  EstadoPago,
  Mensaje,
  Pago,
  PartidoConOrganizador,
  Post,
  PostTipo,
  Reporte,
} from '@/types/database';

/** Datos para crear un post desde la UI. */
export interface NuevoPost {
  tipo: PostTipo;
  texto: string;
  foto_url?: string | null;
  partido_id?: string | null;
}

/** Autor de un post/comentario (el usuario actual). */
export interface AutorPost {
  id: string;
  nombre: string;
  avatar_url?: string | null;
}

export interface NuevoPartido {
  cancha: string;
  zona: string;
  fecha: string;
  hora: string;
  formato: Formato;
  nivel: Nivel;
  precio: number;
  descripcion: string;
  foto_url?: string | null;
}

interface StoreState {
  partidos: PartidoConOrganizador[];
  inscritos: string[]; // ids de partidos a los que el usuario se unió
  pagos: Pago[];
  mensajes: Record<string, Mensaje[]>; // chat por partido (partidoId -> mensajes)
  calificaciones: Calificacion[]; // reputación
  posts: Post[]; // muro social
  comentarios: Record<string, Comentario[]>; // comentarios por post (postId -> comentarios)
  bloqueados: string[]; // ids de usuarios bloqueados por el usuario actual (moderación UGC)
  reportes: Reporte[]; // reportes de contenido objetable
  temaId: string; // id del tema de color activo

  setTema: (id: string) => void;
  getPartido: (id: string) => PartidoConOrganizador | undefined;
  estaInscrito: (id: string) => boolean;
  misPartidos: () => PartidoConOrganizador[];
  getMensajes: (partidoId: string) => Mensaje[];
  enviarMensaje: (partidoId: string, autor: { id: string; nombre: string }, texto: string) => void;
  yaCalifico: (partidoId: string) => boolean;
  calificarPartido: (
    partidoId: string,
    autorId: string,
    data: { estrellas: number; organizador_estrellas: number; hubo_no_show: boolean; comentario: string },
  ) => void;

  // --- Muro social ---
  getComentarios: (postId: string) => Comentario[];
  crearPost: (data: NuevoPost, autor: AutorPost) => string;
  toggleLike: (postId: string, userId: string) => void;
  comentar: (postId: string, autor: AutorPost, texto: string) => void;
  /** Crea posts-recap para los partidos del usuario que ya terminaron. */
  generarRecapsPendientes: (userId: string, ahoraISO: string) => void;

  // --- Moderación UGC (App Store 1.2 / Google Play) ---
  /** ¿El usuario actual bloqueó a este autor? */
  estaBloqueado: (userId: string) => boolean;
  /** Bloquea a un usuario: deja de ver su contenido. */
  bloquearUsuario: (userId: string) => void;
  /** Quita el bloqueo de un usuario. */
  desbloquearUsuario: (userId: string) => void;
  /** Registra un reporte de contenido objetable para revisión. */
  reportarContenido: (data: Omit<Reporte, 'id' | 'created_at'>) => void;

  crearPartido: (data: NuevoPartido, organizador: { id: string; nombre: string }) => string;
  /** Inscribe al usuario y registra el pago. Devuelve el pago creado. */
  inscribirse: (
    partidoId: string,
    jugadorId: string,
    medio: string,
    estado: EstadoPago,
  ) => Pago;
  salirse: (partidoId: string, jugadorId: string) => void;
}

const genId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
const genRef = () => 'FU-' + Math.random().toString(36).slice(2, 8).toUpperCase();

// Mensajes de ejemplo para que el chat se sienta vivo en el demo
const mensajesSeed: Record<string, Mensaje[]> = {
  p1: [
    {
      id: 'm1',
      partido_id: 'p1',
      autor_id: 'u2',
      autor_nombre: 'Andrés',
      texto: 'Parce, ya está casi armado. Falta uno no más. ⚽',
      created_at: '2026-06-22T18:00:00Z',
    },
    {
      id: 'm2',
      partido_id: 'p1',
      autor_id: 'u7',
      autor_nombre: 'Dani',
      texto: 'Yo llevo los petos. ¿Alguien lleva balón?',
      created_at: '2026-06-22T18:05:00Z',
    },
    {
      id: 'm3',
      partido_id: 'p1',
      autor_id: 'u2',
      autor_nombre: 'Andrés',
      texto: 'Listo el balón. Nos vemos a las 8, no lleguen tarde llave 😅',
      created_at: '2026-06-22T18:07:00Z',
    },
  ],
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      partidos: partidosDisponibles,
      inscritos: [],
      pagos: [],
      mensajes: mensajesSeed,
      calificaciones: [],
      posts: postsSeed,
      comentarios: {},
      bloqueados: [],
      reportes: [],
      temaId: DEFAULT_THEME_ID,

      setTema: (id) => {
        setActiveColors(id);
        set({ temaId: id });
      },

      getPartido: (id) => get().partidos.find((p) => p.id === id),
      estaInscrito: (id) => get().inscritos.includes(id),
      misPartidos: () => get().partidos.filter((p) => get().inscritos.includes(p.id)),
      getMensajes: (partidoId) => get().mensajes[partidoId] ?? [],

      enviarMensaje: (partidoId, autor, texto) => {
        const msg: Mensaje = {
          id: genId('msg'),
          partido_id: partidoId,
          autor_id: autor.id,
          autor_nombre: autor.nombre,
          texto: texto.trim(),
          created_at: new Date().toISOString(),
        };
        set((s) => ({
          mensajes: { ...s.mensajes, [partidoId]: [...(s.mensajes[partidoId] ?? []), msg] },
        }));
      },

      // --- Muro social ---
      getComentarios: (postId) => get().comentarios[postId] ?? [],

      crearPost: (data, autor) => {
        const id = genId('post');
        const nuevo: Post = {
          id,
          tipo: data.tipo,
          autor_id: autor.id,
          autor_nombre: autor.nombre,
          autor_avatar: autor.avatar_url ?? null,
          texto: data.texto.trim(),
          foto_url: data.foto_url ?? null,
          partido_id: data.partido_id ?? null,
          likes: [],
          created_at: new Date().toISOString(),
        };
        set((s) => ({ posts: [nuevo, ...s.posts] }));
        return id;
      },

      toggleLike: (postId, userId) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likes: p.likes.includes(userId)
                    ? p.likes.filter((u) => u !== userId)
                    : [...p.likes, userId],
                }
              : p,
          ),
        }));
      },

      comentar: (postId, autor, texto) => {
        const limpio = texto.trim();
        if (!limpio) return;
        const c: Comentario = {
          id: genId('com'),
          post_id: postId,
          autor_id: autor.id,
          autor_nombre: autor.nombre,
          texto: limpio,
          created_at: new Date().toISOString(),
        };
        set((s) => ({
          comentarios: { ...s.comentarios, [postId]: [...(s.comentarios[postId] ?? []), c] },
        }));
      },

      generarRecapsPendientes: (userId, ahoraISO) => {
        const ahora = Date.parse(ahoraISO);
        const { partidos, inscritos, posts } = get();
        const conRecap = new Set(
          posts.filter((p) => p.tipo === 'recap' && p.partido_id).map((p) => p.partido_id),
        );
        const nuevos: Post[] = [];
        for (const partido of partidos) {
          if (!inscritos.includes(partido.id)) continue;
          if (conRecap.has(partido.id)) continue;
          if (matchDateTime(partido.fecha, partido.hora).getTime() > ahora) continue; // todavía no termina
          nuevos.push({
            id: genId('post'),
            tipo: 'recap',
            autor_id: 'sistema',
            autor_nombre: 'Falta Uno',
            autor_avatar: null,
            texto: `⚽ El partido en ${partido.cancha} ya terminó. ¿Cómo estuvo, parce? Contá la hazaña y calificá a la gallada. 🔥`,
            foto_url: partido.foto_url ?? null,
            partido_id: partido.id,
            likes: [],
            created_at: new Date().toISOString(),
          });
        }
        if (nuevos.length) set((s) => ({ posts: [...nuevos, ...s.posts] }));
      },

      // --- Moderación UGC ---
      estaBloqueado: (userId) => get().bloqueados.includes(userId),

      bloquearUsuario: (userId) => {
        set((s) =>
          s.bloqueados.includes(userId) ? s : { bloqueados: [...s.bloqueados, userId] },
        );
      },

      desbloquearUsuario: (userId) => {
        set((s) => ({ bloqueados: s.bloqueados.filter((id) => id !== userId) }));
      },

      reportarContenido: (data) => {
        const reporte: Reporte = {
          id: genId('rep'),
          ...data,
          created_at: new Date().toISOString(),
        };
        set((s) => ({ reportes: [reporte, ...s.reportes] }));
        // Con Supabase configurado, persistimos el reporte para revisión del equipo.
        if (supabaseConfigurado) {
          supabase
            .from('reportes')
            .insert({
              tipo: data.tipo,
              contenido_id: data.contenido_id,
              autor_id: data.autor_id,
              reportado_por: data.reportado_por,
              motivo: data.motivo,
              texto: data.texto,
            } as never)
            .then(() => {});
        }
      },

      crearPartido: (data, organizador) => {
        const id = genId('p');
        const nuevo: PartidoConOrganizador = {
          id,
          organizador_id: organizador.id,
          cancha: data.cancha,
          zona: data.zona,
          fecha: data.fecha,
          hora: data.hora,
          formato: data.formato,
          nivel: data.nivel,
          precio: data.precio,
          cupos_totales: CUPOS_POR_FORMATO[data.formato],
          cupos_ocupados: 1, // el organizador cuenta como inscrito
          descripcion: data.descripcion || null,
          foto_url: data.foto_url ?? null,
          created_at: new Date().toISOString(),
          organizador: { nombre: organizador.nombre, avatar_url: null, rating: 5 },
        };
        set((s) => ({ partidos: [nuevo, ...s.partidos], inscritos: [...s.inscritos, id] }));
        return id;
      },

      inscribirse: (partidoId, jugadorId, medio, estado) => {
        const partido = get().getPartido(partidoId);
        const precio = partido?.precio ?? 0;
        const comision = Math.round(precio * COMISION_SERVICIO);
        const pago: Pago = {
          id: genId('pago'),
          partido_id: partidoId,
          jugador_id: jugadorId,
          medio,
          monto: precio + comision,
          comision,
          estado,
          referencia: genRef(),
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          pagos: [pago, ...s.pagos],
          inscritos: s.inscritos.includes(partidoId) ? s.inscritos : [...s.inscritos, partidoId],
          partidos: s.partidos.map((p) =>
            p.id === partidoId
              ? { ...p, cupos_ocupados: Math.min(p.cupos_totales, p.cupos_ocupados + 1) }
              : p,
          ),
        }));
        return pago;
      },

      yaCalifico: (partidoId) => get().calificaciones.some((c) => c.partido_id === partidoId),

      calificarPartido: (partidoId, autorId, data) => {
        const cal: Calificacion = {
          id: genId('cal'),
          partido_id: partidoId,
          autor_id: autorId,
          estrellas: data.estrellas,
          organizador_estrellas: data.organizador_estrellas,
          hubo_no_show: data.hubo_no_show,
          comentario: data.comentario.trim(),
          created_at: new Date().toISOString(),
        };
        set((s) => ({ calificaciones: [cal, ...s.calificaciones] }));
      },

      salirse: (partidoId) => {
        set((s) => ({
          inscritos: s.inscritos.filter((id) => id !== partidoId),
          partidos: s.partidos.map((p) =>
            p.id === partidoId
              ? { ...p, cupos_ocupados: Math.max(0, p.cupos_ocupados - 1) }
              : p,
          ),
        }));
      },
    }),
    {
      name: 'faltauno.store',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos lo que el usuario generó; los partidos seed se recargan
      partialize: (s) => ({
        inscritos: s.inscritos,
        pagos: s.pagos,
        partidos: s.partidos,
        mensajes: s.mensajes,
        calificaciones: s.calificaciones,
        posts: s.posts,
        comentarios: s.comentarios,
        bloqueados: s.bloqueados,
        reportes: s.reportes,
        temaId: s.temaId,
      }),
      onRehydrateStorage: () => (state) => {
        // Al recuperar el tema persistido, sincronizamos el proxy de Colors (JS)
        if (state?.temaId) setActiveColors(state.temaId);
      },
    },
  ),
);
