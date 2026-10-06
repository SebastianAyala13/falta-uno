begin;
create function public.archivos_reporte(p_reporte uuid)
returns table(bucket_id text,name text) language plpgsql stable security definer
set search_path=public as $$
declare r public.reportes%rowtype; urls text[]; current jsonb;
begin
  select * into r from public.reportes where id=p_reporte;
  if not found then raise exception 'Reporte no encontrado'; end if;
  urls := array[r.foto_url];
  if r.tipo='post' then select to_jsonb(p) into current from public.posts p where id=r.contenido_id::uuid;
  elsif r.tipo='perfil' then select to_jsonb(p) into current from public.profiles p where id=r.contenido_id::uuid;
  elsif r.tipo='partido' then select to_jsonb(p) into current from public.partidos p where id=r.contenido_id::uuid;
  elsif r.tipo='cancha' then select to_jsonb(p) into current from public.canchas p where id=r.contenido_id::uuid;
  end if;
  urls := urls || array[current->>'foto_url',current->>'avatar_url',current->>'foto_portada'];
  if current->'fotos' is not null then urls := urls || array(select jsonb_array_elements_text(current->'fotos')); end if;
  return query select o.bucket_id,o.name from storage.objects o
    where o.bucket_id in ('media','canchas') and (
      coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=r.autor_id::text
      or (o.bucket_id='media' and split_part(o.name,'/',1)=r.autor_id::text))
      and exists(select 1 from unnest(urls) u where split_part(u,'/storage/v1/object/public/',2)=o.bucket_id||'/'||o.name)
    order by o.bucket_id,o.name;
end $$;
revoke all on function public.archivos_reporte(uuid) from public,anon,authenticated;
grant execute on function public.archivos_reporte(uuid) to service_role;
commit;
