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
-- `roles` se crea acá porque el grant de abajo lo referencia y el schema corre de
-- arriba a abajo (la sección de canchas que también la crea está más abajo).
alter table public.profiles add column if not exists roles text[] not null default '{jugador}';
revoke update on public.profiles from anon, authenticated;
grant update (nombre, ciudad, posicion, nivel, celular, avatar_url, politica_version, politica_aceptada_at, roles)
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

-- ============================================================================
-- MARKETPLACE DE CANCHAS (rol cancha, reservas, saldo, retiros, membresías)
-- Fase 1: perfil de cancha, agenda, reservas (efectivo), ledger de saldo.
-- El dinero online (Mercado Pago) se enciende en Fase 2 desde Edge Functions.
-- ============================================================================

-- Un mismo perfil puede ser jugador y/o dueño de cancha
alter table public.profiles add column if not exists roles text[] not null default '{jugador}';

-- Canchas (venues) publicadas por un dueño
create table if not exists public.canchas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  nombre text not null,
  direccion text not null,
  zona text not null,
  ciudad text not null default 'Pereira',
  lat double precision,
  lng double precision,
  descripcion text,
  telefono text,
  formatos text[] not null default '{}',            -- ['5v5','7v7','11v11']
  amenidades jsonb not null default '{}'::jsonb,     -- { duchas, banos, tienda, ... }
  fotos text[] not null default '{}',
  foto_portada text,
  estado text not null default 'activa' check (estado in ('activa','pausada')),
  comision_pct numeric not null default 0.10,
  mp_account_ref text,                              -- cuenta MP para payout (Fase 2)
  legal_version text,                               -- prueba de aceptación mandato/T&C
  legal_aceptado_at timestamptz,
  created_at timestamptz not null default now()
);

-- Plantilla de horarios recurrentes → de acá se derivan los slots reservables
create table if not exists public.cancha_disponibilidad (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.canchas (id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),  -- 0=domingo
  hora_apertura time not null,
  hora_cierre time not null,
  duracion_min int not null default 60,
  precio int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists disp_cancha_idx on public.cancha_disponibilidad (cancha_id, dia_semana);

-- Reservas de un slot por un jugador
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.canchas (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  precio int not null,
  comision int not null default 0,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','cancelada','completada')),
  medio text not null default 'efectivo',           -- 'efectivo' | 'online'
  pago_id uuid,
  partido_id uuid references public.partidos (id) on delete set null,  -- partido abierto
  referencia text not null,
  created_at timestamptz not null default now(),
  unique (cancha_id, fecha, hora_inicio)             -- ANTI-DOBLE-RESERVA
);
create index if not exists reservas_cancha_fecha_idx on public.reservas (cancha_id, fecha);
create index if not exists reservas_jugador_idx on public.reservas (jugador_id, created_at desc);

-- Ledger: fuente de verdad del saldo de cada cancha (solo lo escribe el servidor)
create table if not exists public.movimientos_cancha (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.canchas (id) on delete cascade,
  tipo text not null check (tipo in ('ingreso_reserva','comision','retiro','ajuste')),
  monto int not null,                                -- con signo (+ ingreso, - comision/retiro)
  reserva_id uuid references public.reservas (id) on delete set null,
  retiro_id uuid,
  descripcion text,
  created_at timestamptz not null default now()
);
create index if not exists mov_cancha_idx on public.movimientos_cancha (cancha_id, created_at desc);

-- Solicitudes de desembolso
create table if not exists public.retiros (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.canchas (id) on delete cascade,
  monto int not null check (monto > 0),
  estado text not null default 'solicitado'
    check (estado in ('solicitado','procesando','pagado','rechazado')),
  mp_payout_ref text,
  motivo_rechazo text,
  solicitado_at timestamptz not null default now(),
  procesado_at timestamptz
);
create index if not exists retiros_cancha_idx on public.retiros (cancha_id, solicitado_at desc);

-- Membresías (activa ⇒ comisión 0). El cobro real se activa en Fase 2.
create table if not exists public.membresias_cancha (
  id uuid primary key default gen_random_uuid(),
  cancha_id uuid not null references public.canchas (id) on delete cascade,
  plan text not null default 'mensual',
  estado text not null default 'activa' check (estado in ('activa','vencida','cancelada')),
  vigente_hasta date,
  mp_preapproval_ref text,
  created_at timestamptz not null default now()
);
create index if not exists memb_cancha_idx on public.membresias_cancha (cancha_id);

-- ----------------------------------------------------------------------------
-- RLS del marketplace
-- ----------------------------------------------------------------------------
alter table public.canchas enable row level security;
alter table public.cancha_disponibilidad enable row level security;
alter table public.reservas enable row level security;
alter table public.movimientos_cancha enable row level security;
alter table public.retiros enable row level security;
alter table public.membresias_cancha enable row level security;

-- Canchas: lectura pública (para que los jugadores las vean); el dueño gestiona la suya
drop policy if exists "canchas_lectura" on public.canchas;
drop policy if exists "canchas_insert" on public.canchas;
drop policy if exists "canchas_update" on public.canchas;
drop policy if exists "canchas_delete" on public.canchas;
create policy "canchas_lectura" on public.canchas for select using (true);
create policy "canchas_insert" on public.canchas for insert with check (auth.uid() = owner_id);
create policy "canchas_update" on public.canchas for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "canchas_delete" on public.canchas for delete using (auth.uid() = owner_id);

-- Disponibilidad: lectura pública; escritura solo del dueño de la cancha
drop policy if exists "disp_lectura" on public.cancha_disponibilidad;
drop policy if exists "disp_escritura" on public.cancha_disponibilidad;
create policy "disp_lectura" on public.cancha_disponibilidad for select using (true);
create policy "disp_escritura" on public.cancha_disponibilidad for all
  using (exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = auth.uid()));

