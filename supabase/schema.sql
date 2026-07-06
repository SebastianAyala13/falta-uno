-- ============================================================================
-- Falta Uno · Esquema de base de datos para Supabase (COMPLETO)
-- ----------------------------------------------------------------------------
-- Ejecutá este script en el SQL Editor de tu proyecto Supabase
-- (Dashboard → SQL Editor → New query → pegar → Run).
--
-- Es IDEMPOTENTE: se puede correr en una base nueva o re-correr sobre una
-- existente sin errores (usa "if not exists" y "drop policy if exists").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLAS
-- ----------------------------------------------------------------------------

-- Perfiles de jugadores (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null,
  ciudad text not null default 'Pereira',
  posicion text not null check (posicion in ('Portero','Defensa','Mediocampista','Delantero')),
  nivel text not null check (nivel in ('Casual','Intermedio','Competitivo')),
  celular text,
  avatar_url text,
  partidos_jugados int not null default 0,
  no_shows int not null default 0,
  rating numeric(2,1) not null default 0,
  politica_version text,
  politica_aceptada_at timestamptz,
  created_at timestamptz not null default now()
);

-- Columnas de consentimiento (para bases ya creadas antes de esta versión)
alter table public.profiles add column if not exists politica_version text;
alter table public.profiles add column if not exists politica_aceptada_at timestamptz;

-- Partidos publicados
create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  organizador_id uuid not null references public.profiles (id) on delete cascade,
  cancha text not null,
  zona text not null,
  fecha date not null,
  hora time not null,
  formato text not null check (formato in ('5v5','7v7','11v11')),
  nivel text not null check (nivel in ('Casual','Intermedio','Competitivo')),
  precio int not null default 0,
  cupos_totales int not null,
  cupos_ocupados int not null default 1,
  descripcion text,
  lat double precision,
  lng double precision,
  foto_url text,
  created_at timestamptz not null default now()
);

-- Columnas extra (por si la tabla "partidos" ya existía de una versión previa)
alter table public.partidos add column if not exists lat double precision;
alter table public.partidos add column if not exists lng double precision;
alter table public.partidos add column if not exists foto_url text;

-- Inscripciones de jugadores a partidos
create table if not exists public.partido_jugadores (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  posicion text not null check (posicion in ('Portero','Defensa','Mediocampista','Delantero')),
  confirmado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partido_id, jugador_id)
);

-- Pagos de cupos (procesamiento real vía pasarela; aquí guardamos el registro)
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  medio text not null check (medio in ('nequi','pse','tarjeta','efectivo','online')),
  monto int not null,
  comision int not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  referencia text not null,
  created_at timestamptz not null default now()
);

-- Medio 'online' (Lemon Squeezy) para bases creadas antes de esta versión
alter table public.pagos drop constraint if exists pagos_medio_check;
alter table public.pagos add constraint pagos_medio_check
  check (medio in ('nequi','pse','tarjeta','efectivo','online'));

-- Idempotencia del webhook de pagos: una referencia = un solo pago
create unique index if not exists pagos_referencia_unica on public.pagos (referencia);

-- Chat por partido
create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  autor_nombre text not null,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists mensajes_partido_idx on public.mensajes (partido_id, created_at);

-- Calificaciones (reputación) tras un partido
create table if not exists public.calificaciones (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  estrellas int not null check (estrellas between 1 and 5),
  organizador_estrellas int not null check (organizador_estrellas between 1 and 5),
  hubo_no_show boolean not null default false,
  comentario text,
  created_at timestamptz not null default now(),
  unique (partido_id, autor_id)
);

-- Muro social: publicaciones
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('recap','encuentro','pregunta')),
  autor_id uuid references public.profiles (id) on delete cascade,
  autor_nombre text not null,
  autor_avatar text,
  texto text not null,
  foto_url text,
  partido_id uuid references public.partidos (id) on delete set null,
  likes uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Muro social: comentarios
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  autor_nombre text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

-- Moderación: reportes de contenido objetable (App Store 1.2 / Google UGC)
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('post','comentario','mensaje')),
  contenido_id text not null,
  autor_id uuid references public.profiles (id) on delete set null,
  reportado_por uuid not null references public.profiles (id) on delete cascade,
  motivo text not null check (motivo in ('spam','acoso','sexual','odio','otro')),
  texto text,
  created_at timestamptz not null default now()
);
create index if not exists reportes_created_idx on public.reportes (created_at desc);

-- Moderación: bloqueos entre usuarios
create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  bloqueado_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (usuario_id, bloqueado_id)
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.partidos enable row level security;
alter table public.partido_jugadores enable row level security;
alter table public.pagos enable row level security;
alter table public.mensajes enable row level security;
alter table public.calificaciones enable row level security;
alter table public.posts enable row level security;
alter table public.comentarios enable row level security;
alter table public.reportes enable row level security;
alter table public.bloqueos enable row level security;

