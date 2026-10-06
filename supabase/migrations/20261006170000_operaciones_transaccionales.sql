begin;
create table public.operaciones_idempotentes(
 usuario_id uuid not null references public.profiles(id) on delete cascade,
 tipo text not null,referencia text not null,payload jsonb not null,resultado jsonb,
 created_at timestamptz not null default now(),primary key(usuario_id,tipo,referencia)
);
alter table public.operaciones_idempotentes enable row level security;
revoke all on public.operaciones_idempotentes from anon,authenticated;
-- Only server functions access this private journal; no client can forge results.
create or replace function public.crear_establecimiento(p_referencia text,p_datos jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); previo public.operaciones_idempotentes%rowtype; c jsonb; h jsonb; cancha public.canchas%rowtype; v_resultado jsonb:='[]';
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and not suspendido) then raise exception 'Necesitás una cuenta activa'; end if;
  if p_referencia is null or char_length(p_referencia) not between 6 and 100 then raise exception 'Referencia inválida'; end if;
  if p_datos is null or jsonb_typeof(p_datos) is distinct from 'object' or jsonb_typeof(p_datos->'canchas') is distinct from 'array' or jsonb_typeof(p_datos->'horarios') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
  if jsonb_array_length(p_datos->'canchas') not between 1 and 20 or jsonb_array_length(p_datos->'horarios') not between 1 and 21 then raise exception 'Cantidad inválida'; end if;
  if nullif(btrim(p_datos->>'direccion'),'') is null or nullif(btrim(p_datos->>'zona'),'') is null or p_datos->>'legal_version' is distinct from '2026-07-07' then raise exception 'Dirección, zona y aceptación legal requeridas'; end if;
  insert into public.operaciones_idempotentes(usuario_id,tipo,referencia,payload) values(uid,'establecimiento',p_referencia,p_datos) on conflict do nothing;
  select * into previo from public.operaciones_idempotentes where usuario_id=uid and tipo='establecimiento' and referencia=p_referencia for update;
  if previo.payload is distinct from p_datos then raise exception 'Referencia reutilizada con otros datos'; end if;
  if previo.resultado is not null then return previo.resultado; end if;
  for c in select value from jsonb_array_elements(p_datos->'canchas') loop
    if nullif(btrim(c->>'nombre'),'') is null or c->>'formato' not in ('5v5','7v7','11v11') or c->>'formato' is null then raise exception 'Cancha inválida'; end if;
    insert into public.canchas(owner_id,nombre,direccion,zona,ciudad,lat,lng,telefono,descripcion,amenidades,formatos,fotos,foto_portada,legal_version,legal_aceptado_at)
      values(uid,btrim(c->>'nombre'),p_datos->>'direccion',p_datos->>'zona',coalesce(nullif(p_datos->>'ciudad',''),'Pereira'),(p_datos->>'lat')::double precision,(p_datos->>'lng')::double precision,
        p_datos->>'telefono',p_datos->>'descripcion',coalesce(p_datos->'amenidades','{}'),array[c->>'formato'],
        array(select jsonb_array_elements_text(coalesce(c->'fotos','[]'))),c->'fotos'->>0,p_datos->>'legal_version',clock_timestamp()) returning * into cancha;
    for h in select value from jsonb_array_elements(p_datos->'horarios') loop
      insert into public.cancha_disponibilidad(cancha_id,dia_semana,hora_apertura,hora_cierre,duracion_min,precio)
        values(cancha.id,(h->>'dia_semana')::integer,(h->>'hora_apertura')::time,(h->>'hora_cierre')::time,(c->>'duracion')::integer,(c->>'precio')::integer);
    end loop;
    v_resultado:=v_resultado||jsonb_build_array(to_jsonb(cancha));
  end loop;
  update public.profiles set roles=array(select distinct unnest(roles||array['cancha'])) where id=uid;
  update public.operaciones_idempotentes set resultado=v_resultado where usuario_id=uid and tipo='establecimiento' and referencia=p_referencia;
  return v_resultado;
end $$;
revoke all on function public.crear_establecimiento(text,jsonb) from public,anon;
grant execute on function public.crear_establecimiento(text,jsonb) to authenticated;

