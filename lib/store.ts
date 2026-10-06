import { subirImagen } from '@/lib/media';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setActiveColors } from '@/constants/colors';
import { CUPOS_POR_FORMATO, type Formato, type Nivel } from '@/constants/config';
import { DEFAULT_THEME_ID } from '@/constants/themes';
import { conOrganizadores } from '@/lib/partidos';
import { matchDateTime } from '@/lib/format';
import { PAGE_SIZE, comprobarRespuesta, hoyColombia, leerPaginas, unirPorId } from '@/lib/data-utils';
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
  usuarioId: string | null;
  errorCarga: string | null;
  cargando: boolean;
  hayMasPosts: boolean;
  hayMasPartidos: boolean;
  hayMasComentarios: Record<string, boolean>;
  reiniciarSesion: (userId: string | null) => void;
  cargarMasPosts: () => Promise<void>;
  cargarMasPartidos: () => Promise<void>;
  cargarPartido: (id: string) => Promise<void>;
  cargarPost: (id: string) => Promise<void>;
  cargarComentarios: (id: string, mas?: boolean) => Promise<void>;
  hidratado: boolean; // ya se trajeron datos reales de Supabase al menos una vez

  setTema: (id: string) => void;
  /** Trae partidos, muro, inscripciones y pagos reales desde Supabase. */
  hidratar: (userId: string, forzar?: boolean) => Promise<void>;
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
  ) => Promise<void>;

  // --- Muro social ---
  getComentarios: (postId: string) => Comentario[];
  crearPost: (data: NuevoPost, autor: AutorPost) => Promise<string>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  comentar: (postId: string, autor: AutorPost, texto: string) => Promise<void>;
  /** Crea posts-recap para los partidos del usuario que ya terminaron (solo local). */
  generarRecapsPendientes: (userId: string, ahoraISO: string) => void;

  // --- Moderación UGC (App Store 1.2 / Google Play) ---
  /** ¿El usuario actual bloqueó a este autor? */
  estaBloqueado: (userId: string) => boolean;
  /** Bloquea a un usuario: deja de ver su contenido. `byUserId` = quién bloquea (para persistir). */
  bloquearUsuario: (userId: string, byUserId?: string) => Promise<void>;
  /** Quita el bloqueo de un usuario. */
  desbloquearUsuario: (userId: string, byUserId?: string) => Promise<void>;
  /** Registra un reporte de contenido objetable para revisión. */
  reportarContenido: (data: Omit<Reporte, 'id' | 'created_at' | 'estado'>) => Promise<void>;

  crearPartido: (data: NuevoPartido, organizador: { id: string; nombre: string }) => Promise<string>;
  /**
   * Inscribe al usuario y registra el pago. Devuelve el pago creado.
   * `referencia` permite pasar una referencia ya generada (p. ej. la que se
   * envió al checkout de PayU) para poder conciliarla con el webhook.
   */
  inscribirse: (
    partidoId: string,
    jugadorId: string,
    medio: string,
    estado: EstadoPago,
    referencia?: string,
  ) => Promise<Pago>;
  salirse: (partidoId: string, jugadorId: string) => Promise<void>;
}

const genId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
/** Referencia legible de pago tipo FU-XXXXXX (se comparte con la pasarela). */
export const genRef = () => 'FU-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 12).toUpperCase();

/** En modo demo (sin Supabase) arrancamos con datos de ejemplo; con backend, vacío. */
const USAR_SEEDS = !supabaseConfigurado;

// Invalidate all pending reads when the account changes. Each flight is scoped.
let sesionVersion = 0;
let ultimaCarga = 0;
let cursorPartidos: PartidoConOrganizador | null = null;
const cursoresComentarios = new Map<string,Comentario>();
let cursorPosts: { created_at: string; id: string } | null = null;
const consultas = new Map<string, Promise<void>>();
const likesPendientes = new Set<string>();
const inscripcionesPendientes = new Map<string, Promise<Pago>>();