-- Perfiles: cada quien lee/edita SOLO el suyo (email y celular son PII y no se
-- exponen a otros usuarios). Los datos públicos de otros jugadores se leen por
-- la vista `perfiles_publicos`. La reputación (rating/no_shows/partidos_jugados)
-- NO la puede editar el usuario: se restringe con GRANT por columna (más abajo).
drop policy if exists "perfiles_lectura" on public.profiles;
drop policy if exists "perfiles_lectura_propia" on public.profiles;
drop policy if exists "perfiles_propio_insert" on public.profiles;
drop policy if exists "perfiles_propio_update" on public.profiles;
create policy "perfiles_lectura_propia" on public.profiles for select using (auth.uid() = id);
create policy "perfiles_propio_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "perfiles_propio_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Partidos: lectura pública; el organizador gestiona los suyos
drop policy if exists "partidos_lectura" on public.partidos;
drop policy if exists "partidos_insert" on public.partidos;
drop policy if exists "partidos_update" on public.partidos;
drop policy if exists "partidos_delete" on public.partidos;
create policy "partidos_lectura" on public.partidos for select using (true);
create policy "partidos_insert" on public.partidos for insert with check (auth.uid() = organizador_id);
create policy "partidos_update" on public.partidos for update using (auth.uid() = organizador_id);
create policy "partidos_delete" on public.partidos for delete using (auth.uid() = organizador_id);

-- Inscripciones: lectura pública; cada jugador gestiona la suya
drop policy if exists "inscripciones_lectura" on public.partido_jugadores;
drop policy if exists "inscripciones_insert" on public.partido_jugadores;
drop policy if exists "inscripciones_delete" on public.partido_jugadores;
create policy "inscripciones_lectura" on public.partido_jugadores for select using (auth.role() = 'authenticated');
create policy "inscripciones_insert" on public.partido_jugadores for insert with check (auth.uid() = jugador_id);
create policy "inscripciones_delete" on public.partido_jugadores for delete using (auth.uid() = jugador_id);

-- Pagos: cada jugador ve y crea solo los suyos
drop policy if exists "pagos_lectura" on public.pagos;
drop policy if exists "pagos_insert" on public.pagos;
create policy "pagos_lectura" on public.pagos for select using (auth.uid() = jugador_id);
-- El cliente solo puede crear pagos en estado 'pendiente'. El 'aprobado' lo setea
-- únicamente el webhook de la pasarela (service_role, que salta RLS). Así no se
-- puede falsificar un pago aprobado desde el cliente.
create policy "pagos_insert" on public.pagos for insert with check (auth.uid() = jugador_id and estado = 'pendiente');

-- Mensajes: SOLO los participantes del partido (o el organizador) leen el chat.
-- Evita que cualquiera con la key pública raspe nombres, horas y lugares de encuentro.
drop policy if exists "mensajes_lectura" on public.mensajes;
drop policy if exists "mensajes_insert" on public.mensajes;
create policy "mensajes_lectura" on public.mensajes for select using (
  exists (select 1 from public.partido_jugadores pj where pj.partido_id = mensajes.partido_id and pj.jugador_id = auth.uid())
  or exists (select 1 from public.partidos p where p.id = mensajes.partido_id and p.organizador_id = auth.uid())
);
create policy "mensajes_insert" on public.mensajes for insert with check (auth.uid() = autor_id);

-- Calificaciones: lectura solo autenticados; solo calificás partidos que jugaste.
drop policy if exists "calificaciones_lectura" on public.calificaciones;
drop policy if exists "calificaciones_insert" on public.calificaciones;
create policy "calificaciones_lectura" on public.calificaciones for select using (auth.role() = 'authenticated');
create policy "calificaciones_insert" on public.calificaciones for insert with check (
  auth.uid() = autor_id
  and exists (
    select 1 from public.partido_jugadores pj
    where pj.partido_id = calificaciones.partido_id and pj.jugador_id = auth.uid()
  )
);

-- Posts: lectura pública; cada quien crea/edita/borra los suyos
drop policy if exists "posts_lectura" on public.posts;
drop policy if exists "posts_insert" on public.posts;
drop policy if exists "posts_update" on public.posts;
drop policy if exists "posts_delete" on public.posts;
create policy "posts_lectura" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = autor_id);
-- Solo el autor edita/borra su post. Los "me gusta" van por la tabla post_likes
-- (así nadie puede reescribir el post ajeno ni forjar likes de otros).
create policy "posts_update" on public.posts for update using (auth.uid() = autor_id) with check (auth.uid() = autor_id);
create policy "posts_delete" on public.posts for delete using (auth.uid() = autor_id);

-- Comentarios: lectura pública; cada quien publica como sí mismo
drop policy if exists "comentarios_lectura" on public.comentarios;
drop policy if exists "comentarios_insert" on public.comentarios;
create policy "comentarios_lectura" on public.comentarios for select using (true);
create policy "comentarios_insert" on public.comentarios for insert with check (auth.uid() = autor_id);