alter table public.reservas add column partido_solicitado jsonb;
create unique index reservas_partido_unico_idx on public.reservas(partido_id) where partido_id is not null;
create or replace function public.fn_crear_partido_reserva(p_reserva uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare r public.reservas%rowtype; c public.canchas%rowtype; formato text; plazas integer; partido uuid;
begin
  select * into r from public.reservas where id=p_reserva for update;
  if r.partido_id is not null then return r.partido_id; end if;
  if r.partido_solicitado is null then return null; end if;
  if r.estado<>'confirmada' then raise exception 'Reserva aún no confirmada'; end if;
  select * into c from public.canchas where id=r.cancha_id;
  formato:=r.partido_solicitado->>'formato';
  if formato is null or formato not in ('5v5','7v7','11v11') or r.partido_solicitado->>'nivel' not in ('Casual','Intermedio','Competitivo') or r.partido_solicitado->>'nivel' is null then raise exception 'Partido inválido'; end if;
  plazas:=case formato when '5v5' then 10 when '7v7' then 14 when '11v11' then 22 end;
  if plazas is null then raise exception 'Formato inválido'; end if;
  insert into public.partidos(organizador_id,cancha,zona,fecha,hora,formato,nivel,precio,cupos_totales,descripcion,lat,lng,foto_url)
    values(r.jugador_id,c.nombre,c.zona,r.fecha,r.hora_inicio,formato,r.partido_solicitado->>'nivel',ceil(r.precio::numeric/plazas)::integer,plazas,
      'Reserva en '||c.nombre,c.lat,c.lng,c.foto_portada) returning id into partido;
  update public.reservas set partido_id=partido where id=r.id;
  return partido;
end $$;
revoke all on function public.fn_crear_partido_reserva(uuid) from public,anon,authenticated;

create or replace function public.reservar_con_partido(p_referencia text,p_cancha uuid,p_fecha date,p_inicio time,p_fin time,p_medio text,p_partido jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); previo public.operaciones_idempotentes%rowtype; payload jsonb; r public.reservas%rowtype;
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and not suspendido) then raise exception 'Necesitás una cuenta activa'; end if;
  if p_referencia is null or char_length(p_referencia) not between 6 and 100 then raise exception 'Referencia inválida'; end if;
  if p_medio is null or p_medio not in ('online','efectivo') then raise exception 'Medio inválido'; end if;
  if p_partido is not null and (jsonb_typeof(p_partido)<>'object' or p_partido->>'nivel' is null or p_partido->>'nivel' not in ('Casual','Intermedio','Competitivo') or p_partido->>'formato' is null or not exists(select 1 from public.canchas where id=p_cancha and p_partido->>'formato'=any(formatos))) then raise exception 'Partido inválido'; end if;
  payload:=jsonb_build_object('cancha',p_cancha,'fecha',p_fecha,'inicio',p_inicio,'fin',p_fin,'medio',p_medio,'partido',p_partido);
  insert into public.operaciones_idempotentes(usuario_id,tipo,referencia,payload) values(uid,'reserva',p_referencia,payload) on conflict do nothing;
  select * into previo from public.operaciones_idempotentes where usuario_id=uid and tipo='reserva' and referencia=p_referencia for update;
  if previo.payload is distinct from payload then raise exception 'Referencia reutilizada con otros datos'; end if;
  if previo.resultado is not null then
    select * into r from public.reservas where id=(previo.resultado->>'id')::uuid;
    if not found then raise exception 'Reserva original no disponible'; end if;
    return to_jsonb(r); -- current payment state, not stale initial receipt
  end if;
  -- Enforce server prices even if this RPC is called through a trusted role.
  if auth.role() is distinct from 'authenticated' then raise exception 'Contexto de jugador requerido'; end if;
  insert into public.reservas(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,medio,estado,referencia,partido_solicitado)
    values(p_cancha,uid,p_fecha,p_inicio,p_fin,0,p_medio,case when p_medio='online' then 'pendiente' else 'confirmada' end,p_referencia,p_partido) returning * into r;
  if p_partido is not null and r.estado='confirmada' then
    perform public.fn_crear_partido_reserva(r.id);
    select * into r from public.reservas where id=r.id;
  end if;
  update public.operaciones_idempotentes set resultado=to_jsonb(r) where usuario_id=uid and tipo='reserva' and referencia=p_referencia;
  return to_jsonb(r);
end $$;
revoke all on function public.reservar_con_partido(text,uuid,date,time,time,text,jsonb) from public,anon;
grant execute on function public.reservar_con_partido(text,uuid,date,time,time,text,jsonb) to authenticated;

-- Direct clients cannot forge a link or intent while legacy cash reservations
-- remain compatible. Only the atomic RPC owns these additional INSERT fields.
revoke insert on public.reservas from anon,authenticated;
grant insert(cancha_id,jugador_id,fecha,hora_inicio,hora_fin,precio,comision,estado,medio,referencia) on public.reservas to authenticated;
create or replace function public.fn_publicar_reserva_confirmada() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.estado='confirmada' and old.estado='pendiente' and new.partido_solicitado is not null then perform public.fn_crear_partido_reserva(new.id); end if;
  return null;
end $$;
create trigger trg_publicar_reserva_confirmada after update of estado on public.reservas for each row execute function public.fn_publicar_reserva_confirmada();
revoke all on function public.fn_publicar_reserva_confirmada() from public,anon,authenticated;

create or replace function public.fn_validar_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cancha public.canchas%rowtype;
  franja public.cancha_disponibilidad%rowtype;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'UPDATE' then
    -- Column grants deny linking from clients; a definer RPC may attach only
    -- a server-derived party to a confirmed reservation, changing no other data.
    if old.partido_id is null and new.partido_id is not null and old.estado='confirmada'
      and (to_jsonb(new)-'partido_id')=(to_jsonb(old)-'partido_id')
      and exists(select 1 from public.partidos where id=new.partido_id and organizador_id=old.jugador_id and fecha=old.fecha and hora=old.hora_inicio) then return new; end if;
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

commit;
