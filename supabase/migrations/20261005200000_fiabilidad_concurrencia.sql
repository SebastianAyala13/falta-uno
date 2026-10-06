-- Transacciones por partido/cancha, consultas acotadas y autoridad del servidor.
-- Aplicar antes de publicar el cliente y las Edge Functions que usan estas RPC.
begin;

create extension if not exists btree_gist with schema extensions;

-- Un UPDATE condicional vuelve a evaluar la capacidad después de esperar el lock.
-- El SELECT separado anterior permitía sobreventa con solicitudes simultáneas.
create or replace function public.fn_sync_cupos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.partidos set cupos_ocupados = cupos_ocupados + 1
      where id = new.partido_id and cupos_ocupados < cupos_totales;
    if not found then raise exception 'El partido ya está lleno'; end if;
    return new;
  end if;
  update public.partidos set cupos_ocupados = greatest(1, cupos_ocupados - 1)
    where id = old.partido_id;
  return old;
end $$;

create or replace function public.inscribirse_partido(
  p_partido uuid, p_medio text, p_referencia text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  partido public.partidos%rowtype;
  pago public.pagos%rowtype;
  perfil public.profiles%rowtype;
  comision integer;
begin
  if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  select * into perfil from public.profiles where id = uid;
  if not found or perfil.suspendido then raise exception 'Perfil no disponible'; end if;
  if p_medio not in ('efectivo', 'online') or p_medio is null then
    raise exception 'Medio de pago inválido';
  end if;
  if p_referencia is null or char_length(p_referencia) not between 6 and 100 then
    raise exception 'Referencia inválida';
  end if;
  select * into partido from public.partidos where id = p_partido for update;
  if not found then raise exception 'Partido no encontrado'; end if;
  if partido.organizador_id = uid then raise exception 'Ya sos el organizador'; end if;

  -- Reintentos (también desde varios dispositivos) devuelven el mismo pago.
  if exists (select 1 from public.partido_jugadores where partido_id = p_partido and jugador_id = uid) then
    select * into pago from public.pagos where partido_id = p_partido and jugador_id = uid
      and estado <> 'rechazado' order by created_at desc, id desc limit 1;
    if found then
      if pago.medio <> p_medio then raise exception 'Ya tenés una inscripción con otro medio de pago'; end if;
      return jsonb_build_object('pago', to_jsonb(pago), 'cupos_ocupados', partido.cupos_ocupados);
    end if;
  end if;
  if partido.fecha + partido.hora <= now() at time zone 'America/Bogota' then
    raise exception 'El partido ya comenzó';
  end if;
  if partido.precio < 0 then raise exception 'Precio inválido'; end if;
  comision := case when p_medio = 'online' then round(partido.precio * 0.08)::integer else 0 end;

  insert into public.partido_jugadores(partido_id, jugador_id, posicion, confirmado)
    values(p_partido, uid, perfil.posicion, false) on conflict (partido_id, jugador_id) do nothing;
  insert into public.pagos(partido_id, jugador_id, medio, monto, comision, estado, referencia)
    values(p_partido, uid, p_medio, partido.precio + comision, comision, 'pendiente', p_referencia)
    returning * into pago;
  select cupos_ocupados into partido.cupos_ocupados from public.partidos where id = p_partido;
  return jsonb_build_object('pago', to_jsonb(pago), 'cupos_ocupados', partido.cupos_ocupados);
end $$;
revoke all on function public.inscribirse_partido(uuid,text,text) from public, anon;
grant execute on function public.inscribirse_partido(uuid,text,text) to authenticated;

-- El cliente ya no puede crear pagos e inscripciones por separado.
revoke insert on public.pagos, public.partido_jugadores from anon, authenticated;

-- Una reserva cancelada libera el horario, y horarios distintos tampoco pueden
-- solaparse. Si existen solapamientos previos, esta migración falla y exige
-- resolverlos explícitamente: no cancela reservas ni borra datos por su cuenta.
alter table public.reservas drop constraint reservas_cancha_id_fecha_hora_inicio_key;
alter table public.reservas add constraint reservas_intervalo_valido check (hora_fin > hora_inicio);
alter table public.reservas add constraint reservas_sin_solapamiento
  exclude using gist (cancha_id with =, tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') with &&)
  where (estado <> 'cancelada');
create unique index reservas_referencia_unica on public.reservas(referencia);
alter table public.cancha_disponibilidad add constraint disponibilidad_valida
  check (duracion_min > 0 and hora_cierre > hora_apertura and precio >= 0);

create or replace function public.fn_validar_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cancha public.canchas%rowtype;
  franja public.cancha_disponibilidad%rowtype;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'UPDATE' then
    -- Los clientes únicamente cancelan; nunca confirman pagos online.
    if new.estado <> 'cancelada' or old.estado = 'completada'
      or (old.medio = 'online' and old.estado = 'confirmada') then
      raise exception 'Esta reserva requiere gestión del servidor';
    end if;
    return new;
  end if;
  if new.jugador_id is distinct from auth.uid() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.profiles where id = auth.uid() and suspendido) then
    raise exception 'Cuenta suspendida';
  end if;
  select * into cancha from public.canchas where id = new.cancha_id for share;
  if not found or cancha.estado <> 'activa' then raise exception 'Cancha no disponible'; end if;
  if new.fecha + new.hora_inicio <= now() at time zone 'America/Bogota' then
    raise exception 'Ese horario ya pasó';
  end if;
  if new.medio not in ('efectivo','online') then raise exception 'Medio inválido'; end if;
  select * into franja from public.cancha_disponibilidad d
    where d.cancha_id = new.cancha_id and d.activo
      and d.dia_semana = extract(dow from new.fecha)
      and new.hora_inicio >= d.hora_apertura and new.hora_fin <= d.hora_cierre
      and extract(epoch from (new.hora_fin - new.hora_inicio)) = d.duracion_min * 60
      and mod(extract(epoch from (new.hora_inicio - d.hora_apertura))::integer, d.duracion_min * 60) = 0
    order by d.id limit 1;
  if not found then raise exception 'Horario no disponible'; end if;
  new.precio := franja.precio;
  new.comision := case when new.medio = 'efectivo' or exists (
    select 1 from public.membresias_cancha where cancha_id = new.cancha_id and estado = 'activa'
      and (vigente_hasta is null or vigente_hasta >= new.fecha)
  ) then 0 else round(franja.precio * cancha.comision_pct)::integer end;
  new.estado := case when new.medio = 'online' then 'pendiente' else 'confirmada' end;
  return new;
end $$;
create trigger trg_validar_reserva before insert or update on public.reservas
  for each row execute function public.fn_validar_reserva();
revoke update on public.reservas from anon, authenticated;
grant update(estado) on public.reservas to authenticated;
revoke execute on function public.fn_validar_reserva() from public, anon, authenticated;

-- Público sin PII: la RLS de reservas oculta reservas ajenas al jugador.
create or replace function public.horarios_ocupados(p_cancha uuid, p_fecha date)
returns table(hora_inicio time, hora_fin time)
language sql stable security definer set search_path = public as $$
  select r.hora_inicio, r.hora_fin from public.reservas r
  where r.cancha_id = p_cancha and r.fecha = p_fecha and r.estado <> 'cancelada'
    and exists(select 1 from public.canchas c where c.id = p_cancha and c.estado = 'activa');
$$;
revoke all on function public.horarios_ocupados(uuid,date) from public;
grant execute on function public.horarios_ocupados(uuid,date) to anon, authenticated;

-- Reemplazar horarios es una única transacción (un insert inválido revierte el delete).
create or replace function public.reemplazar_disponibilidad(p_cancha uuid, p_franjas jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists(select 1 from public.canchas where id = p_cancha and owner_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  delete from public.cancha_disponibilidad where cancha_id = p_cancha;
  insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio,activo)
    select p_cancha,f.dia_semana,f.hora_apertura,f.hora_cierre,f.duracion_min,f.precio,true
    from jsonb_to_recordset(p_franjas) as f(dia_semana integer,hora_apertura time,hora_cierre time,duracion_min integer,precio integer);
end $$;
revoke all on function public.reemplazar_disponibilidad(uuid,jsonb) from public, anon;
grant execute on function public.reemplazar_disponibilidad(uuid,jsonb) to authenticated;

-- Saldo disponible: agrega en SQL (sin truncamiento de la API) y descuenta
-- solicitudes aún no desembolsadas. El lock por cancha serializa las solicitudes.
create or replace function public.saldo_cancha(p_cancha uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from public.canchas where id = p_cancha and owner_id = auth.uid())
    then (coalesce((select sum(monto) from public.movimientos_cancha where cancha_id = p_cancha),0)
      - coalesce((select sum(monto) from public.retiros where cancha_id = p_cancha and estado in ('solicitado','procesando')),0))::integer
    else 0 end;
$$;
grant execute on function public.saldo_cancha(uuid) to authenticated;
create or replace function public.fn_validar_retiro() returns trigger
language plpgsql security definer set search_path = public as $$
declare disponible bigint;
begin
  perform 1 from public.canchas where id = new.cancha_id for update;
  select coalesce(sum(monto),0) into disponible from public.movimientos_cancha where cancha_id = new.cancha_id;
  disponible := disponible - coalesce((select sum(monto) from public.retiros
    where cancha_id = new.cancha_id and estado in ('solicitado','procesando')),0);
  if new.monto <= 0 or new.monto > disponible then raise exception 'El monto supera tu saldo disponible'; end if;
  return new;
end $$;
create trigger trg_validar_retiro before insert on public.retiros
  for each row execute function public.fn_validar_retiro();
revoke execute on function public.fn_validar_retiro() from public, anon, authenticated;

create or replace function public.admin_procesar_retiro(p_retiro uuid,p_estado text,p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.retiros%rowtype; cancha uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('pagado','rechazado') then raise exception 'Estado inválido'; end if;
  select cancha_id into cancha from public.retiros where id = p_retiro;
  perform 1 from public.canchas where id = cancha for update;
  select * into r from public.retiros where id = p_retiro for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if r.estado not in ('solicitado','procesando') then raise exception 'El retiro ya fue procesado'; end if;
  if p_estado = 'pagado' then
    if r.monto > coalesce((select sum(monto) from public.movimientos_cancha where cancha_id = r.cancha_id),0) then
      raise exception 'Saldo insuficiente';
    end if;
    insert into public.movimientos_cancha(cancha_id,tipo,monto,retiro_id,descripcion)
      values(r.cancha_id,'retiro',-r.monto,r.id,'Retiro procesado por admin');
  end if;
  update public.retiros set estado = p_estado,
    motivo_rechazo = case when p_estado = 'rechazado' then p_motivo else null end,
    procesado_at = now() where id = p_retiro;
end $$;

-- Sólo service_role (webhook verificado). Estado, inscripción y ledger se
-- confirman juntos y los reintentos paralelos no duplican ingresos.
create or replace function public.confirmar_pago_online(p_referencia text,p_monto integer,p_moneda text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pagos%rowtype; r public.reservas%rowtype;
begin
  if p_moneda is distinct from 'COP' or p_monto <= 0 or p_monto is null then
    raise exception 'Moneda o monto inválido';
  end if;
  select * into p from public.pagos where referencia = p_referencia;
  if found then
    -- Mismo orden de locks que inscribirse_partido: partido -> pago.
    perform 1 from public.partidos where id = p.partido_id for update;
    select * into p from public.pagos where id = p.id for update;
    if p.medio <> 'online' or p.monto <> p_monto then raise exception 'Pago no coincide'; end if;
    insert into public.partido_jugadores(partido_id,jugador_id,posicion,confirmado)
      select p.partido_id,p.jugador_id,posicion,true from public.profiles where id = p.jugador_id
      on conflict (partido_id,jugador_id) do update set confirmado = true;
    if p.estado = 'aprobado' then return jsonb_build_object('tipo','partido','duplicado',true); end if;
    if p.estado <> 'pendiente' then raise exception 'Pago no pendiente'; end if;
    update public.pagos set estado = 'aprobado' where id = p.id;
    return jsonb_build_object('tipo','partido','duplicado',false);
  end if;
  select * into r from public.reservas where referencia = p_referencia for update;
  if not found then raise exception 'Referencia desconocida'; end if;
  if r.medio <> 'online' or r.precio <> p_monto then raise exception 'Pago no coincide'; end if;
  if r.estado = 'confirmada' then return jsonb_build_object('tipo','reserva','duplicado',true); end if;
  if r.estado <> 'pendiente' then raise exception 'Reserva no pendiente'; end if;
  insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id,descripcion) values
    (r.cancha_id,'ingreso_reserva',r.precio,r.id,'Ingreso por reserva (Rapyd)'),
    (r.cancha_id,'comision',-abs(r.comision),r.id,'Comisión Falta Uno');
  update public.reservas set estado = 'confirmada' where id = r.id;
  return jsonb_build_object('tipo','reserva','duplicado',false);
end $$;
revoke all on function public.confirmar_pago_online(text,integer,text) from public,anon,authenticated;
grant execute on function public.confirmar_pago_online(text,integer,text) to service_role;

-- La escritura del chat exige la misma membresía que la lectura.
drop policy mensajes_insert on public.mensajes;
create policy mensajes_insert on public.mensajes for insert to authenticated with check (
  autor_id = (select auth.uid()) and (
    exists(select 1 from public.partido_jugadores where partido_id = mensajes.partido_id and jugador_id = (select auth.uid()))
    or exists(select 1 from public.partidos where id = mensajes.partido_id and organizador_id = (select auth.uid()))
  )
);

create index posts_feed_idx on public.posts(created_at desc,id desc);
create index comentarios_post_fecha_idx on public.comentarios(post_id,created_at desc,id desc);
create index partidos_fecha_idx on public.partidos(fecha,hora,id);
create index pagos_jugador_fecha_idx on public.pagos(jugador_id,created_at desc);

-- O(1) read cost per post, rather than re-counting every like/comment for every
-- visitor. Atomic deltas run under the post row lock; counters are not editable
-- by clients. One-time backfill preserves existing reactions.
alter table public.posts add column like_count integer not null default 0;
alter table public.posts add column comment_count integer not null default 0;
update public.posts p set
  like_count = (select count(*) from public.post_likes l where l.post_id = p.id),
  comment_count = (select count(*) from public.comentarios c where c.post_id = p.id);
create or replace function public.fn_contar_interacciones() returns trigger
language plpgsql security definer set search_path = public as $$
declare post uuid; delta integer;
begin
  post := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  delta := case when tg_op = 'DELETE' then -1 else 1 end;
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(0,like_count+delta) where id = post;
  else
    update public.posts set comment_count = greatest(0,comment_count+delta) where id = post;
  end if;
  return null;
end $$;
create trigger trg_contar_likes after insert or delete on public.post_likes
  for each row execute function public.fn_contar_interacciones();
create trigger trg_contar_comentarios after insert or delete on public.comentarios
  for each row execute function public.fn_contar_interacciones();
revoke execute on function public.fn_contar_interacciones() from public,anon,authenticated;
create or replace function public.fn_iniciar_contadores() returns trigger
language plpgsql set search_path = public as $$
begin new.like_count := 0; new.comment_count := 0; new.likes := '{}'; return new; end $$;
create trigger trg_iniciar_contadores before insert on public.posts
  for each row execute function public.fn_iniciar_contadores();
revoke execute on function public.fn_iniciar_contadores() from public,anon,authenticated;
revoke update on public.posts from anon,authenticated;
grant update(texto,foto_url,tipo,partido_id) on public.posts to authenticated;

create or replace function public.set_post_like(p_post uuid,p_like boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if auth.uid() is null or exists(select 1 from public.profiles where id = auth.uid() and suspendido) then
    raise exception 'Necesitás una cuenta activa';
  end if;
  perform 1 from public.posts where id = p_post for update;
  if not found then raise exception 'Publicación no encontrada'; end if;
  if p_like then
    insert into public.post_likes(post_id,user_id) values(p_post,auth.uid()) on conflict do nothing;
  else
    delete from public.post_likes where post_id = p_post and user_id = auth.uid();
  end if;
  select like_count into total from public.posts where id = p_post;
  return jsonb_build_object('liked',p_like,'like_count',total);
end $$;
revoke all on function public.set_post_like(uuid,boolean) from public,anon;
grant execute on function public.set_post_like(uuid,boolean) to authenticated;

-- Contadores en SQL, no listas completas de likes/comentarios en cada teléfono.
-- Usa keyset, con desempate por id; máximo 50 filas por request.
create or replace function public.feed_posts(
  p_antes timestamptz default null,p_antes_id uuid default null,p_limite integer default 30,p_post uuid default null
) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(f.payload order by f.created_at desc,f.id desc),'[]'::jsonb) from (
    select p.id,p.created_at,(to_jsonb(p) - 'likes') || jsonb_build_object(
      'likes',case when exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
        then jsonb_build_array(auth.uid()) else '[]'::jsonb end,
      'like_count',p.like_count,
      'comment_count',p.comment_count
    ) as payload from public.posts p
    where (p_post is null or p.id = p_post)
      and (p_antes is null or (p.created_at,p.id) < (p_antes,p_antes_id))
      and not exists(select 1 from public.bloqueos b where b.usuario_id = auth.uid() and b.bloqueado_id = p.autor_id)
    order by p.created_at desc,p.id desc limit greatest(1,least(coalesce(p_limite,30),50))
  ) f;
$$;
revoke all on function public.feed_posts(timestamptz,uuid,integer,uuid) from public;
grant execute on function public.feed_posts(timestamptz,uuid,integer,uuid) to anon,authenticated;

-- Invitados pueden ver organizadores de partidos, sin enumerar perfiles/PII.
create or replace function public.organizadores_partidos(p_partidos uuid[])
returns table(id uuid,nombre text,avatar_url text,rating numeric)
language sql stable security definer set search_path = public as $$
  select distinct perfil.id,perfil.nombre,perfil.avatar_url,perfil.rating
  from public.partidos partido join public.profiles perfil on perfil.id = partido.organizador_id
  where partido.id = any(p_partidos[1:100]);
$$;
revoke all on function public.organizadores_partidos(uuid[]) from public;
grant execute on function public.organizadores_partidos(uuid[]) to anon,authenticated;

-- Métricas exactas aunque existan más filas que el límite de la Data API.
create or replace function public.admin_metricas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'usuarios',(select count(*) from public.profiles),
    'canchas',(select count(*) from public.canchas),
    'reservas',(select count(*) from public.reservas),
    'pagosAprobados',(select count(*) from public.pagos where estado = 'aprobado'),
    'gmv',(select coalesce(sum(monto),0) from public.pagos where estado = 'aprobado'),
    'retirosPendientes',(select count(*) from public.retiros where estado = 'solicitado'),
    'porCiudad',(select coalesce(jsonb_agg(f order by f.canchas desc),'[]'::jsonb)
      from (select ciudad,count(*) as canchas from public.canchas group by ciudad) f)
  );
end $$;
revoke all on function public.admin_metricas() from public,anon;
grant execute on function public.admin_metricas() to authenticated;

-- Evita fabricar cupos/estadísticas desde clientes modificados.
revoke update on public.partidos from anon,authenticated;
grant update(cancha,zona,fecha,hora,nivel,precio,descripcion,lat,lng,foto_url) on public.partidos to authenticated;
create or replace function public.fn_iniciar_partido() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') then
    new.cupos_ocupados := 1;
    new.cupos_totales := case new.formato when '5v5' then 10 when '7v7' then 14 when '11v11' then 22 end;
    if new.precio < 0 then raise exception 'Precio inválido'; end if;
  end if;
  return new;
end $$;
create trigger trg_iniciar_partido before insert on public.partidos
  for each row execute function public.fn_iniciar_partido();
revoke execute on function public.fn_iniciar_partido() from public,anon,authenticated;

create or replace function public.fn_iniciar_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') then
    new.partidos_jugados := 0; new.no_shows := 0; new.rating := 0; new.suspendido := false;
  end if;
  return new;
end $$;
create trigger trg_iniciar_perfil before insert on public.profiles
  for each row execute function public.fn_iniciar_perfil();
revoke execute on function public.fn_iniciar_perfil() from public,anon,authenticated;

-- La UI y el servidor coinciden: se califica tras terminar, no antes de jugar.
drop policy calificaciones_insert on public.calificaciones;
create policy calificaciones_insert on public.calificaciones for insert to authenticated with check (
  autor_id = (select auth.uid()) and exists (
    select 1 from public.partidos p where p.id = calificaciones.partido_id
      and p.fecha + p.hora + interval '2 hours' <= now() at time zone 'America/Bogota'
      and (p.organizador_id = (select auth.uid()) or exists (
        select 1 from public.partido_jugadores j where j.partido_id = p.id and j.jugador_id = (select auth.uid())
      ))
  )
);

commit;
