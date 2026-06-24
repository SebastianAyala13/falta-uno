# Muro Social + fix del Chat — Diseño

Fecha: 2026-06-23
Estado: aprobado por el usuario

## Objetivo
Agregar un **muro social** a Falta Uno (feed de posts sobre encuentros y preguntas
futbolísticas) y **arreglar el chat de partido**, manteniendo la experiencia
simple. Todo debe funcionar **sin backend** (modo demo en Expo Go), y quedar
listo para mapear a Supabase después.

## Restricciones
- Mantener Expo SDK 54 (Expo Go). No agregar módulos nativos fuera de los soportados por Expo Go.
- Estado local en zustand persistido (AsyncStorage), con datos seed para que nada se vea vacío.
- Evitar el bug de zustand: selectores que devuelven arrays nuevos → envolver con `useShallow`.

## 1. Fix del Chat (bug)
`useChatMensajes` ([lib/chat.ts]) usa `useStore((s) => s.getMensajes(partidoId))`,
y `getMensajes` devuelve `s.mensajes[partidoId] ?? []` → un array `[]` nuevo en
cada render cuando el partido no tiene mensajes → loop infinito
(`getSnapshot should be cached`). Fix: envolver con `useShallow`.

## 2. Navegación
Nuevo tab entre Crear y Perfil. Orden final: **Home · Buscar · [ + ] · Muro · Perfil**.
El botón `+` (Crear) queda centrado (3º de 5). Ícono del Muro: `newspaper`/`newspaper-outline`.

## 3. Modelo de datos
Nuevos tipos en `types/database.ts`:

```ts
type PostTipo = 'recap' | 'encuentro' | 'pregunta';

interface Post {
  id: string;
  tipo: PostTipo;
  autor_id: string;
  autor_nombre: string;
  autor_avatar: string | null;
  texto: string;
  foto_url: string | null;
  partido_id: string | null; // ligado a un partido (recap/encuentro)
  likes: string[];           // ids de usuarios que dieron like
  created_at: string;
}

interface Comentario {
  id: string;
  post_id: string;
  autor_id: string;
  autor_nombre: string;
  texto: string;
  created_at: string;
}
```

## 4. Store (zustand)
Agregar al store:
- Estado: `posts: Post[]`, `comentarios: Record<string, Comentario[]>` (por `post_id`).
- Acciones:
  - `crearPost(data, autor): string`
  - `toggleLike(postId, userId): void`
  - `comentar(postId, autor, texto): void`
  - `getComentarios(postId): Comentario[]` (consumir con `useShallow`)
  - `generarRecapsPendientes(userId, ahoraISO): void`
- Persistir `posts` y `comentarios` en `partialize`.
- Seed: 3-4 posts de ejemplo (encuentros + preguntas) en contexto Pereira.

## 5. Auto-post post-partido
Helper para combinar `fecha` (YYYY-MM-DD) + `hora` (HH:mm) → Date.
`generarRecapsPendientes(userId, ahora)`:
- Para cada partido en `inscritos` cuya fecha+hora < ahora y que **no** tenga ya
  un post `recap` con ese `partido_id`: crear un `Post` tipo `recap`.
- Texto: "⚽ El partido en {cancha} ya terminó. ¿Cómo estuvo, parce? Dejá tu
  reseña y calificá a la gallada."
- Autor: sistema ("Falta Uno").
Se dispara al abrir la app (hook en el layout de tabs o en el muro), usando
`new Date().toISOString()` (disponible en runtime RN).

Render del recap: borde acento + badge "Tu partido" + botón **Calificar**
(→ `app/calificar/[id]`).

## 6. UI
- `app/(tabs)/muro.tsx`: feed (FlatList) con chips **Todos / Encuentros / Preguntas**
  y un compositor arriba ("¿Qué se cuenta, parce?") que navega a crear-post.
- `components/PostCard.tsx`: avatar, nombre, tiempo relativo, badge de tipo, texto,
  foto opcional, ❤️ like (contador, toggle), 💬 comentarios (contador → abre detalle).
- `app/crear-post.tsx`: selector Encuentro/Pregunta, texto, foto opcional
  (galería con `expo-image-picker`, soportado en Expo Go SDK 54).
- `app/post/[id].tsx`: detalle del post + comentarios + input para comentar.
- `lib/format.ts`: agregar `tiempoRelativo(iso)` ("hace 2h") y `matchDateTime(fecha,hora)`.

## 7. Simplicidad (no romper la facilidad de uso)
Un solo feed global, 3 filtros, like de un toque, comentar abre el post.
Sin configuración. El muro nunca se ve vacío (seed + auto-recaps).

## 8. Backend futuro
Agregar tablas `posts` y `comentarios` (con RLS análoga a las existentes) a
`supabase/schema.sql`, espejando el modelo local.

## Alternativas descartadas
- Muro por-partido (fragmenta demasiado) → feed global.
- Comentarios inline en la tarjeta (satura el feed) → detalle de post.

## Verificación
`npx tsc --noEmit` limpio + `npx expo export --platform android` sin errores.
Prueba manual en iPhone (Expo Go + túnel): abrir muro, postear, dar like,
comentar, ver auto-recap de un partido pasado, y chatear sin crash.
```