function consultaCompartida(clave: string, tarea: () => Promise<void>): Promise<void> {
  const existente = consultas.get(clave);
  if (existente) return existente;
  const promesa = Promise.resolve().then(tarea).finally(() => {
    if (consultas.get(clave) === promesa) consultas.delete(clave);
  });
  consultas.set(clave, promesa);
  return promesa;
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
      usuarioId: null,
      errorCarga: null,
      cargando: false,
      hayMasPosts: false,
      hayMasPartidos: false,
      hayMasComentarios: {},

      setTema: (id) => {
        setActiveColors(id);
        set({ temaId: id });
      },

      // ----------------------------------------------------------------------
      // HIDRATACIÓN: trae los datos reales de Supabase y reemplaza el estado.
      // ----------------------------------------------------------------------
      reiniciarSesion: (userId) => {
        if (get().usuarioId === userId) return;
        sesionVersion++;
        ultimaCarga = 0;
        cursorPartidos = null;
        cursoresComentarios.clear();
        cursorPosts = null;
        consultas.clear();
        likesPendientes.clear();
        inscripcionesPendientes.clear();
        set({ usuarioId: userId, hidratado: false, cargando: false, errorCarga: null,
          partidos: USAR_SEEDS ? partidosDisponibles : [], posts: USAR_SEEDS ? postsSeed : [],
          inscritos: [], pagos: [], mensajes: USAR_SEEDS ? mensajesSeed : {}, comentarios: {},
          calificaciones: [], bloqueados: [], reportes: [], hayMasPosts: false, hayMasPartidos: false, hayMasComentarios: {} });
      },

      hidratar: async (userId, forzar = false) => {
        if (!supabaseConfigurado) { set({ hidratado: true }); return; }
        if (get().usuarioId && get().usuarioId !== userId) get().reiniciarSesion(userId);
        else if (!get().usuarioId) set({ usuarioId: userId });
        if (!forzar && get().hidratado && Date.now() - ultimaCarga < 30000) return;
        const version = sesionVersion;
        return consultaCompartida(`hidratar:${userId}`, async () => {
          if (version !== sesionVersion) return;
          set({ cargando: true, errorCarga: null });
          const privado = !userId.startsWith('demo');
          try {
            const [partidosRes, inscRaw, pagosRaw, postsRes, calRaw, bloqRaw, propios] = await Promise.all([
              supabase.from('partidos').select('*').gte('fecha', hoyColombia()).eq('oculto',false)
                .order('fecha').order('hora').order('id').range(0, PAGE_SIZE - 1),
              privado ? leerPaginas<{ partido_id: string }>((a,b) => supabase.from('partido_jugadores')
                .select('partido_id').eq('jugador_id',userId).order('id').range(a,b)) : Promise.resolve([]),
              privado ? leerPaginas<Pago>((a,b) => supabase.from('pagos').select('*').eq('jugador_id',userId)
                .order('created_at',{ascending:false}).order('id').range(a,b)) : Promise.resolve([]),
              supabase.rpc('feed_posts', { p_limite: PAGE_SIZE } as never),
              privado ? leerPaginas<Calificacion>((a,b) => supabase.from('calificaciones').select('*')
                .eq('autor_id',userId).order('id').range(a,b)) : Promise.resolve([]),
              privado ? leerPaginas<{ bloqueado_id: string }>((a,b) => supabase.from('bloqueos')
                .select('bloqueado_id').eq('usuario_id',userId).order('id').range(a,b)) : Promise.resolve([]),
              privado ? leerPaginas<PartidoConOrganizador>((a,b) => supabase.from('partidos').select('*')
                .eq('organizador_id',userId).order('id').range(a,b)) : Promise.resolve([]),
            ]);
            const pagina = (comprobarRespuesta(partidosRes) ?? []) as PartidoConOrganizador[];
            const posts = (comprobarRespuesta(postsRes) ?? []) as unknown as Post[];
            const inscritos = [...new Set([...inscRaw.map(r => r.partido_id), ...propios.map(p => p.id)])];
            let partidos = unirPorId(pagina, propios);
            // Only this account's matches can require older/out-of-page rows.
            const faltantes = inscritos.filter(id => !partidos.some(p => p.id === id));
            for (let i = 0; i < faltantes.length; i += 100) {
              const filas = comprobarRespuesta(await supabase.from('partidos').select('*').in('id',faltantes.slice(i,i+100))) ?? [];
              partidos = unirPorId(partidos, filas as PartidoConOrganizador[]);
            }
            const conOrg = await conOrganizadores(partidos);
            if (version !== sesionVersion) return;
            cursorPosts = posts.length ? posts[posts.length - 1] : null;
            cursorPartidos = pagina.length ? pagina[pagina.length-1] : null;
            ultimaCarga = Date.now();
            set({ partidos: conOrg, inscritos, pagos: pagosRaw, posts,
              calificaciones: calRaw, bloqueados: bloqRaw.map(b => b.bloqueado_id),
              hidratado: true, hayMasPosts: posts.length === PAGE_SIZE,
              hayMasPartidos: pagina.length === PAGE_SIZE, errorCarga: null });
          } catch {
            if (version === sesionVersion) set({ errorCarga: 'No pudimos actualizar los datos. Revisá tu conexión y reintentá.' });
          } finally {
            if (version === sesionVersion) set({ cargando: false });
          }
        });
      },

      cargarMasPosts: () => consultaCompartida('masPosts', async () => {
        if (!supabaseConfigurado || !get().hayMasPosts || !cursorPosts) return;
        const version = sesionVersion;
        const filas = (comprobarRespuesta(await supabase.rpc('feed_posts', {
          p_antes: cursorPosts.created_at, p_antes_id: cursorPosts.id, p_limite: PAGE_SIZE,
        } as never)) ?? []) as unknown as Post[];
        if (version !== sesionVersion) return;
        if (filas.length) cursorPosts = filas[filas.length-1];
        set(s => ({ posts: unirPorId(s.posts,filas), hayMasPosts: filas.length === PAGE_SIZE }));
      }),

      cargarMasPartidos: () => consultaCompartida('masPartidos', async () => {
        if (!supabaseConfigurado || !get().hayMasPartidos || !cursorPartidos) return;
        const version = sesionVersion;
        const ultimo = cursorPartidos;
        const filas = (comprobarRespuesta(await supabase.from('partidos').select('*').gte('fecha',hoyColombia()).eq('oculto',false)
          .or(`fecha.gt.${ultimo.fecha},and(fecha.eq.${ultimo.fecha},hora.gt.${ultimo.hora}),and(fecha.eq.${ultimo.fecha},hora.eq.${ultimo.hora},id.gt.${ultimo.id})`)
          .order('fecha').order('hora').order('id').limit(PAGE_SIZE)) ?? []) as PartidoConOrganizador[];
        const partidos = await conOrganizadores(filas);
        if (version !== sesionVersion) return;
        if (filas.length) cursorPartidos = filas[filas.length-1];
        set(s => ({ partidos: unirPorId(s.partidos,partidos), hayMasPartidos: filas.length === PAGE_SIZE }));
      }),

      cargarPartido: id => consultaCompartida(`partido:${id}`, async () => {
        if (!supabaseConfigurado) return;
        const version = sesionVersion;
        const fila = comprobarRespuesta(await supabase.from('partidos').select('*').eq('id',id).maybeSingle());
        if (!fila) return;
        const partidos = await conOrganizadores([fila as PartidoConOrganizador]);
        if (version === sesionVersion) set(s => ({ partidos: unirPorId(s.partidos,partidos) }));
      }),

      cargarPost: id => consultaCompartida(`post:${id}`, async () => {
        if (!supabaseConfigurado || id.startsWith('post-')) return;
        const version = sesionVersion;
        const filas = (comprobarRespuesta(await supabase.rpc('feed_posts',{p_post:id,p_limite:1} as never)) ?? []) as unknown as Post[];
        if (version === sesionVersion) set(s => ({ posts: unirPorId(s.posts,filas) }));
      }),

      cargarComentarios: (id, mas = false) => consultaCompartida(`comentarios:${id}`, async () => {
        if (!supabaseConfigurado || id.startsWith('post-')) return;
        const version = sesionVersion;
        const cursor = mas ? cursoresComentarios.get(id) : null;
        let query = supabase.from('comentarios').select('*').eq('post_id',id);
        if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
        const filas = (comprobarRespuesta(await query.order('created_at',{ascending:false})
          .order('id',{ascending:false}).limit(PAGE_SIZE)) ?? []) as Comentario[];
        if (version === sesionVersion && filas.length) cursoresComentarios.set(id,filas[filas.length-1]);
        if (version === sesionVersion) set(s => ({
          comentarios: { ...s.comentarios, [id]: unirPorId(mas ? (s.comentarios[id] ?? []) : [],filas) },
          hayMasComentarios: { ...s.hayMasComentarios, [id]: filas.length === PAGE_SIZE },
        }));
      }),

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
        const version = sesionVersion;
        const texto = data.texto.trim();
        // Con backend: insertamos en Supabase y usamos la fila real (id UUID).
        if (supabaseConfigurado) {
          const fotoUrl = await subirImagen(data.foto_url,autor.id);
          if (version !== sesionVersion) throw new Error('La sesión cambió. Volvé a entrar.');
          const { data: fila, error } = await supabase
            .from('posts')
            .insert({
              tipo: data.tipo,
              autor_id: autor.id,
              autor_nombre: autor.nombre, // el trigger lo reescribe con el perfil real
              autor_avatar: autor.avatar_url ?? null,
              texto,
              foto_url: fotoUrl,
              partido_id: data.partido_id ?? null,
            } as never)
            .select()
            .single();
          if (!error && fila) {
            if (version !== sesionVersion) throw new Error('La sesión cambió. Volvé a entrar.');
            const nuevo = { ...(fila as Post), likes: [], like_count: 0, comment_count: 0 };
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

      toggleLike: async (postId, userId) => {
        const key = `${postId}:${userId}`;
        if (likesPendientes.has(key)) return;
        const post = get().posts.find(p => p.id === postId);
        if (!post) return;
        const yaLike = post.likes.includes(userId);
        const version = sesionVersion;
        likesPendientes.add(key);
        let total = Math.max(0,(post.like_count ?? post.likes.length)+(yaLike ? -1 : 1));
        try {
          if (supabaseConfigurado) {
            if (userId.startsWith('demo') || postId.startsWith('post-')) throw new Error('Creá una cuenta para dar me gusta.');
            const response = comprobarRespuesta(await supabase.rpc('set_post_like',{p_post:postId,p_like:!yaLike} as never)) as unknown as {like_count:number} | null;
            if (!response) throw new Error('No pudimos guardar el me gusta.');
            total = response.like_count;
          }
          if (version !== sesionVersion) return;
          set(s => ({ posts: s.posts.map(p => p.id === postId ? { ...p,
            likes: yaLike ? p.likes.filter(u => u !== userId) : [...new Set([...p.likes,userId])],
            like_count: total,
          } : p) }));
        } finally { likesPendientes.delete(key); }
      },

      comentar: async (postId, autor, texto) => {
        const limpio = texto.trim();
        if (!limpio) return;
        if (limpio.length > 500) throw new Error('El comentario puede tener hasta 500 caracteres.');
        const version = sesionVersion;
        let c: Comentario = { id: genId('com'), post_id: postId, autor_id: autor.id,
          autor_nombre: autor.nombre, texto: limpio, created_at: new Date().toISOString() };
        if (supabaseConfigurado) {
          if (postId.startsWith('post-')) throw new Error('Este resumen es local. Comentá en una publicación del muro.');
          const fila = comprobarRespuesta(await supabase.from('comentarios').insert({
            post_id:postId,autor_id:autor.id,autor_nombre:autor.nombre,texto:limpio,
          } as never).select().single());
          if (!fila) throw new Error('No pudimos guardar tu comentario.');
          c = fila as Comentario;
        }
        if (version !== sesionVersion) return;
        set(s => ({ comentarios: { ...s.comentarios, [postId]: unirPorId([c],s.comentarios[postId] ?? []) },
          posts: s.posts.map(p => p.id === postId ? { ...p,comment_count:(p.comment_count ?? s.comentarios[postId]?.length ?? 0)+1 } : p) }));
      },

      generarRecapsPendientes: (userId, ahoraISO) => {
        if (supabaseConfigurado) return; // Never publish local recaps as if they were shared server posts.
        const ahora = Date.parse(ahoraISO);
        const { partidos, inscritos, posts } = get();
        const conRecap = new Set(
          posts.filter((p) => p.tipo === 'recap' && p.partido_id).map((p) => p.partido_id),
        );
        const nuevos: Post[] = [];
        for (const partido of partidos) {
          if (!inscritos.includes(partido.id)) continue;
          if (conRecap.has(partido.id)) continue;
          if (matchDateTime(partido.fecha, partido.hora).getTime() + 2 * 60 * 60 * 1000 > ahora) continue; // todavía no termina
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

      bloquearUsuario: async (userId,byUserId) => {
        const version = sesionVersion;
        if (supabaseConfigurado) {
          if (!byUserId || byUserId.startsWith('demo')) throw new Error('Necesitás iniciar sesión para bloquear.');
          comprobarRespuesta(await supabase.from('bloqueos').upsert({usuario_id:byUserId,bloqueado_id:userId} as never,
            {onConflict:'usuario_id,bloqueado_id',ignoreDuplicates:true}));
        }
        if (version === sesionVersion) set(s => ({bloqueados:[...new Set([...s.bloqueados,userId])]}));
      },

      desbloquearUsuario: async (userId,byUserId) => {
        const version = sesionVersion;
        if (supabaseConfigurado) {
          if (!byUserId || byUserId.startsWith('demo')) throw new Error('Necesitás iniciar sesión para desbloquear.');
          comprobarRespuesta(await supabase.from('bloqueos').delete().eq('usuario_id',byUserId).eq('bloqueado_id',userId));
        }
        if (version === sesionVersion) set(s => ({bloqueados:s.bloqueados.filter(id => id !== userId)}));
      },

      reportarContenido: async data => {
        const version = sesionVersion;
        if (supabaseConfigurado) comprobarRespuesta(await supabase.from('reportes').insert(data as never));
        if (version === sesionVersion) set(s => ({reportes:[{...data,id:genId('rep'),estado:'pendiente',created_at:new Date().toISOString()},...s.reportes]}));
      },

      crearPartido: async (data, organizador) => {
        const version = sesionVersion;
        // Con backend: creamos el partido real y usamos su UUID.
        if (supabaseConfigurado) {
          const fotoUrl = await subirImagen(data.foto_url,organizador.id);
          if (version !== sesionVersion) throw new Error('La sesión cambió. Volvé a entrar.');
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
              foto_url: fotoUrl,
            } as never)
            .select()
            .single();
          if (error || !fila) throw new Error('No pudimos publicar el partido. Probá de nuevo.');
          if (version !== sesionVersion) throw new Error('La sesión cambió. Volvé a entrar.');
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
        if (estado !== 'pendiente') throw new Error('El pago lo confirma el servidor; debe quedar pendiente.');
        const key = `${partidoId}:${jugadorId}`;
        const pendiente = inscripcionesPendientes.get(key);
        if (pendiente) return pendiente;
        const version = sesionVersion;
        const operacion = (async () => {
          if (supabaseConfigurado) {
            const result = await supabase.rpc('inscribirse_partido', {
              p_partido: partidoId, p_medio: medio, p_referencia: referencia ?? genRef(),
            } as never);
            if (result.error) throw new Error(result.error.message || 'No pudimos inscribirte. Probá de nuevo.');
            const row = result.data as unknown as { pago: Pago; cupos_ocupados: number } | null;
            if (!row?.pago) throw new Error('No pudimos registrar el pago.');
            if (version !== sesionVersion) throw new Error('La sesión cambió. Volvé a iniciar sesión.');
            set(s => ({ pagos: unirPorId([row.pago],s.pagos),
              inscritos: [...new Set([...s.inscritos,partidoId])],
              partidos: s.partidos.map(p => p.id === partidoId ? {...p,cupos_ocupados:row.cupos_ocupados} : p) }));
            return row.pago;
          }
          const partido = get().getPartido(partidoId);
          if (!partido) throw new Error('Partido no encontrado.');
          const existente = get().pagos.find(p => p.partido_id === partidoId && p.jugador_id === jugadorId && p.estado !== 'rechazado');
          if (get().inscritos.includes(partidoId)) {
            if (existente) return existente;
            throw new Error('Ya estás inscrito en este partido.');
          }
          if (partido.cupos_ocupados >= partido.cupos_totales) throw new Error('El partido ya está lleno, parce.');
          if (matchDateTime(partido.fecha,partido.hora).getTime() <= Date.now()) throw new Error('El partido ya comenzó.');
          if (medio !== 'efectivo') throw new Error('El pago online necesita conexión con el servidor.');
          const pago: Pago = { id:genId('pago'),partido_id:partidoId,jugador_id:jugadorId,medio,
            monto:partido.precio,comision:0,estado:'pendiente',referencia:referencia ?? genRef(),created_at:new Date().toISOString() };
          set(s => ({ pagos:[pago,...s.pagos],inscritos:[...s.inscritos,partidoId],
            partidos:s.partidos.map(p => p.id === partidoId ? {...p,cupos_ocupados:p.cupos_ocupados+1} : p) }));
          return pago;
        })();
        inscripcionesPendientes.set(key,operacion);
        try { return await operacion; } finally {
          if (inscripcionesPendientes.get(key) === operacion) inscripcionesPendientes.delete(key);
        }
      },

      yaCalifico: (partidoId) => get().calificaciones.some((c) => c.partido_id === partidoId),

      calificarPartido: async (partidoId, autorId, data) => {
        if (get().yaCalifico(partidoId)) throw new Error('Ya calificaste este partido.');
        const partido = get().getPartido(partidoId);
        if (!partido || !get().estaInscrito(partidoId)) throw new Error('Necesitás participar para calificar.');
        if (matchDateTime(partido.fecha,partido.hora).getTime() + 2*60*60*1000 > Date.now()) throw new Error('Podés calificar cuando termine el partido.');
        const version = sesionVersion;
        const campos = {partido_id:partidoId,autor_id:autorId,...data,comentario:data.comentario.trim()};
        let cal: Calificacion = {...campos,id:genId('cal'),created_at:new Date().toISOString()};
        if (supabaseConfigurado) {
          const fila = comprobarRespuesta(await supabase.from('calificaciones').insert(campos as never).select().single());
          if (!fila) throw new Error('No pudimos guardar tu calificación.');
          cal = fila as Calificacion;
        }
        if (version === sesionVersion) set(s => ({calificaciones:unirPorId([cal],s.calificaciones)}));
      },

      salirse: async (partidoId,jugadorId) => {
        const partido = get().getPartido(partidoId);
        if (partido?.organizador_id === jugadorId) throw new Error('Sos el organizador. No podés liberar ese cupo.');
        if (!get().estaInscrito(partidoId)) return;
        const version = sesionVersion;
        if (supabaseConfigurado) comprobarRespuesta(await supabase.from('partido_jugadores').delete()
          .eq('partido_id',partidoId).eq('jugador_id',jugadorId));
        if (version !== sesionVersion) return;
        set(s => ({inscritos:s.inscritos.filter(id => id !== partidoId),
          partidos:s.partidos.map(p => p.id === partidoId ? {...p,cupos_ocupados:Math.max(1,p.cupos_ocupados-1)} : p)}));
        if (supabaseConfigurado) await get().cargarPartido(partidoId);
      },
    }),
    {
      name: 'faltauno.store',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos preferencias y estado local; los datos del servidor se
      // rehidratan desde Supabase en cada arranque (evita mostrar datos viejos).
      partialize: (s) => ({
        temaId: s.temaId,
        ...(USAR_SEEDS ? { bloqueados: s.bloqueados, usuarioId: s.usuarioId } : {}),
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
      merge: (persistido, actual) => {
        const datos = persistido as Partial<StoreState> | undefined;
        return USAR_SEEDS ? { ...actual, ...datos } : { ...actual, temaId: datos?.temaId ?? actual.temaId };
      },
      onRehydrateStorage: () => (state) => {
        // Al recuperar el tema persistido, sincronizamos el proxy de Colors (JS)
        if (state?.temaId) setActiveColors(state.temaId);
      },
    },
  ),
);
