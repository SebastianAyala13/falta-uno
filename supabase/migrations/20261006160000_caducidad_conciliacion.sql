begin;
alter table public.pagos drop constraint pagos_estado_check;
alter table public.pagos add constraint pagos_estado_check check(estado in ('pendiente','aprobado','rechazado','caducado','reembolso_pendiente','reembolsado'));
alter table public.pagos add column caduca_at timestamptz;
alter table public.reservas add column caduca_at timestamptz;
alter table public.reservas add column estado_pago text check(estado_pago in ('pendiente','confirmado','caducado','reembolso_pendiente','reembolsado'));
-- Existing unpaid online holds get their original creation deadline, not a new lease.
update public.pagos p set caduca_at=least(p.created_at+interval '15 minutes',(t.fecha+t.hora) at time zone 'America/Bogota') from public.partidos t where p.partido_id=t.id and p.medio='online';
update public.reservas set caduca_at=least(created_at+interval '15 minutes',(fecha+hora_inicio) at time zone 'America/Bogota'),estado_pago=case estado when 'confirmada' then 'confirmado' when 'completada' then 'confirmado' when 'pendiente' then 'pendiente' else 'caducado' end where medio='online';
create index pagos_pendientes_caducidad_idx on public.pagos(caduca_at,id) where medio='online' and estado='pendiente';
create index reservas_pendientes_caducidad_idx on public.reservas(caduca_at,id) where medio='online' and estado='pendiente';
create or replace function public.fn_fijar_caducidad() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.medio='online' then
    new.caduca_at:=clock_timestamp()+interval '15 minutes';
    if tg_table_name='reservas' then
      new.caduca_at:=least(new.caduca_at,(new.fecha+new.hora_inicio) at time zone 'America/Bogota');
      new.estado_pago:='pendiente';
    else
      new.caduca_at:=least(new.caduca_at,(select (fecha+hora) at time zone 'America/Bogota' from public.partidos where id=new.partido_id));
    end if;
  else new.caduca_at:=null;
  end if;
  return new;
end $$;
create trigger trg_fijar_caducidad before insert on public.pagos for each row execute function public.fn_fijar_caducidad();
create trigger trg_fijar_caducidad before insert on public.reservas for each row execute function public.fn_fijar_caducidad();
revoke all on function public.fn_fijar_caducidad() from public,anon,authenticated;