-- Reservas: las lee el jugador dueño de la reserva o el dueño de la cancha;
-- el jugador solo puede crearlas a su nombre. El paso a 'confirmada' con pago
-- online lo hace el webhook (service_role, que salta RLS).
drop policy if exists "reservas_lectura" on public.reservas;
drop policy if exists "reservas_insert" on public.reservas;
drop policy if exists "reservas_update_dueno" on public.reservas;
create policy "reservas_lectura" on public.reservas for select using (
  auth.uid() = jugador_id
  or exists (select 1 from public.canchas c where c.id = reservas.cancha_id and c.owner_id = auth.uid())
);
create policy "reservas_insert" on public.reservas for insert with check (
  auth.uid() = jugador_id and estado in ('pendiente','confirmada')
);
-- El dueño de la cancha puede cancelar/completar reservas de su cancha
create policy "reservas_update_dueno" on public.reservas for update using (
  auth.uid() = jugador_id
  or exists (select 1 from public.canchas c where c.id = reservas.cancha_id and c.owner_id = auth.uid())
);

-- Ledger: solo el dueño LEE sus movimientos. Nadie los inserta/edita desde el
-- cliente (sin policy de insert ⇒ RLS lo niega): los escribe solo el servidor.
drop policy if exists "movimientos_lectura" on public.movimientos_cancha;
create policy "movimientos_lectura" on public.movimientos_cancha for select using (
  exists (select 1 from public.canchas c where c.id = movimientos_cancha.cancha_id and c.owner_id = auth.uid())
);

-- Retiros: el dueño ve y solicita los suyos (estado inicial 'solicitado'); el
-- paso a 'pagado'/'rechazado' lo hace el servidor (Edge Function).
drop policy if exists "retiros_lectura" on public.retiros;
drop policy if exists "retiros_insert" on public.retiros;
create policy "retiros_lectura" on public.retiros for select using (
  exists (select 1 from public.canchas c where c.id = retiros.cancha_id and c.owner_id = auth.uid())
);
create policy "retiros_insert" on public.retiros for insert with check (
  estado = 'solicitado'
  and exists (select 1 from public.canchas c where c.id = retiros.cancha_id and c.owner_id = auth.uid())
);

-- Membresías: solo el dueño las lee; las escribe el servidor (webhook de MP).
drop policy if exists "membresias_lectura" on public.membresias_cancha;
create policy "membresias_lectura" on public.membresias_cancha for select using (
  exists (select 1 from public.canchas c where c.id = membresias_cancha.cancha_id and c.owner_id = auth.uid())
);

-- Saldo de una cancha (suma del ledger). Devuelve 0 si no sos el dueño.
create or replace function public.saldo_cancha(p_cancha uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(m.monto), 0)::int
  from public.movimientos_cancha m
  where m.cancha_id = p_cancha
    and exists (select 1 from public.canchas c where c.id = p_cancha and c.owner_id = auth.uid());
