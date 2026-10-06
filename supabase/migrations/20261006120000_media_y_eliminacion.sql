begin;

-- Public photos intentionally visible in profiles/posts/matches/court listings.
-- Only the author's folder is writable; SVG and non-images are excluded.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media','media',true,5242880,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
create policy media_insert_autor on storage.objects for insert to authenticated
with check(bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.profiles where id=(select auth.uid()) and not suspendido));
create policy media_lectura on storage.objects for select to anon,authenticated
using(bucket_id='media');
create policy media_delete_autor on storage.objects for delete to authenticated
using(bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Storage schema is not exposed through the Data API. The deletion function
-- obtains just one batch through this service_role-only RPC and removes files
-- with the Storage API, never by deleting storage.objects rows directly.
create function public.archivos_usuario(p_usuario uuid)
returns table(bucket_id text,name text) language sql stable security definer
set search_path=public as $$
  select o.bucket_id,o.name from storage.objects o
  where o.bucket_id in ('media','canchas') and (
    coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=p_usuario::text
    or (o.bucket_id='media' and split_part(o.name,'/',1)=p_usuario::text))
  order by o.bucket_id,o.name limit 100;
$$;
revoke all on function public.archivos_usuario(uuid) from public,anon,authenticated;
grant execute on function public.archivos_usuario(uuid) to service_role;
commit;