create table public.conciliaciones_pago(
 id uuid primary key default gen_random_uuid(),referencia text not null unique,
 tipo text not null check(tipo in ('partido','reserva')), monto integer not null check(monto>0),
 proveedor_pago_id text, proveedor_reembolso_id text unique,
 estado text not null default 'pendiente' check(estado in ('pendiente','procesando','proveedor_pendiente','reembolsado','revision_manual')),
 intentos integer not null default 0, lease_token uuid, lease_hasta timestamptz,
 ultimo_error text, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.conciliaciones_pago enable row level security;
revoke all on public.conciliaciones_pago from anon,authenticated;
grant select,insert,update on public.conciliaciones_pago to service_role;
create policy conciliacion_admin_lectura on public.conciliaciones_pago for select to authenticated using(public.is_admin());
grant select on public.conciliaciones_pago to authenticated;
create table public.ejecuciones_caducidad(id uuid primary key default gen_random_uuid(),ejecutado_at timestamptz not null default now(),pagos integer not null,reservas integer not null);
alter table public.ejecuciones_caducidad enable row level security;
revoke all on public.ejecuciones_caducidad from anon,authenticated;
grant select on public.ejecuciones_caducidad to authenticated;
create policy caducidad_admin_lectura on public.ejecuciones_caducidad for select to authenticated using(public.is_admin());
grant select,insert on public.ejecuciones_caducidad to service_role;

create or replace function public.caducar_pagos_pendientes(p_limite integer default 100) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item record; p public.pagos%rowtype; r public.reservas%rowtype; np integer:=0; nr integer:=0;
begin
  if p_limite is null or p_limite not between 1 and 500 then raise exception 'Límite inválido'; end if;
  -- Same lock order as enrollment and webhook: partido -> pago -> membership.
  for item in select id,partido_id from public.pagos where medio='online' and estado='pendiente' and caduca_at<=clock_timestamp() order by caduca_at,id limit p_limite loop
    perform 1 from public.partidos where id=item.partido_id for update;
    select * into p from public.pagos where id=item.id for update;
    if p.estado<>'pendiente' or p.caduca_at>clock_timestamp() then continue; end if;
    update public.pagos set estado='caducado' where id=p.id;
    delete from public.partido_jugadores j where j.partido_id=p.partido_id and j.jugador_id=p.jugador_id and not j.confirmado
      and not exists(select 1 from public.pagos q where q.partido_id=p.partido_id and q.jugador_id=p.jugador_id and q.id<>p.id and q.estado in ('pendiente','aprobado'));
    np:=np+1;
  end loop;
  for r in select * from public.reservas where medio='online' and estado='pendiente' and caduca_at<=clock_timestamp() order by caduca_at,id limit p_limite for update skip locked loop
    update public.reservas set estado='cancelada',estado_pago='caducado' where id=r.id;
    nr:=nr+1;
  end loop;
  insert into public.ejecuciones_caducidad(pagos,reservas) values(np,nr);
  return jsonb_build_object('pagos',np,'reservas',nr);
end $$;
revoke all on function public.caducar_pagos_pendientes(integer) from public,anon,authenticated;
grant execute on function public.caducar_pagos_pendientes(integer) to service_role;

-- Replace old signature without breaking callers; extended signature captures
-- the provider payment ID needed to return late money rather than resurrect seats.
drop function public.confirmar_pago_online(text,integer,text);
create or replace function public.confirmar_pago_online(p_referencia text,p_monto integer,p_moneda text,p_proveedor_pago_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.pagos%rowtype; r public.reservas%rowtype; late boolean; tipo text;
begin
  if p_moneda is distinct from 'COP' or p_monto is null or p_monto<=0 then raise exception 'Moneda o monto inválido'; end if;
  select * into p from public.pagos where referencia=p_referencia;
  if found then
    tipo:='partido';
    perform 1 from public.partidos where id=p.partido_id for update;
    select * into p from public.pagos where id=p.id for update;
    if p.medio<>'online' or p.monto<>p_monto then raise exception 'Pago no coincide'; end if;
    if p.estado='aprobado' then return jsonb_build_object('tipo',tipo,'duplicado',true); end if;
    late:=p.estado<>'pendiente' or p.caduca_at<=clock_timestamp() or not exists(select 1 from public.partido_jugadores where partido_id=p.partido_id and jugador_id=p.jugador_id)
      or exists(select 1 from public.partidos where id=p.partido_id and (oculto or fecha+hora<=clock_timestamp() at time zone 'America/Bogota'));
    if not late then
      update public.partido_jugadores set confirmado=true where partido_id=p.partido_id and jugador_id=p.jugador_id;
      update public.pagos set estado='aprobado' where id=p.id;
      return jsonb_build_object('tipo',tipo,'duplicado',false);
    end if;
    if p.estado not in ('reembolso_pendiente','reembolsado') then
      update public.pagos set estado='reembolso_pendiente' where id=p.id;
      delete from public.partido_jugadores j where j.partido_id=p.partido_id and j.jugador_id=p.jugador_id and not j.confirmado
        and not exists(select 1 from public.pagos q where q.partido_id=p.partido_id and q.jugador_id=p.jugador_id and q.id<>p.id and q.estado in ('pendiente','aprobado'));
    end if;
  else
    tipo:='reserva';
    select * into r from public.reservas where referencia=p_referencia for update;
    if not found then raise exception 'Referencia desconocida'; end if;
    if r.medio<>'online' or r.precio<>p_monto then raise exception 'Pago no coincide'; end if;
    if r.estado in ('confirmada','completada') and r.estado_pago='confirmado' then return jsonb_build_object('tipo',tipo,'duplicado',true); end if;
    late:=r.estado<>'pendiente' or r.caduca_at<=clock_timestamp() or r.fecha+r.hora_inicio<=clock_timestamp() at time zone 'America/Bogota'
      or exists(select 1 from public.canchas where id=r.cancha_id and (oculto or estado<>'activa'));
    if not late then
      insert into public.movimientos_cancha(cancha_id,tipo,monto,reserva_id,descripcion) values
        (r.cancha_id,'ingreso_reserva',r.precio,r.id,'Ingreso por reserva (Rapyd)'),
        (r.cancha_id,'comision',-abs(r.comision),r.id,'Comisión Falta Uno');
      update public.reservas set estado='confirmada',estado_pago='confirmado' where id=r.id;
      return jsonb_build_object('tipo',tipo,'duplicado',false);
    end if;
    update public.reservas set estado='cancelada',estado_pago=case when estado_pago='reembolsado' then estado_pago else 'reembolso_pendiente' end where id=r.id;
  end if;
  insert into public.conciliaciones_pago(referencia,tipo,monto,proveedor_pago_id)
    values(p_referencia,tipo,p_monto,p_proveedor_pago_id)
    on conflict(referencia) do update set proveedor_pago_id=coalesce(conciliaciones_pago.proveedor_pago_id,excluded.proveedor_pago_id);
  return jsonb_build_object('tipo',tipo,'reembolso_pendiente',true);
end $$;
revoke all on function public.confirmar_pago_online(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.confirmar_pago_online(text,integer,text,text) to service_role;

create or replace function public.tomar_reembolso() returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.conciliaciones_pago%rowtype;
begin
  -- A crashed POST is ambiguous: never automatically issue another charge/refund.
  update public.conciliaciones_pago set estado='revision_manual',ultimo_error='Lease vencida: verificar proveedor antes de reintentar',updated_at=now()
    where estado='procesando' and lease_hasta<clock_timestamp();
  select * into r from public.conciliaciones_pago where estado in ('pendiente','proveedor_pendiente') and (lease_hasta is null or lease_hasta<clock_timestamp()) order by created_at,id limit 1 for update skip locked;
  if not found then return null; end if;
  update public.conciliaciones_pago set estado='procesando',intentos=intentos+1,lease_token=gen_random_uuid(),lease_hasta=clock_timestamp()+interval '2 minutes',updated_at=now() where id=r.id returning * into r;
  return to_jsonb(r);
end $$;
create or replace function public.registrar_reembolso(p_id uuid,p_token uuid,p_estado text,p_proveedor_id text default null,p_error text default null) returns void
language plpgsql security definer set search_path=public as $$
declare r public.conciliaciones_pago%rowtype;
begin
  if p_estado not in ('reembolsado','proveedor_pendiente','revision_manual') then raise exception 'Estado inválido'; end if;
  select * into r from public.conciliaciones_pago where id=p_id;
  -- Match/payment or reservation first, queue second, same order as webhook.
  if r.tipo='partido' then
    perform 1 from public.partidos where id=(select partido_id from public.pagos where referencia=r.referencia) for update;
    perform 1 from public.pagos where referencia=r.referencia for update;
  else perform 1 from public.reservas where referencia=r.referencia for update;
  end if;
  select * into r from public.conciliaciones_pago where id=p_id for update;
  if not found or r.estado<>'procesando' or r.lease_token is distinct from p_token or r.lease_hasta<=clock_timestamp() then raise exception 'Lease inválida'; end if;
  if p_estado in ('reembolsado','proveedor_pendiente') and nullif(p_proveedor_id,'') is null then raise exception 'Falta referencia del proveedor'; end if;
  update public.conciliaciones_pago set estado=p_estado,proveedor_reembolso_id=coalesce(p_proveedor_id,proveedor_reembolso_id),ultimo_error=p_error,
    lease_hasta=case when p_estado='proveedor_pendiente' then clock_timestamp()+interval '1 minute' else null end,lease_token=null,updated_at=now() where id=r.id;
  if p_estado='reembolsado' then
    if r.tipo='partido' then update public.pagos set estado='reembolsado' where referencia=r.referencia and estado='reembolso_pendiente';
    else update public.reservas set estado_pago='reembolsado' where referencia=r.referencia and estado_pago='reembolso_pendiente'; end if;
  end if;
end $$;
revoke all on function public.tomar_reembolso(),public.registrar_reembolso(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.tomar_reembolso(),public.registrar_reembolso(uuid,uuid,text,text,text) to service_role;
commit;
