-- Advisors de performance: auth_rls_initplan + multiple_permissive_policies.
--
-- Dos transformaciones, ambas PRESERVAN EL ACCESO (verificado con sonda pre/post):
--  1) initplan: auth.uid() -> (select auth.uid()), auth.role() -> (select auth.role()),
--     is_admin() -> (select is_admin()). Postgres las evalúa una sola vez por query (no por fila).
--  2) consolidación: donde había 2 policies permisivas para el mismo comando (típicamente
--     admin_lee_* con is_admin() + la del dueño/usuario), se fusionan en UNA con OR
--     (las permisivas se combinan con OR igual, así que es equivalente).
--
-- En cancha_disponibilidad y datos_desembolso la policy del dueño era FOR ALL (pisaba el SELECT);
-- se separa en INSERT/UPDATE/DELETE y el SELECT se fusiona aparte.

-- ── bloqueos ─────────────────────────────────────────────────────────────────
drop policy if exists bloqueos_delete on public.bloqueos;
drop policy if exists bloqueos_insert on public.bloqueos;
drop policy if exists bloqueos_lectura on public.bloqueos;
create policy bloqueos_lectura on public.bloqueos for select using ((select auth.uid()) = usuario_id);
create policy bloqueos_insert on public.bloqueos for insert with check ((select auth.uid()) = usuario_id);
create policy bloqueos_delete on public.bloqueos for delete using ((select auth.uid()) = usuario_id);

-- ── calificaciones ───────────────────────────────────────────────────────────
drop policy if exists calificaciones_insert on public.calificaciones;
drop policy if exists calificaciones_lectura on public.calificaciones;
create policy calificaciones_lectura on public.calificaciones for select using ((select auth.role()) = 'authenticated');
create policy calificaciones_insert on public.calificaciones for insert with check (
  ((select auth.uid()) = autor_id)
  and (exists (select 1 from public.partido_jugadores pj
              where pj.partido_id = calificaciones.partido_id and pj.jugador_id = (select auth.uid()))));

-- ── cancha_disponibilidad (dueño era FOR ALL -> separo escritura; SELECT queda público) ──
drop policy if exists disp_escritura on public.cancha_disponibilidad;
drop policy if exists disp_lectura on public.cancha_disponibilidad;
create policy disp_lectura on public.cancha_disponibilidad for select using (true);
create policy disp_insert on public.cancha_disponibilidad for insert with check (
  exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = (select auth.uid())));
create policy disp_update on public.cancha_disponibilidad for update using (
  exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = (select auth.uid())))
  with check (
  exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = (select auth.uid())));
create policy disp_delete on public.cancha_disponibilidad for delete using (
  exists (select 1 from public.canchas c where c.id = cancha_disponibilidad.cancha_id and c.owner_id = (select auth.uid())));

-- ── canchas ──────────────────────────────────────────────────────────────────
drop policy if exists canchas_delete on public.canchas;
drop policy if exists canchas_insert on public.canchas;
drop policy if exists canchas_lectura on public.canchas;
drop policy if exists canchas_update on public.canchas;
create policy canchas_lectura on public.canchas for select using (true);
create policy canchas_insert on public.canchas for insert with check ((select auth.uid()) = owner_id);
create policy canchas_update on public.canchas for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy canchas_delete on public.canchas for delete using ((select auth.uid()) = owner_id);

-- ── comentarios ──────────────────────────────────────────────────────────────
drop policy if exists comentarios_insert on public.comentarios;
drop policy if exists comentarios_lectura on public.comentarios;
create policy comentarios_lectura on public.comentarios for select using (true);
create policy comentarios_insert on public.comentarios for insert with check ((select auth.uid()) = autor_id);

-- ── datos_desembolso (dueño era FOR ALL + admin SELECT -> separo escritura, fusiono SELECT) ──
drop policy if exists desembolso_dueno on public.datos_desembolso;
drop policy if exists desembolso_admin_lee on public.datos_desembolso;
create policy desembolso_lectura on public.datos_desembolso for select using (
  ((select auth.uid()) = owner_id) or (select is_admin()));
create policy desembolso_insert on public.datos_desembolso for insert with check ((select auth.uid()) = owner_id);
create policy desembolso_update on public.datos_desembolso for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy desembolso_delete on public.datos_desembolso for delete using ((select auth.uid()) = owner_id);

-- ── membresias_cancha (fusión SELECT admin+dueño) ────────────────────────────
drop policy if exists admin_lee_membresias on public.membresias_cancha;
drop policy if exists membresias_lectura on public.membresias_cancha;
create policy membresias_lectura on public.membresias_cancha for select using (
  (exists (select 1 from public.canchas c where c.id = membresias_cancha.cancha_id and c.owner_id = (select auth.uid())))
  or (select is_admin()));

-- ── mensajes ─────────────────────────────────────────────────────────────────
drop policy if exists mensajes_insert on public.mensajes;
drop policy if exists mensajes_lectura on public.mensajes;
create policy mensajes_lectura on public.mensajes for select using (
  (exists (select 1 from public.partido_jugadores pj where pj.partido_id = mensajes.partido_id and pj.jugador_id = (select auth.uid())))
  or (exists (select 1 from public.partidos p where p.id = mensajes.partido_id and p.organizador_id = (select auth.uid()))));
create policy mensajes_insert on public.mensajes for insert with check ((select auth.uid()) = autor_id);

