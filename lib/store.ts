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
  mensajes: Record<string, Mensaje[]>; // chat por partido (fallback local; el real usa lib/chat.ts)
  calificaciones: Calificacion[]; // reputación
  posts: Post[]; // muro social
  comentarios: Record<string, Comentario[]>; // comentarios por post (postId -> comentarios)
  bloqueados: string[]; // ids de usuarios bloqueados por el usuario actual (moderación UGC)
  reportes: Reporte[]; // reportes de contenido objetable
  temaId: string; // id del tema de color activo
  hidratado: boolean; // ya se trajeron datos reales de Supabase al menos una vez

  setTema: (id: string) => void;
  /** Trae partidos, muro, inscripciones y pagos reales desde Supabase. */
  hidratar: (userId: string) => Promise<void>;
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
  crearPost: (data: NuevoPost, autor: AutorPost) => Promise<string>;
  toggleLike: (postId: string, userId: string) => void;
  comentar: (postId: string, autor: AutorPost, texto: string) => void;
  /** Crea posts-recap para los partidos del usuario que ya terminaron (solo local). */
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

  crearPartido: (data: NuevoPartido, organizador: { id: string; nombre: string }) => Promise<string>;
  /**
   * Inscribe al usuario y registra el pago. Devuelve el pago creado.
   * `referencia` permite pasar una referencia ya generada (p. ej. la que se
   * envió al checkout de Lemon Squeezy) para poder conciliarla con el webhook.
   */
  inscribirse: (
    partidoId: string,
    jugadorId: string,
    medio: string,
    estado: EstadoPago,
    referencia?: string,
  ) => Promise<Pago>;
  salirse: (partidoId: string, jugadorId: string) => void;
}

const genId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
/** Referencia legible de pago tipo FU-XXXXXX (se comparte con la pasarela). */
export const genRef = () => 'FU-' + Math.random().toString(36).slice(2, 8).toUpperCase();

/** En modo demo (sin Supabase) arrancamos con datos de ejemplo; con backend, vacío. */
const USAR_SEEDS = !supabaseConfigurado;

/** Ejecuta una escritura en Supabase en segundo plano, ignorando el resultado. */
function bg(promesa: PromiseLike<unknown>) {
  Promise.resolve(promesa).then(
    () => {},
    () => {},
  );
}