-- Reportes: cualquier usuario autenticado puede reportar; solo el equipo (service_role) lee
drop policy if exists "reportes_insert" on public.reportes;
create policy "reportes_insert" on public.reportes for insert with check (auth.uid() = reportado_por);

-- Bloqueos: cada quien gestiona los suyos
drop policy if exists "bloqueos_lectura" on public.bloqueos;
drop policy if exists "bloqueos_insert" on public.bloqueos;
drop policy if exists "bloqueos_delete" on public.bloqueos;
create policy "bloqueos_lectura" on public.bloqueos for select using (auth.uid() = usuario_id);
create policy "bloqueos_insert" on public.bloqueos for insert with check (auth.uid() = usuario_id);
create policy "bloqueos_delete" on public.bloqueos for delete using (auth.uid() = usuario_id);

-- ----------------------------------------------------------------------------
-- ENDURECIMIENTO / HARDENING (auditoría de seguridad)
-- ----------------------------------------------------------------------------

-- Vista pública con SOLO columnas seguras (para ver otros jugadores sin exponer
-- email/celular). El resto de la fila queda protegido por RLS (dueño only).
create or replace view public.perfiles_publicos as
  select id, nombre, avatar_url, posicion, nivel, rating from public.profiles;
grant select on public.perfiles_publicos to anon, authenticated;

-- El usuario NO puede editar su reputación: solo estas columnas son actualizables.
revoke update on public.profiles from anon, authenticated;
grant update (nombre, ciudad, posicion, nivel, celular, avatar_url, politica_version, politica_aceptada_at)
  on public.profiles to authenticated;

-- "Me gusta" del muro en su propia tabla (evita reescribir el post ajeno / forjar likes)
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "likes_lectura" on public.post_likes;
drop policy if exists "likes_insert" on public.post_likes;
drop policy if exists "likes_delete" on public.post_likes;
create policy "likes_lectura" on public.post_likes for select using (auth.role() = 'authenticated');
create policy "likes_insert" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on public.post_likes for delete using (auth.uid() = user_id);

-- Anti-impersonación: el nombre/avatar del autor se toma del perfil real, no de
-- lo que mande el cliente (evita publicar como "Andrés" u otro jugador).
create or replace function public.fn_set_autor_datos()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select nombre, avatar_url into p from public.profiles where id = new.autor_id;
  if p.nombre is not null then
    new.autor_nombre := p.nombre;
    if tg_table_name = 'posts' then
      new.autor_avatar := p.avatar_url;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_autor_mensajes on public.mensajes;
create trigger trg_autor_mensajes before insert on public.mensajes for each row execute function public.fn_set_autor_datos();
drop trigger if exists trg_autor_posts on public.posts;
create trigger trg_autor_posts before insert on public.posts for each row execute function public.fn_set_autor_datos();
drop trigger if exists trg_autor_comentarios on public.comentarios;
create trigger trg_autor_comentarios before insert on public.comentarios for each row execute function public.fn_set_autor_datos();

-- Cupos derivados en el servidor: la inscripción sincroniza cupos_ocupados de
-- forma atómica y bloquea unirse a un partido lleno (integridad + anti-race).
create or replace function public.fn_sync_cupos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform 1 from public.partidos where id = new.partido_id and cupos_ocupados >= cupos_totales;
    if found then
      raise exception 'El partido ya está lleno';
    end if;
    update public.partidos set cupos_ocupados = cupos_ocupados + 1 where id = new.partido_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.partidos set cupos_ocupados = greatest(0, cupos_ocupados - 1) where id = old.partido_id;
    return old;
  end if;
  return null;
end $$;
drop trigger if exists trg_cupos_ins on public.partido_jugadores;
create trigger trg_cupos_ins after insert on public.partido_jugadores for each row execute function public.fn_sync_cupos();
drop trigger if exists trg_cupos_del on public.partido_jugadores;
create trigger trg_cupos_del after delete on public.partido_jugadores for each row execute function public.fn_sync_cupos();

-- Límites de longitud del contenido generado por usuarios (anti-spam / abuso)
alter table public.mensajes drop constraint if exists mensajes_texto_len;
alter table public.mensajes add constraint mensajes_texto_len check (char_length(texto) <= 500);
alter table public.posts drop constraint if exists posts_texto_len;
alter table public.posts add constraint posts_texto_len check (char_length(texto) <= 1000);
alter table public.comentarios drop constraint if exists comentarios_texto_len;
alter table public.comentarios add constraint comentarios_texto_len check (char_length(texto) <= 500);

-- ----------------------------------------------------------------------------
-- REALTIME (chat en vivo) — se agrega solo si no estaba ya en la publicación
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mensajes'
  ) then
    execute 'alter publication supabase_realtime add table public.mensajes';
  end if;
end $$;

-- Muro en vivo: posts y comentarios a la publicación de realtime
do $$
declare t text;
begin
  foreach t in array array['posts','comentarios'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
