-- ============================================================================
-- Falta Uno · Esquema de base de datos para Supabase
-- ----------------------------------------------------------------------------
-- Ejecutá este script en el SQL Editor de tu proyecto Supabase
-- (Dashboard → SQL Editor → New query → pegar → Run).
-- ============================================================================

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
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

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

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.partidos enable row level security;
alter table public.partido_jugadores enable row level security;
alter table public.pagos enable row level security;
alter table public.mensajes enable row level security;

-- Perfiles: todos pueden leer; cada quien edita el suyo
create policy "perfiles_lectura" on public.profiles for select using (true);
create policy "perfiles_propio_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "perfiles_propio_update" on public.profiles for update using (auth.uid() = id);

-- Partidos: lectura pública; el organizador gestiona los suyos
create policy "partidos_lectura" on public.partidos for select using (true);
create policy "partidos_insert" on public.partidos for insert with check (auth.uid() = organizador_id);
create policy "partidos_update" on public.partidos for update using (auth.uid() = organizador_id);
create policy "partidos_delete" on public.partidos for delete using (auth.uid() = organizador_id);

-- Inscripciones: lectura pública; cada jugador gestiona la suya
create policy "inscripciones_lectura" on public.partido_jugadores for select using (true);
create policy "inscripciones_insert" on public.partido_jugadores for insert with check (auth.uid() = jugador_id);
create policy "inscripciones_delete" on public.partido_jugadores for delete using (auth.uid() = jugador_id);

-- Pagos: cada jugador ve y crea solo los suyos
create policy "pagos_lectura" on public.pagos for select using (auth.uid() = jugador_id);
create policy "pagos_insert" on public.pagos for insert with check (auth.uid() = jugador_id);

-- Mensajes: lectura pública del chat; cada quien publica como sí mismo
create policy "mensajes_lectura" on public.mensajes for select using (true);
create policy "mensajes_insert" on public.mensajes for insert with check (auth.uid() = autor_id);

-- Realtime: habilitar el chat en vivo
alter publication supabase_realtime add table public.mensajes;
