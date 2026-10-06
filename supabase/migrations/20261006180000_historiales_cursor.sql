begin;
create index pagos_jugador_cursor_idx on public.pagos(jugador_id,created_at desc,id desc);
create index reservas_jugador_cursor_idx on public.reservas(jugador_id,created_at desc,id desc);
create index reservas_cancha_cursor_idx on public.reservas(cancha_id,created_at desc,id desc);
create index reservas_cancha_fecha_cursor_idx on public.reservas(cancha_id,fecha,created_at desc,id desc);
create index movimientos_cancha_cursor_idx on public.movimientos_cancha(cancha_id,created_at desc,id desc);
create index retiros_cancha_cursor_idx on public.retiros(cancha_id,solicitado_at desc,id desc);
create index canchas_owner_cursor_idx on public.canchas(owner_id,created_at desc,id desc);
create index partido_jugadores_jugador_cursor_idx on public.partido_jugadores(jugador_id,created_at desc,id desc);
create index partidos_organizador_cursor_idx on public.partidos(organizador_id,created_at desc,id desc);
create index calificaciones_autor_cursor_idx on public.calificaciones(autor_id,created_at desc,id desc);
create index bloqueos_usuario_cursor_idx on public.bloqueos(usuario_id,created_at desc,id desc);
-- Global and state-filtered administrative pages, including old 300-row lists.
create index pagos_admin_cursor_idx on public.pagos(created_at desc,id desc);
create index pagos_estado_cursor_idx on public.pagos(estado,created_at desc,id desc);
create index reservas_admin_cursor_idx on public.reservas(created_at desc,id desc);
create index reservas_estado_cursor_idx on public.reservas(estado,created_at desc,id desc);
create index retiros_admin_cursor_idx on public.retiros(solicitado_at desc,id desc);
create index retiros_estado_cursor_idx on public.retiros(estado,solicitado_at desc,id desc);
create index perfiles_admin_cursor_idx on public.profiles(created_at desc,id desc);
create index canchas_admin_cursor_idx on public.canchas(created_at desc,id desc);
create index reportes_admin_cursor_idx on public.reportes(created_at desc,id desc);
create index reportes_estado_cursor_idx on public.reportes(estado,created_at desc,id desc);

create or replace function public.historial_paginado(
 p_tipo text,p_ambito text default 'propio',p_cancha uuid default null,
 p_antes timestamptz default null,p_antes_id uuid default null,p_limite integer default 50,
 p_estado text default null,p_fecha date default null,p_busqueda text default null
) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare tabla text; fecha_col text:='created_at'; filtro text; consulta text;
 filas jsonb; ultimo jsonb; mas boolean; uid uuid:=auth.uid(); buscar text;
begin
 if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'Límite inválido'; end if;
 if (p_antes is null)<>(p_antes_id is null) then raise exception 'Cursor incompleto'; end if;
 if p_tipo not in ('pagos','reservas','movimientos','retiros','canchas','usuarios','reportes','inscripciones','partidos','calificaciones','bloqueos') or p_tipo is null then raise exception 'Historial inválido'; end if;
 if p_ambito is null or p_ambito not in ('propio','cancha','admin') then raise exception 'Ámbito inválido'; end if;
 tabla:=case p_tipo when 'movimientos' then 'movimientos_cancha' when 'usuarios' then 'profiles' when 'inscripciones' then 'partido_jugadores' else p_tipo end;
 if p_tipo='retiros' then fecha_col:='solicitado_at'; end if;
 if p_ambito='admin' then
   if not public.is_admin() then raise exception 'No autorizado'; end if;
   filtro:='true';
   if p_cancha is not null then
     if p_tipo not in ('reservas','movimientos','retiros') then raise exception 'Filtro cancha inválido'; end if;
     filtro:='t.cancha_id=$4';
   end if;
 elsif p_ambito='cancha' then
   if p_cancha is null or p_tipo not in ('reservas','movimientos','retiros') or not exists(select 1 from public.canchas where id=p_cancha and owner_id=uid) then raise exception 'No autorizado'; end if;
   filtro:='t.cancha_id=$4';
 else
   if p_cancha is not null then raise exception 'Usá el ámbito cancha'; end if;
   filtro:=case p_tipo when 'pagos' then 't.jugador_id=$5' when 'reservas' then 't.jugador_id=$5'
     when 'inscripciones' then 't.jugador_id=$5' when 'canchas' then 't.owner_id=$5'
     when 'usuarios' then 't.id=$5' when 'reportes' then 't.reportado_por=$5'
     when 'partidos' then '(t.organizador_id=$5 or exists(select 1 from public.partido_jugadores j where j.partido_id=t.id and j.jugador_id=$5))'
     when 'calificaciones' then 't.autor_id=$5' when 'bloqueos' then 't.usuario_id=$5' else null end;
   if filtro is null then raise exception 'Este historial requiere ámbito cancha'; end if;
 end if;
 if p_estado is not null then
   if p_tipo not in ('pagos','reservas','retiros','canchas','reportes') then raise exception 'Filtro estado inválido'; end if;
   filtro:=filtro||' and t.estado=$6';
 end if;
 if p_fecha is not null then
   if p_tipo not in ('reservas','partidos') then raise exception 'Filtro fecha inválido'; end if;
   filtro:=filtro||' and t.fecha=$7';
 end if;
 if nullif(btrim(p_busqueda),'') is not null then
   if p_tipo not in ('usuarios','canchas') or length(p_busqueda)>100 then raise exception 'Búsqueda inválida'; end if;
   buscar:='%'||replace(replace(replace(btrim(p_busqueda),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
   filtro:=filtro||' and t.nombre ilike $8';
 end if;
 -- All identifiers/filters above come exclusively from fixed whitelist branches.
 -- Query parameters include caller UID, and INVOKER preserves every table's RLS.
 consulta:=format('select coalesce(jsonb_agg(x.row order by x.ts desc,x.id desc),''[]''::jsonb) from (select to_jsonb(t) row,t.%I ts,t.id from public.%I t where %s %s order by t.%I desc,t.id desc limit $3) x',
   fecha_col,tabla,filtro,case when p_antes is null then '' else format('and (t.%I,t.id)<($1,$2)',fecha_col) end,fecha_col);
 execute consulta into filas using p_antes,p_antes_id,p_limite+1,p_cancha,uid,p_estado,p_fecha,buscar;
 mas:=jsonb_array_length(filas)>p_limite;
 if mas then filas:=filas-p_limite; end if;
 if mas then ultimo:=filas->(jsonb_array_length(filas)-1); end if;
 return jsonb_build_object('filas',filas,'hay_mas',mas,'cursor',case when mas then jsonb_build_object('fecha',ultimo->fecha_col,'id',ultimo->'id') else null end);
end $$;
revoke all on function public.historial_paginado(text,text,uuid,timestamptz,uuid,integer,text,date,text) from public,anon;
grant execute on function public.historial_paginado(text,text,uuid,timestamptz,uuid,integer,text,date,text) to authenticated;
commit;
