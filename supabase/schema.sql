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
  medio text not null check (medio in ('nequi','pse','tarjeta','efectivo')),
  monto int not null,
  comision int not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  referencia text not null,
  created_at timestamptz not null default now()
);

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

-- Perfiles: todos pueden leer; cada quien edita el suyo
drop policy if exists "perfiles_lectura" on public.profiles;
drop policy if exists "perfiles_propio_insert" on public.profiles;
drop policy if exists "perfiles_propio_update" on public.profiles;
create policy "perfiles_lectura" on public.profiles for select using (true);
create policy "perfiles_propio_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "perfiles_propio_update" on public.profiles for update using (auth.uid() = id);

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
create policy "inscripciones_lectura" on public.partido_jugadores for select using (true);
create policy "inscripciones_insert" on public.partido_jugadores for insert with check (auth.uid() = jugador_id);
create policy "inscripciones_delete" on public.partido_jugadores for delete using (auth.uid() = jugador_id);

-- Pagos: cada jugador ve y crea solo los suyos
drop policy if exists "pagos_lectura" on public.pagos;
drop policy if exists "pagos_insert" on public.pagos;
create policy "pagos_lectura" on public.pagos for select using (auth.uid() = jugador_id);
create policy "pagos_insert" on public.pagos for insert with check (auth.uid() = jugador_id);

-- Mensajes: lectura pública del chat; cada quien publica como sí mismo
drop policy if exists "mensajes_lectura" on public.mensajes;
drop policy if exists "mensajes_insert" on public.mensajes;
create policy "mensajes_lectura" on public.mensajes for select using (true);
create policy "mensajes_insert" on public.mensajes for insert with check (auth.uid() = autor_id);

-- Calificaciones: lectura pública (reputación); cada quien crea las suyas
drop policy if exists "calificaciones_lectura" on public.calificaciones;
drop policy if exists "calificaciones_insert" on public.calificaciones;
create policy "calificaciones_lectura" on public.calificaciones for select using (true);
create policy "calificaciones_insert" on public.calificaciones for insert with check (auth.uid() = autor_id);

-- Posts: lectura pública; cada quien crea/edita/borra los suyos
drop policy if exists "posts_lectura" on public.posts;
drop policy if exists "posts_insert" on public.posts;
drop policy if exists "posts_update" on public.posts;
drop policy if exists "posts_delete" on public.posts;
create policy "posts_lectura" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = autor_id);
-- update abierto para permitir likes de cualquier usuario autenticado
create policy "posts_update" on public.posts for update using (auth.role() = 'authenticated');
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
