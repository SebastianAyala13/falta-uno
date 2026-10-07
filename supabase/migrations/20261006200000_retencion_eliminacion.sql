begin;
-- Requests remain available even when deletion is financially blocked. No Auth FK:
-- completion removes the UUID and keeps only a short-lived status receipt.
create table public.solicitudes_eliminacion(
 id uuid primary key default gen_random_uuid(),usuario_id uuid unique,
 estado text not null check(estado in ('pendiente','lista','completada')),
 motivos jsonb not null default '[]',solicitada_at timestamptz not null default now(),
 completada_at timestamptz,conservar_hasta timestamptz
);
create table public.archivo_contable(
 tipo text not null check(tipo in ('pago','reserva','movimiento','retiro')),
 origen_id uuid not null,titular_vigente uuid references public.profiles(id) on delete set null,datos jsonb not null,archivado_at timestamptz not null default now(),
 conservar_hasta timestamptz not null default now()+interval '10 years',
 primary key(tipo,origen_id)
);
create table public.ejecuciones_retencion(
 id uuid primary key default gen_random_uuid(),ejecutada_at timestamptz not null default now(),conteos jsonb not null
);
alter table public.ejecuciones_retencion enable row level security;
revoke all on public.ejecuciones_retencion from anon,authenticated;
grant select on public.ejecuciones_retencion to authenticated,service_role;
create policy retencion_admin on public.ejecuciones_retencion for select to authenticated using(public.is_admin());
alter table public.reportes add column desidentificado_at timestamptz;
create index archivo_contable_retencion_idx on public.archivo_contable(conservar_hasta);
create index solicitudes_eliminacion_retencion_idx on public.solicitudes_eliminacion(conservar_hasta) where estado='completada';
create index reportes_retencion_idx on public.reportes(created_at);
create index conciliaciones_retencion_idx on public.conciliaciones_pago(updated_at) where estado='reembolsado';
alter table public.solicitudes_eliminacion enable row level security;
alter table public.archivo_contable enable row level security;
revoke all on public.solicitudes_eliminacion,public.archivo_contable from anon,authenticated;
grant select on public.solicitudes_eliminacion,public.archivo_contable to authenticated;
grant select on public.solicitudes_eliminacion,public.archivo_contable to service_role;
create policy eliminacion_lectura on public.solicitudes_eliminacion for select to authenticated
 using(usuario_id=auth.uid() or public.is_admin());
create policy archivo_contable_admin on public.archivo_contable for select to authenticated using(public.is_admin() or titular_vigente=auth.uid());

create function public.motivos_no_eliminar(p_usuario uuid) returns jsonb
language sql volatile security definer set search_path=public as $$
 select coalesce(jsonb_agg(codigo),'[]'::jsonb) from (
 select 'reservas_futuras' codigo where exists(
  select 1 from public.reservas r join public.canchas c on c.id=r.cancha_id
  where (r.jugador_id=p_usuario or c.owner_id=p_usuario) and r.estado in ('pendiente','confirmada')
   and (r.fecha+r.hora_fin) at time zone 'America/Bogota'>clock_timestamp())
 union all select 'partidos_futuros' where exists(
  select 1 from public.partidos t where ((t.organizador_id=p_usuario)
   or exists(select 1 from public.partido_jugadores j where j.partido_id=t.id and j.jugador_id=p_usuario))
   and (t.fecha+t.hora) at time zone 'America/Bogota'>clock_timestamp())
 union all select 'pagos_pendientes' where exists(
  select 1 from public.pagos p join public.partidos t on t.id=p.partido_id
  where (p.jugador_id=p_usuario or t.organizador_id=p_usuario)
   and p.medio='online' and p.estado in ('pendiente','reembolso_pendiente'))
 union all select 'reservas_pago_pendiente' where exists(
  select 1 from public.reservas r join public.canchas c on c.id=r.cancha_id
  where (r.jugador_id=p_usuario or c.owner_id=p_usuario) and r.medio='online'
   and (r.estado='pendiente' or r.estado_pago in ('pendiente','reembolso_pendiente')))
 union all select 'saldo_por_liquidar' where exists(
  select 1 from public.canchas c where c.owner_id=p_usuario
   and coalesce((select sum(m.monto) from public.movimientos_cancha m where m.cancha_id=c.id),0)<>0)
 union all select 'retiros_en_curso' where exists(
  select 1 from public.retiros r join public.canchas c on c.id=r.cancha_id
  where c.owner_id=p_usuario and r.estado in ('solicitado','procesando'))
 union all select 'devoluciones_pendientes' where exists(
  select 1 from public.conciliaciones_pago q where q.estado<>'reembolsado' and (
   exists(select 1 from public.pagos p join public.partidos t on t.id=p.partido_id where p.referencia=q.referencia and (p.jugador_id=p_usuario or t.organizador_id=p_usuario))
   or exists(select 1 from public.reservas r join public.canchas c on c.id=r.cancha_id where r.referencia=q.referencia and (r.jugador_id=p_usuario or c.owner_id=p_usuario))))
 ) razones;