// Mensajes de ejemplo para que el chat se sienta vivo en el demo (solo sin backend)
const mensajesSeed: Record<string, Mensaje[]> = USAR_SEEDS
  ? {
      p1: [
        { id: 'm1', partido_id: 'p1', autor_id: 'u2', autor_nombre: 'Andrés', texto: 'Parce, ya está casi armado. Falta uno no más. ⚽', created_at: '2026-06-22T18:00:00Z' },
        { id: 'm2', partido_id: 'p1', autor_id: 'u7', autor_nombre: 'Dani', texto: 'Yo llevo los petos. ¿Alguien lleva balón?', created_at: '2026-06-22T18:05:00Z' },
        { id: 'm3', partido_id: 'p1', autor_id: 'u2', autor_nombre: 'Andrés', texto: 'Listo el balón. Nos vemos a las 8, no lleguen tarde llave 😅', created_at: '2026-06-22T18:07:00Z' },
      ],
    }
  : {};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      partidos: USAR_SEEDS ? partidosDisponibles : [],
      inscritos: [],
      pagos: [],
      mensajes: mensajesSeed,
      calificaciones: [],
      posts: USAR_SEEDS ? postsSeed : [],
      comentarios: {},
      bloqueados: [],
      reportes: [],
      temaId: DEFAULT_THEME_ID,
      hidratado: false,

      setTema: (id) => {
        setActiveColors(id);
        set({ temaId: id });
      },

      // ----------------------------------------------------------------------
      // HIDRATACIÓN: trae los datos reales de Supabase y reemplaza el estado.
      // ----------------------------------------------------------------------
      hidratar: async (userId) => {
        if (!supabaseConfigurado) {
          set({ hidratado: true });
          return;
        }
        try {
          const [
            { data: partidosRaw },
            { data: inscRaw },
            { data: pagosRaw },
            { data: postsRaw },
            { data: likesRaw },
            { data: comentRaw },
            { data: calRaw },
          ] = await Promise.all([
            supabase.from('partidos').select('*').order('fecha', { ascending: true }),
            supabase.from('partido_jugadores').select('partido_id').eq('jugador_id', userId),
            supabase.from('pagos').select('*').eq('jugador_id', userId).order('created_at', { ascending: false }),
            supabase.from('posts').select('*').order('created_at', { ascending: false }),
            supabase.from('post_likes').select('post_id, user_id'),
            supabase.from('comentarios').select('*').order('created_at', { ascending: true }),
            supabase.from('calificaciones').select('*').eq('autor_id', userId),
          ]);

          // Organizadores: nombre/avatar/rating desde la vista pública (RLS-safe)
          const partidos = (partidosRaw ?? []) as PartidoConOrganizador[];
          const orgIds = [...new Set(partidos.map((p) => p.organizador_id))];
          const organizadores: Record<string, { nombre: string; avatar_url: string | null; rating: number }> = {};
          if (orgIds.length) {
            const { data: perfiles } = await supabase
              .from('perfiles_publicos')
              .select('id, nombre, avatar_url, rating')
              .in('id', orgIds);
            const filas = (perfiles ?? []) as { id: string; nombre: string; avatar_url: string | null; rating: number }[];
            for (const p of filas) {
              organizadores[p.id] = { nombre: p.nombre, avatar_url: p.avatar_url, rating: p.rating };
            }
          }
          const partidosConOrg = partidos.map((p) => ({
            ...p,
            organizador: organizadores[p.organizador_id] ?? { nombre: 'Organizador', avatar_url: null, rating: 5 },
          }));

          // Likes: agrupamos user_ids por post
          const likesPorPost: Record<string, string[]> = {};
          for (const l of (likesRaw ?? []) as { post_id: string; user_id: string }[]) {
            (likesPorPost[l.post_id] ??= []).push(l.user_id);
          }
          // Recaps locales (auto-generados) no viven en Supabase: los conservamos
          const recapsLocales = get().posts.filter((p) => p.tipo === 'recap');
          const posts = [
            ...recapsLocales,
            ...((postsRaw ?? []) as Post[]).map((p) => ({ ...p, likes: likesPorPost[p.id] ?? [] })),
          ];

          // Comentarios agrupados por post
          const comentarios: Record<string, Comentario[]> = {};
          for (const c of (comentRaw ?? []) as Comentario[]) {
            (comentarios[c.post_id] ??= []).push(c);
          }

          // Inscritos: partidos donde soy jugador + partidos que organizo
          const inscritos = [
            ...new Set([
              ...((inscRaw ?? []) as { partido_id: string }[]).map((r) => r.partido_id),
              ...partidos.filter((p) => p.organizador_id === userId).map((p) => p.id),
            ]),
          ];

          set({
            partidos: partidosConOrg,
            inscritos,
            pagos: (pagosRaw ?? []) as Pago[],
            posts,
            comentarios,
            calificaciones: (calRaw ?? []) as Calificacion[],
            hidratado: true,
          });
        } catch {
          // Si algo falla (red, tabla), dejamos lo que haya y marcamos hidratado
          set({ hidratado: true });
        }
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

      crearPost: async (data, autor) => {
        const texto = data.texto.trim();
        // Con backend: insertamos en Supabase y usamos la fila real (id UUID).
        if (supabaseConfigurado) {
          const { data: fila, error } = await supabase
            .from('posts')
            .insert({
              tipo: data.tipo,
              autor_id: autor.id,
              autor_nombre: autor.nombre, // el trigger lo reescribe con el perfil real
              autor_avatar: autor.avatar_url ?? null,
              texto,
              foto_url: data.foto_url ?? null,
              partido_id: data.partido_id ?? null,
            } as never)
            .select()
            .single();
          if (!error && fila) {
            const nuevo = { ...(fila as Post), likes: [] };
            set((s) => ({ posts: [nuevo, ...s.posts] }));
            return nuevo.id;
          }
          throw new Error('No pudimos publicar. Probá de nuevo, parce.');
        }
        // Modo demo (sin backend): post local
        const id = genId('post');
        const nuevo: Post = {
          id,
          tipo: data.tipo,
          autor_id: autor.id,
          autor_nombre: autor.nombre,
          autor_avatar: autor.avatar_url ?? null,
          texto,
          foto_url: data.foto_url ?? null,
          partido_id: data.partido_id ?? null,
          likes: [],
          created_at: new Date().toISOString(),
        };
        set((s) => ({ posts: [nuevo, ...s.posts] }));
        return id;
      },

      toggleLike: (postId, userId) => {
        const yaLike = get().posts.find((p) => p.id === postId)?.likes.includes(userId) ?? false;
        // Optimista local
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, likes: yaLike ? p.likes.filter((u) => u !== userId) : [...p.likes, userId] }
              : p,
          ),
        }));
        // Persistimos en Supabase (post_likes)
        if (supabaseConfigurado) {
          if (yaLike) {
            bg(supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId));
          } else {
            bg(supabase.from('post_likes').insert({ post_id: postId, user_id: userId } as never));
          }
        }
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
        if (supabaseConfigurado) {
          bg(
            supabase.from('comentarios').insert({
              post_id: postId,
              autor_id: autor.id,
              autor_nombre: autor.nombre, // el trigger lo reescribe con el perfil real
              texto: limpio,
            } as never),
          );
        }
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
        set((s) => (s.bloqueados.includes(userId) ? s : { bloqueados: [...s.bloqueados, userId] }));
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
          bg(
            supabase.from('reportes').insert({
              tipo: data.tipo,
              contenido_id: data.contenido_id,
              autor_id: data.autor_id,
              reportado_por: data.reportado_por,
              motivo: data.motivo,
              texto: data.texto,
            } as never),
          );
        }
      },

      crearPartido: async (data, organizador) => {
        // Con backend: creamos el partido real y usamos su UUID.
        if (supabaseConfigurado) {
          const { data: fila, error } = await supabase
            .from('partidos')
            .insert({
              organizador_id: organizador.id,
              cancha: data.cancha,
              zona: data.zona,
              fecha: data.fecha,
              hora: data.hora,
              formato: data.formato,
              nivel: data.nivel,
              precio: data.precio,
              cupos_totales: CUPOS_POR_FORMATO[data.formato],
              descripcion: data.descripcion || null,
              foto_url: data.foto_url ?? null,
            } as never)
            .select()
            .single();
          if (error || !fila) throw new Error('No pudimos publicar el partido. Probá de nuevo.');
          const nuevo: PartidoConOrganizador = {
            ...(fila as PartidoConOrganizador),
            organizador: { nombre: organizador.nombre, avatar_url: null, rating: 5 },
          };
          set((s) => ({ partidos: [nuevo, ...s.partidos], inscritos: [...s.inscritos, nuevo.id] }));
          return nuevo.id;
        }
        // Modo demo: partido local
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
          cupos_ocupados: 1,
          descripcion: data.descripcion || null,
          foto_url: data.foto_url ?? null,
          created_at: new Date().toISOString(),
          organizador: { nombre: organizador.nombre, avatar_url: null, rating: 5 },
        };
        set((s) => ({ partidos: [nuevo, ...s.partidos], inscritos: [...s.inscritos, id] }));
        return id;
      },

      inscribirse: async (partidoId, jugadorId, medio, estado, referencia) => {
        const partido = get().getPartido(partidoId);
        const precio = partido?.precio ?? 0;
        const comision = Math.round(precio * COMISION_SERVICIO);
        const ref = referencia ?? genRef();

        if (supabaseConfigurado) {
          // 1) Inscripción: el trigger fn_sync_cupos ocupa el cupo (y bloquea si está lleno)
          const { error: errIns } = await supabase.from('partido_jugadores').insert({
            partido_id: partidoId,
            jugador_id: jugadorId,
            posicion: 'Mediocampista',
            confirmado: estado === 'aprobado',
          } as never);
          if (errIns && errIns.code !== '23505') {
            // 23505 = ya estaba inscrito; cualquier otro error (p.ej. lleno) lo mostramos
            throw new Error(errIns.message?.includes('lleno') ? 'El partido ya está lleno, parce.' : 'No pudimos inscribirte. Probá de nuevo.');
          }
          // 2) Pago (el cliente solo puede crear 'pendiente'; 'aprobado' lo pone el webhook)
          const { data: pagoRow } = await supabase
            .from('pagos')
            .insert({
              partido_id: partidoId,
              jugador_id: jugadorId,
              medio,
              monto: precio + comision,
              comision,
              estado: estado === 'aprobado' ? 'aprobado' : 'pendiente',
              referencia: ref,
            } as never)
            .select()
            .single();

          const pago: Pago = (pagoRow as unknown as Pago | null) ?? {
            id: genId('pago'),
            partido_id: partidoId,
            jugador_id: jugadorId,
            medio,
            monto: precio + comision,
            comision,
            estado,
            referencia: ref,
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
        }

        // Modo demo: pago local
        const pago: Pago = {
          id: genId('pago'),
          partido_id: partidoId,
          jugador_id: jugadorId,
          medio,
          monto: precio + comision,
          comision,
          estado,
          referencia: ref,
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
        if (supabaseConfigurado) {
          bg(
            supabase.from('calificaciones').insert({
              partido_id: partidoId,
              autor_id: autorId,
              estrellas: data.estrellas,
              organizador_estrellas: data.organizador_estrellas,
              hubo_no_show: data.hubo_no_show,
              comentario: data.comentario.trim(),
            } as never),
          );
        }
      },

      salirse: (partidoId, jugadorId) => {
        set((s) => ({
          inscritos: s.inscritos.filter((id) => id !== partidoId),
          partidos: s.partidos.map((p) =>
            p.id === partidoId ? { ...p, cupos_ocupados: Math.max(0, p.cupos_ocupados - 1) } : p,
          ),
        }));
        if (supabaseConfigurado) {
          bg(
            supabase
              .from('partido_jugadores')
              .delete()
              .eq('partido_id', partidoId)
              .eq('jugador_id', jugadorId),
          );
        }
      },
    }),
    {
      name: 'faltauno.store',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos preferencias y estado local; los datos del servidor se
      // rehidratan desde Supabase en cada arranque (evita mostrar datos viejos).
      partialize: (s) => ({
        temaId: s.temaId,
        bloqueados: s.bloqueados,
        // En modo demo (sin backend) sí conservamos lo que generó el usuario:
        ...(USAR_SEEDS
          ? {
              inscritos: s.inscritos,
              pagos: s.pagos,
              partidos: s.partidos,
              mensajes: s.mensajes,
              calificaciones: s.calificaciones,
              posts: s.posts,
              comentarios: s.comentarios,
              reportes: s.reportes,
            }
          : {}),
      }),
      onRehydrateStorage: () => (state) => {
        // Al recuperar el tema persistido, sincronizamos el proxy de Colors (JS)
        if (state?.temaId) setActiveColors(state.temaId);
      },
    },
  ),
);
