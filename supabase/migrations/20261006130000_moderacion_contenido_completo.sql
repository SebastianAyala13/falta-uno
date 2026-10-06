begin;
alter table public.partidos add column oculto boolean not null default false;
alter table public.canchas add column oculto boolean not null default false;
alter table public.reportes add column foto_url text;
alter table public.reportes drop constraint reportes_tipo_check;
alter table public.reportes add constraint reportes_tipo_check
  check(tipo in ('post','comentario','mensaje','partido','cancha','perfil'));

create function public.fn_guard_oculto() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.is_admin() then
    if tg_op='INSERT' then new.oculto := false;
    elsif new.oculto is distinct from old.oculto then raise exception 'Sólo moderación cambia la visibilidad'; end if;
  end if;
  return new;
end $$;
create trigger trg_guard_oculto before insert or update on public.partidos for each row execute function public.fn_guard_oculto();
create trigger trg_guard_oculto before insert or update on public.canchas for each row execute function public.fn_guard_oculto();
revoke execute on function public.fn_guard_oculto() from public,anon,authenticated;
drop policy partidos_lectura on public.partidos;
create policy partidos_lectura on public.partidos for select using(
  not oculto or organizador_id=(select auth.uid()) or public.is_admin()
  or exists(select 1 from public.partido_jugadores j where j.partido_id=partidos.id and j.jugador_id=(select auth.uid())));
drop policy canchas_lectura on public.canchas;
create policy canchas_lectura on public.canchas for select using(not oculto or owner_id=(select auth.uid()) or public.is_admin());

-- Capture the actual content/author, not client supplied attribution or photos.
create function public.fn_validar_reporte() returns trigger
language plpgsql security definer set search_path=public as $$
declare row jsonb; target uuid := new.contenido_id::uuid;
begin
  if new.reportado_por is distinct from auth.uid() then raise exception 'No autorizado'; end if;
  if new.tipo='post' then select to_jsonb(p) into row from public.posts p where id=target;
  elsif new.tipo='comentario' then select to_jsonb(p) into row from public.comentarios p where id=target;
  elsif new.tipo='mensaje' then
    select to_jsonb(p) into row from public.mensajes p where id=target and (
      exists(select 1 from public.partido_jugadores j where j.partido_id=p.partido_id and j.jugador_id=auth.uid())
      or exists(select 1 from public.partidos m where m.id=p.partido_id and m.organizador_id=auth.uid()));
  elsif new.tipo='partido' then select to_jsonb(p) into row from public.partidos p where id=target and not oculto;
  elsif new.tipo='cancha' then select to_jsonb(p) into row from public.canchas p where id=target and not oculto;
  elsif new.tipo='perfil' then select to_jsonb(p) into row from public.profiles p where id=target;
  end if;
  if row is null then raise exception 'Contenido no disponible'; end if;
  new.autor_id := coalesce(row->>'autor_id',row->>'organizador_id',row->>'owner_id',row->>'id')::uuid;
  if new.autor_id=auth.uid() then raise exception 'No podés denunciarte a vos mismo'; end if;
  new.texto := left(coalesce(row->>'texto',row->>'descripcion',row->>'nombre',row->>'cancha',''),3000);
  new.foto_url := coalesce(row->>'foto_url',row->>'foto_portada',row->>'avatar_url');
  new.estado := 'pendiente';
  return new;
end $$;
create trigger trg_validar_reporte before insert on public.reportes for each row execute function public.fn_validar_reporte();
revoke execute on function public.fn_validar_reporte() from public,anon,authenticated;

create or replace function public.admin_resolver_reporte(p_reporte uuid,p_estado text,p_eliminar boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare r public.reportes%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('resuelto','descartado') then raise exception 'Estado inválido'; end if;
  select * into r from public.reportes where id=p_reporte for update;
  if not found then raise exception 'Reporte no encontrado'; end if;
  if p_eliminar then
    if r.tipo='post' then delete from public.posts where id=r.contenido_id::uuid;
    elsif r.tipo='comentario' then delete from public.comentarios where id=r.contenido_id::uuid;
    elsif r.tipo='mensaje' then delete from public.mensajes where id=r.contenido_id::uuid;
    elsif r.tipo='partido' then update public.partidos set oculto=true,descripcion=null,foto_url=null where id=r.contenido_id::uuid;
    elsif r.tipo='cancha' then update public.canchas set oculto=true,estado='pausada',descripcion=null,foto_portada=null,fotos='{}' where id=r.contenido_id::uuid;
    elsif r.tipo='perfil' then update public.profiles set nombre='Usuario',avatar_url=null,suspendido=true where id=r.contenido_id::uuid;
    end if;
  end if;
  update public.reportes set estado=p_estado where id=p_reporte;
end $$;

create function public.fn_no_reservar_oculta() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.canchas where id=new.cancha_id and oculto) then raise exception 'Cancha retirada por moderación'; end if;
  return new;
end $$;
create trigger trg_no_reservar_oculta before insert on public.reservas for each row execute function public.fn_no_reservar_oculta();
revoke execute on function public.fn_no_reservar_oculta() from public,anon,authenticated;

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
  if partido.oculto then raise exception 'Partido retirado por moderación'; end if;
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

commit;