-- ── movimientos_cancha (fusión SELECT admin+dueño) ───────────────────────────
drop policy if exists admin_lee_movimientos on public.movimientos_cancha;
drop policy if exists movimientos_lectura on public.movimientos_cancha;
create policy movimientos_lectura on public.movimientos_cancha for select using (
  (exists (select 1 from public.canchas c where c.id = movimientos_cancha.cancha_id and c.owner_id = (select auth.uid())))
  or (select is_admin()));

-- ── pagos (fusión SELECT admin+jugador) ──────────────────────────────────────
drop policy if exists pagos_insert on public.pagos;
drop policy if exists admin_lee_pagos on public.pagos;
drop policy if exists pagos_lectura on public.pagos;
create policy pagos_lectura on public.pagos for select using (
  ((select auth.uid()) = jugador_id) or (select is_admin()));
create policy pagos_insert on public.pagos for insert with check (
  ((select auth.uid()) = jugador_id) and (estado = 'pendiente'));

-- ── partido_jugadores ────────────────────────────────────────────────────────
drop policy if exists inscripciones_delete on public.partido_jugadores;
drop policy if exists inscripciones_insert on public.partido_jugadores;
drop policy if exists inscripciones_lectura on public.partido_jugadores;
create policy inscripciones_lectura on public.partido_jugadores for select using ((select auth.role()) = 'authenticated');
create policy inscripciones_insert on public.partido_jugadores for insert with check ((select auth.uid()) = jugador_id);
create policy inscripciones_delete on public.partido_jugadores for delete using ((select auth.uid()) = jugador_id);

-- ── partidos ─────────────────────────────────────────────────────────────────
drop policy if exists partidos_delete on public.partidos;
drop policy if exists partidos_insert on public.partidos;
drop policy if exists partidos_lectura on public.partidos;
drop policy if exists partidos_update on public.partidos;
create policy partidos_lectura on public.partidos for select using (true);
create policy partidos_insert on public.partidos for insert with check ((select auth.uid()) = organizador_id);
create policy partidos_update on public.partidos for update using ((select auth.uid()) = organizador_id);
create policy partidos_delete on public.partidos for delete using ((select auth.uid()) = organizador_id);

-- ── post_likes ───────────────────────────────────────────────────────────────
drop policy if exists likes_delete on public.post_likes;
drop policy if exists likes_insert on public.post_likes;
drop policy if exists likes_lectura on public.post_likes;
create policy likes_lectura on public.post_likes for select using ((select auth.role()) = 'authenticated');
create policy likes_insert on public.post_likes for insert with check ((select auth.uid()) = user_id);
create policy likes_delete on public.post_likes for delete using ((select auth.uid()) = user_id);

-- ── posts ────────────────────────────────────────────────────────────────────
drop policy if exists posts_delete on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_lectura on public.posts;
drop policy if exists posts_update on public.posts;
create policy posts_lectura on public.posts for select using (true);
create policy posts_insert on public.posts for insert with check ((select auth.uid()) = autor_id);
create policy posts_update on public.posts for update using ((select auth.uid()) = autor_id) with check ((select auth.uid()) = autor_id);
create policy posts_delete on public.posts for delete using ((select auth.uid()) = autor_id);

-- ── profiles (fusión SELECT admin+propio) ────────────────────────────────────
drop policy if exists perfiles_propio_insert on public.profiles;
drop policy if exists admin_lee_profiles on public.profiles;
drop policy if exists perfiles_lectura_propia on public.profiles;
drop policy if exists perfiles_propio_update on public.profiles;
create policy perfiles_lectura_propia on public.profiles for select using (
  ((select auth.uid()) = id) or (select is_admin()));
create policy perfiles_propio_insert on public.profiles for insert with check ((select auth.uid()) = id);
create policy perfiles_propio_update on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ── reportes ─────────────────────────────────────────────────────────────────
drop policy if exists reportes_insert on public.reportes;
drop policy if exists admin_lee_reportes on public.reportes;
create policy admin_lee_reportes on public.reportes for select using ((select is_admin()));
create policy reportes_insert on public.reportes for insert with check ((select auth.uid()) = reportado_por);

-- ── reservas (fusión SELECT admin+jugador+dueño) ─────────────────────────────
drop policy if exists reservas_insert on public.reservas;
drop policy if exists admin_lee_reservas on public.reservas;
drop policy if exists reservas_lectura on public.reservas;
drop policy if exists reservas_update_dueno on public.reservas;
create policy reservas_lectura on public.reservas for select using (
  ((select auth.uid()) = jugador_id)
  or (exists (select 1 from public.canchas c where c.id = reservas.cancha_id and c.owner_id = (select auth.uid())))
  or (select is_admin()));
create policy reservas_insert on public.reservas for insert with check (
  ((select auth.uid()) = jugador_id) and (estado = any (array['pendiente'::text, 'confirmada'::text])));
create policy reservas_update_dueno on public.reservas for update using (
  ((select auth.uid()) = jugador_id)
  or (exists (select 1 from public.canchas c where c.id = reservas.cancha_id and c.owner_id = (select auth.uid()))));

-- ── retiros (fusión SELECT admin+dueño) ──────────────────────────────────────
drop policy if exists retiros_insert on public.retiros;
drop policy if exists admin_lee_retiros on public.retiros;
drop policy if exists retiros_lectura on public.retiros;
create policy retiros_lectura on public.retiros for select using (
  (exists (select 1 from public.canchas c where c.id = retiros.cancha_id and c.owner_id = (select auth.uid())))
  or (select is_admin()));
create policy retiros_insert on public.retiros for insert with check (
  (estado = 'solicitado')
  and (exists (select 1 from public.canchas c where c.id = retiros.cancha_id and c.owner_id = (select auth.uid()))));