$$;
create function public.solicitar_eliminacion(p_usuario uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare razones jsonb;recibo uuid;
begin
 perform 1 from public.profiles where id=p_usuario for update;
 if not found then raise exception 'Cuenta no encontrada'; end if;
 razones:=public.motivos_no_eliminar(p_usuario);
 insert into public.solicitudes_eliminacion(usuario_id,estado,motivos)
 values(p_usuario,case when razones='[]'::jsonb then 'lista' else 'pendiente' end,razones)
 on conflict(usuario_id) do update set estado=excluded.estado,motivos=excluded.motivos
 returning id into recibo;
 return jsonb_build_object('solicitud',recibo,'lista',razones='[]'::jsonb,'motivos',razones);
end $$;

-- Lock the same profile rows as the deletion request/final guard, including the
-- court owner and organizer. Updates may settle obligations; inserts cannot
-- create new ones while a request exists. Server-side seeds get no bypass.
create function public.guard_obligaciones_eliminacion() returns trigger
language plpgsql security definer set search_path=public as $$
declare row_data jsonb:=to_jsonb(new); ids uuid[]:='{}'; u uuid;prop uuid;organizador uuid;
begin
 if row_data->>'jugador_id' is not null then ids:=array_append(ids,(row_data->>'jugador_id')::uuid); end if;
 if row_data->>'organizador_id' is not null then ids:=array_append(ids,(row_data->>'organizador_id')::uuid); end if;
 if row_data->>'owner_id' is not null then ids:=array_append(ids,(row_data->>'owner_id')::uuid); end if;
 if row_data->>'cancha_id' is not null then
  select owner_id into prop from public.canchas where id=(row_data->>'cancha_id')::uuid;ids:=array_append(ids,prop);
 end if;
 if row_data->>'partido_id' is not null then
  select organizador_id into organizador from public.partidos where id=(row_data->>'partido_id')::uuid;ids:=array_append(ids,organizador);
 end if;
 for u in select distinct x from unnest(ids) x where x is not null order by x loop
  perform 1 from public.profiles where id=u for key share;
  if tg_op='INSERT' and tg_table_name not in ('retiros','movimientos_cancha')
   and exists(select 1 from public.solicitudes_eliminacion where usuario_id=u and estado<>'completada') then
   raise exception 'Cuenta con solicitud de borrado: no se admiten nuevas reservas ni pagos' using errcode='check_violation';
  end if;
 end loop;
 return new;
end $$;
do $$declare tabla text;begin
 foreach tabla in array array['canchas','partidos','partido_jugadores','pagos','reservas','movimientos_cancha','retiros'] loop
  execute format('create trigger a_guard_eliminacion before insert or update on public.%I for each row execute function public.guard_obligaciones_eliminacion()',tabla);
 end loop;
end $$;

-- Prevent new blobs after a request or Auth deletion, including uploads with an
-- old JWT. This is metadata validation, never direct deletion of Storage rows.
create function public.guard_storage_eliminacion() returns trigger
language plpgsql security definer set search_path=public as $$
declare uid uuid;owner_text text;
begin
 if new.bucket_id not in ('media','canchas') then return new; end if;
 owner_text:=case when new.bucket_id='media' then split_part(new.name,'/',1)
  else coalesce(nullif(to_jsonb(new)->>'owner_id',''),to_jsonb(new)->>'owner') end;
 if owner_text is null or owner_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  raise exception 'Archivo sin propietario válido';
 end if;
 uid:=owner_text::uuid;
 perform 1 from public.profiles where id=uid for key share;
 if not found or exists(select 1 from public.solicitudes_eliminacion where usuario_id=uid and estado<>'completada') then
  raise exception 'Cuenta con solicitud de borrado: no se admiten nuevos archivos';
 end if;
 return new;
end $$;
create trigger a_guard_eliminacion_storage before insert or update on storage.objects for each row execute function public.guard_storage_eliminacion();

-- Trigger on the FK parent: protects Auth cascade and direct SQL profile deletes.
-- No money is erased to make deletion pass. Archive only explicit minimal fields.
create function public.retencion_antes_eliminar_perfil() returns trigger
language plpgsql security definer set search_path=public as $$
declare razones jsonb;
begin
 razones:=public.motivos_no_eliminar(old.id);
 if razones<>'[]'::jsonb then
  raise exception 'Solicitud de borrado pendiente: liquidar reservas, pagos, saldo y retiros antes de cerrar la cuenta' using errcode='check_violation';
 end if;
 insert into public.archivo_contable(tipo,origen_id,titular_vigente,datos)
 select 'pago',p.id,case when p.jugador_id<>old.id then p.jugador_id when t.organizador_id<>old.id then t.organizador_id end,jsonb_build_object('referencia',p.referencia,'partido',p.partido_id,'medio',p.medio,'monto',p.monto,'comision',p.comision,'estado',p.estado,'fecha',p.created_at)
 from public.pagos p join public.partidos t on t.id=p.partido_id where p.jugador_id=old.id or t.organizador_id=old.id on conflict do nothing;
 insert into public.archivo_contable(tipo,origen_id,titular_vigente,datos)
 select 'reserva',r.id,case when r.jugador_id<>old.id then r.jugador_id when c.owner_id<>old.id then c.owner_id end,jsonb_build_object('referencia',r.referencia,'cancha',r.cancha_id,'fecha',r.fecha,'inicio',r.hora_inicio,'fin',r.hora_fin,'precio',r.precio,'comision',r.comision,'medio',r.medio,'estado',r.estado,'estado_pago',r.estado_pago)
 from public.reservas r join public.canchas c on c.id=r.cancha_id where r.jugador_id=old.id or c.owner_id=old.id on conflict do nothing;
 insert into public.archivo_contable(tipo,origen_id,datos)
 select 'movimiento',m.id,jsonb_build_object('cancha',m.cancha_id,'tipo',m.tipo,'monto',m.monto,'reserva',m.reserva_id,'retiro',m.retiro_id,'fecha',m.created_at)
 from public.movimientos_cancha m join public.canchas c on c.id=m.cancha_id where c.owner_id=old.id
 on conflict do nothing;
 insert into public.archivo_contable(tipo,origen_id,datos)
 select 'retiro',r.id,jsonb_build_object('cancha',r.cancha_id,'monto',r.monto,'estado',r.estado,'referencia_proveedor',r.payout_ref,'solicitado',r.solicitado_at,'procesado',r.procesado_at)
 from public.retiros r join public.canchas c on c.id=r.cancha_id where c.owner_id=old.id on conflict do nothing;
 -- Do not retain textual evidence/photos of a deleted author under a NULL ID.
 update public.reportes set autor_id=null,texto=null,foto_url=null,contenido_id=gen_random_uuid()::text,desidentificado_at=clock_timestamp() where autor_id=old.id;
 update public.solicitudes_eliminacion set usuario_id=null,estado='completada',motivos='[]',completada_at=clock_timestamp(),conservar_hasta=clock_timestamp()+interval '90 days' where usuario_id=old.id;
 return old;
end $$;
create trigger a_retencion_perfil before delete on public.profiles for each row execute function public.retencion_antes_eliminar_perfil();

-- Explicit bounded retention; not automatically deployed/scheduled. Purges ONLY
-- policy-expired records, never pending debts or live financial transactions.
create function public.aplicar_retencion(p_limite integer default 1000) returns jsonb
language plpgsql security definer set search_path=public as $$
declare n_archivo integer;n_reportes integer;n_solicitudes integer;n_devoluciones integer;resultado jsonb;
begin
 if p_limite is null or p_limite not between 1 and 10000 then raise exception 'Límite inválido'; end if;
 update public.reportes set texto=null,foto_url=null,contenido_id=gen_random_uuid()::text,desidentificado_at=clock_timestamp() where id in(select id from public.reportes where autor_id is null and desidentificado_at is null order by created_at limit p_limite);
 delete from public.archivo_contable where conservar_hasta<=clock_timestamp() and (tipo,origen_id) in(select tipo,origen_id from public.archivo_contable where conservar_hasta<=clock_timestamp() order by conservar_hasta limit p_limite);get diagnostics n_archivo=row_count;
 delete from public.reportes where created_at<=clock_timestamp()-interval '90 days' and id in(select id from public.reportes where created_at<=clock_timestamp()-interval '90 days' order by created_at limit p_limite);get diagnostics n_reportes=row_count;
 delete from public.solicitudes_eliminacion where estado='completada' and conservar_hasta<=clock_timestamp() and id in(select id from public.solicitudes_eliminacion where estado='completada' and conservar_hasta<=clock_timestamp() order by conservar_hasta limit p_limite);get diagnostics n_solicitudes=row_count;
 delete from public.conciliaciones_pago where estado='reembolsado' and updated_at<=clock_timestamp()-interval '10 years' and id in(select id from public.conciliaciones_pago where estado='reembolsado' and updated_at<=clock_timestamp()-interval '10 years' order by updated_at limit p_limite);get diagnostics n_devoluciones=row_count;
 resultado:=jsonb_build_object('archivo',n_archivo,'reportes',n_reportes,'solicitudes',n_solicitudes,'devoluciones',n_devoluciones);
 insert into public.ejecuciones_retencion(conteos) values(resultado);
 delete from public.ejecuciones_retencion where ejecutada_at<clock_timestamp()-interval '90 days';
 return resultado;
end $$;
revoke all on function public.motivos_no_eliminar(uuid),public.solicitar_eliminacion(uuid),public.guard_obligaciones_eliminacion(),public.guard_storage_eliminacion(),public.retencion_antes_eliminar_perfil(),public.aplicar_retencion(integer) from public,anon,authenticated;
grant execute on function public.solicitar_eliminacion(uuid),public.aplicar_retencion(integer) to service_role;
commit;