$$;
grant execute on function public.saldo_cancha(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- STORAGE: bucket público para fotos de canchas (subida solo autenticado)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('canchas', 'canchas', true)
  on conflict (id) do nothing;
drop policy if exists "canchas_fotos_lectura" on storage.objects;
drop policy if exists "canchas_fotos_subida" on storage.objects;
create policy "canchas_fotos_lectura" on storage.objects for select using (bucket_id = 'canchas');
create policy "canchas_fotos_subida" on storage.objects for insert to authenticated with check (bucket_id = 'canchas');

-- ============================================================================
-- PLATAFORMA MADRE (ADMIN) — visibilidad total + control del flujo de plata
-- El primer admin se setea a mano:
--   update public.profiles set roles = array_append(roles,'admin')
--     where email = 'TU_EMAIL';
-- ============================================================================

-- ¿El usuario actual es admin? (security definer: salta RLS al leer profiles,
-- por eso no hay recursión aunque profiles tenga policy que llame a is_admin()).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and 'admin' = any(p.roles)
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Lectura total del admin (se SUMA a las policies existentes; RLS combina con OR).
drop policy if exists "admin_lee_profiles" on public.profiles;
create policy "admin_lee_profiles" on public.profiles for select using (public.is_admin());
drop policy if exists "admin_lee_reservas" on public.reservas;
create policy "admin_lee_reservas" on public.reservas for select using (public.is_admin());
drop policy if exists "admin_lee_pagos" on public.pagos;
create policy "admin_lee_pagos" on public.pagos for select using (public.is_admin());
drop policy if exists "admin_lee_retiros" on public.retiros;
create policy "admin_lee_retiros" on public.retiros for select using (public.is_admin());
drop policy if exists "admin_lee_movimientos" on public.movimientos_cancha;
create policy "admin_lee_movimientos" on public.movimientos_cancha for select using (public.is_admin());
drop policy if exists "admin_lee_membresias" on public.membresias_cancha;
create policy "admin_lee_membresias" on public.membresias_cancha for select using (public.is_admin());
drop policy if exists "admin_lee_reportes" on public.reportes;
create policy "admin_lee_reportes" on public.reportes for select using (public.is_admin());

-- Procesar un retiro (desembolso): server-authoritative y atómico. Solo admin.
-- 'pagado' baja el saldo de la cancha con un movimiento 'retiro' en el ledger.
create or replace function public.admin_procesar_retiro(p_retiro uuid, p_estado text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.retiros%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('pagado','rechazado') then raise exception 'Estado inválido'; end if;
  select * into r from public.retiros where id = p_retiro for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if r.estado not in ('solicitado','procesando') then raise exception 'El retiro ya fue procesado'; end if;

  update public.retiros
    set estado = p_estado,
        motivo_rechazo = case when p_estado = 'rechazado' then p_motivo else null end,
        procesado_at = now()
    where id = p_retiro;

  if p_estado = 'pagado' then
    insert into public.movimientos_cancha (cancha_id, tipo, monto, retiro_id, descripcion)
    values (r.cancha_id, 'retiro', -abs(r.monto), r.id, 'Retiro procesado por admin');
  end if;
end $$;
grant execute on function public.admin_procesar_retiro(uuid, text, text) to authenticated;

-- Activar/pausar una cancha (moderación operativa). Solo admin.
create or replace function public.admin_set_estado_cancha(p_cancha uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('activa','pausada') then raise exception 'Estado inválido'; end if;
  update public.canchas set estado = p_estado where id = p_cancha;
end $$;
grant execute on function public.admin_set_estado_cancha(uuid, text) to authenticated;

-- Ajuste manual del saldo de una cancha (crédito/débito con signo). Solo admin.
create or replace function public.admin_ajuste_saldo(p_cancha uuid, p_monto int, p_desc text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  insert into public.movimientos_cancha (cancha_id, tipo, monto, descripcion)
  values (p_cancha, 'ajuste', p_monto, coalesce(p_desc, 'Ajuste manual (admin)'));
end $$;
grant execute on function public.admin_ajuste_saldo(uuid, int, text) to authenticated;

-- ============================================================================
-- DATOS DE DESEMBOLSO de las canchas (una cuenta por dueño). El dueño los carga
-- en su panel de Finanzas; el admin los lee para procesar los retiros.
-- ============================================================================
create table if not exists public.datos_desembolso (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  banco text not null,
  tipo_cuenta text not null check (tipo_cuenta in ('ahorros','corriente','nequi','daviplata')),
  numero text not null,
  titular text not null,
  documento text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.datos_desembolso enable row level security;

-- El dueño hace CRUD SOLO de sus datos; el admin los lee para desembolsar.
drop policy if exists "desembolso_dueno" on public.datos_desembolso;
create policy "desembolso_dueno" on public.datos_desembolso for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "desembolso_admin_lee" on public.datos_desembolso;
create policy "desembolso_admin_lee" on public.datos_desembolso for select using (public.is_admin());
