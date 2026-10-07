-- Own the scheduler objects in migration history; activation is a separate,
-- explicit panel step. This migration never schedules cron or reads Vault.
BEGIN;
-- pg_cron/pg_net/Vault are optional at migration time. The SQL status function
-- references cron and is validated when invoked after the activation preflight.
-- SET LOCAL restores the caller's setting at COMMIT/ROLLBACK.
SET LOCAL check_function_bodies = off;

-- Reapplying over the former SQL-Editor installer preserves its rows. A name
-- occupied by an incompatible object is a visible error, never silently adopted.
DO $compatibilidad$
DECLARE
  relacion oid := to_regclass('public.ejecuciones_conciliacion');
  indice oid := to_regclass('public.conciliacion_ejecuciones_fecha_idx');
  item record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='ejecuciones_conciliacion'
      AND (relacion IS NULL OR t.typrelid IS DISTINCT FROM relacion)
  ) THEN
    RAISE EXCEPTION 'Colisión: public.ejecuciones_conciliacion tiene un tipo incompatible';
  END IF;
  IF relacion IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relacion AND relkind='r') THEN
      RAISE EXCEPTION 'Colisión: public.ejecuciones_conciliacion no es una tabla ordinaria';
    END IF;
    IF EXISTS (
      WITH esperado(nombre,tipo,obligatoria) AS (VALUES
        ('id','uuid'::regtype,true),('request_id','bigint'::regtype,false),
        ('encolada_at','timestamptz'::regtype,true),('terminada_at','timestamptz'::regtype,false),
        ('estado','text'::regtype,true),('http_status','integer'::regtype,false),
        ('pagos_liberados','integer'::regtype,false),('reservas_liberadas','integer'::regtype,false),
        ('reembolso_estado','text'::regtype,false),('error_codigo','text'::regtype,false)
      ), actual AS (
        SELECT a.attname,a.atttypid,a.attnotnull,a.attgenerated,a.attidentity,d.adbin
        FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE a.attrelid=relacion AND a.attnum>0 AND NOT a.attisdropped
      )
      SELECT 1 FROM esperado e FULL JOIN actual a ON a.attname=e.nombre
      WHERE a.attname IS NULL
        OR (e.nombre IS NULL AND a.attnotnull AND a.adbin IS NULL AND a.attgenerated='' AND a.attidentity='')
        OR (e.nombre IS NOT NULL AND (a.atttypid<>e.tipo OR a.attnotnull<>e.obligatoria OR a.attgenerated<>'' OR a.attidentity<>''))
    ) THEN
      RAISE EXCEPTION 'Colisión: columnas incompatibles en public.ejecuciones_conciliacion';
    END IF;
    IF (
      SELECT regexp_replace(pg_get_expr(d.adbin,d.adrelid),'(pg_catalog|public)\.','','g')
      FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE d.adrelid=relacion AND a.attname='id'
    ) IS DISTINCT FROM 'gen_random_uuid()' OR (
      SELECT regexp_replace(pg_get_expr(d.adbin,d.adrelid),'(pg_catalog|public)\.','','g')
      FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE d.adrelid=relacion AND a.attname='encolada_at'
    ) IS DISTINCT FROM 'clock_timestamp()' THEN
      RAISE EXCEPTION 'Colisión: defaults incompatibles en public.ejecuciones_conciliacion';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=relacion AND c.contype='p'
        AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=relacion AND attname='id')]::smallint[]
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=relacion AND c.contype='u'
        AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=relacion AND attname='request_id')]::smallint[]
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=relacion AND c.contype='c' AND c.convalidated
        AND regexp_replace(pg_get_expr(c.conbin,c.conrelid),'[[:space:]()]','','g') LIKE 'estado=ANYARRAY[%'
        AND ARRAY(
          SELECT literal[1] FROM regexp_matches(pg_get_expr(c.conbin,c.conrelid),'''([^'']*)''::text','g') literal
          ORDER BY literal[1]
        )=ARRAY['encolada','fallida','ok','sin_respuesta']
    ) THEN
      RAISE EXCEPTION 'Colisión: restricciones incompatibles en public.ejecuciones_conciliacion';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid=relacion AND p.polname<>'conciliacion_ejecuciones_admin'
        AND p.polpermissive AND p.polcmd IN ('r','*')
        AND p.polroles && ARRAY[0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
        AND regexp_replace(coalesce(pg_get_expr(p.polqual,p.polrelid),'true'),'[[:space:]()]|public\.','','g') NOT IN ('is_admin','false')
    ) THEN
      RAISE EXCEPTION 'Colisión: política permisiva adicional de conciliación requiere revisión';
    END IF;
  END IF;
  IF indice IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    JOIN pg_am am ON am.oid=c.relam
    WHERE i.indexrelid=indice AND i.indrelid=relacion AND c.relkind='i' AND am.amname='btree'
      AND i.indisvalid AND i.indisready AND NOT i.indisunique
      AND i.indnkeyatts=1 AND i.indnatts=1 AND i.indexprs IS NULL AND i.indpred IS NULL
      AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid=relacion AND attname='encolada_at')
      AND (i.indoption[0] & 1)=1
  ) THEN
    RAISE EXCEPTION 'Colisión: public.conciliacion_ejecuciones_fecha_idx incompatible';
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('public.observar_conciliacion()','void'::regtype),
    ('public.encolar_conciliacion()','bigint'::regtype),
    ('public.estado_conciliacion()','jsonb'::regtype)
  ) esperado(firma,retorno) LOOP
    IF EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(item.firma)
      AND (prokind<>'f' OR proretset OR prorettype<>item.retorno)) THEN
      RAISE EXCEPTION 'Colisión: firma o retorno incompatible de %',item.firma;
    END IF;
  END LOOP;
END;
$compatibilidad$;

CREATE TABLE IF NOT EXISTS public.ejecuciones_conciliacion(
 id uuid primary key default gen_random_uuid(),request_id bigint unique,
 encolada_at timestamptz not null default clock_timestamp(),terminada_at timestamptz,
 estado text not null check(estado in ('encolada','ok','fallida','sin_respuesta')),
 http_status integer,pagos_liberados integer,reservas_liberadas integer,
 reembolso_estado text,error_codigo text
);
ALTER TABLE public.ejecuciones_conciliacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ejecuciones_conciliacion FROM public,anon,authenticated;
GRANT SELECT ON public.ejecuciones_conciliacion TO authenticated,service_role;
DROP POLICY IF EXISTS conciliacion_ejecuciones_admin ON public.ejecuciones_conciliacion;
CREATE POLICY conciliacion_ejecuciones_admin ON public.ejecuciones_conciliacion FOR SELECT TO authenticated USING(public.is_admin());
CREATE INDEX IF NOT EXISTS conciliacion_ejecuciones_fecha_idx ON public.ejecuciones_conciliacion(encolada_at desc);

CREATE OR REPLACE FUNCTION public.observar_conciliacion() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare job record;response record;body jsonb;valid boolean;
begin
 for job in select * from public.ejecuciones_conciliacion where estado in ('encolada','sin_respuesta') for update skip locked loop
   select status_code,content,timed_out,error_msg into response from net._http_response where id=job.request_id;
   if not found then
     if job.encolada_at<clock_timestamp()-interval '2 minutes' then
       update public.ejecuciones_conciliacion set estado='sin_respuesta',error_codigo='HTTP_AUSENTE',terminada_at=clock_timestamp() where id=job.id;
     end if;
     continue;
   end if;
   body:=null;
   begin body:=response.content::jsonb; exception when others then body:=null; end;
   valid:=response.status_code=200 and not coalesce(response.timed_out,false) and body->>'ok'='true'
     and jsonb_typeof(body->'caducados'->'pagos')='number' and jsonb_typeof(body->'caducados'->'reservas')='number'
     and body->'caducados'->>'pagos' ~ '^[0-9]{1,9}$' and body->'caducados'->>'reservas' ~ '^[0-9]{1,9}$';
   update public.ejecuciones_conciliacion set estado=case when coalesce(valid,false) then 'ok' else 'fallida' end,
     terminada_at=clock_timestamp(),http_status=response.status_code,
     pagos_liberados=case when coalesce(valid,false) then (body->'caducados'->>'pagos')::integer else null end,
     reservas_liberadas=case when coalesce(valid,false) then (body->'caducados'->>'reservas')::integer else null end,
     reembolso_estado=case when coalesce(valid,false) then coalesce(body->>'reembolso',body->>'reembolsos') else null end,
     error_codigo=case when coalesce(valid,false) then null else 'HTTP_O_RESPUESTA_INVALIDA' end where id=job.id;
 end loop;
end $$;
CREATE OR REPLACE FUNCTION public.encolar_conciliacion() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare endpoint text;secret text;request bigint;
begin
 perform public.observar_conciliacion();
 if exists(select 1 from public.ejecuciones_conciliacion where estado='encolada' and encolada_at>clock_timestamp()-interval '2 minutes') then return null; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='faltauno_conciliacion_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='faltauno_conciliacion_secret';
 if endpoint is null or endpoint !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/conciliar-pagos$' or nullif(secret,'') is null then
   insert into public.ejecuciones_conciliacion(estado,terminada_at,error_codigo) values('fallida',clock_timestamp(),'CONFIGURACION_AUSENTE_O_INVALIDA');return null;
 end if;
 begin
   select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=50000) into request;
   if request is null then raise exception 'No se recibió referencia HTTP'; end if;
   insert into public.ejecuciones_conciliacion(request_id,estado) values(request,'encolada');
   return request;
 exception when others then
   insert into public.ejecuciones_conciliacion(estado,terminada_at,error_codigo) values('fallida',clock_timestamp(),'ERROR_AL_ENCOLAR');return null;
 end;
end $$;
CREATE OR REPLACE FUNCTION public.estado_conciliacion() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 select case when auth.role()='authenticated' and not public.is_admin() then null else jsonb_build_object(
 'ultima_ejecucion',(select to_jsonb(e) from public.ejecuciones_conciliacion e order by encolada_at desc,id desc limit 1),
 'ultimo_ok',(select max(terminada_at) from public.ejecuciones_conciliacion where estado='ok'),
 'vencimientos_liberados',(select jsonb_build_object('pagos',coalesce(sum(pagos),0),'reservas',coalesce(sum(reservas),0)) from public.ejecuciones_caducidad),
 'pendientes_vencidos',(select count(*) from public.pagos where medio='online' and estado='pendiente' and caduca_at<now())+(select count(*) from public.reservas where medio='online' and estado='pendiente' and caduca_at<now()),
 'devoluciones_pendientes',(select count(*) from public.conciliaciones_pago where estado in ('pendiente','procesando','proveedor_pendiente')),
 'devoluciones_revision',(select count(*) from public.conciliaciones_pago where estado='revision_manual'),
 'alarma',not exists(select 1 from public.ejecuciones_conciliacion where estado='ok' and terminada_at>now()-interval '3 minutes')
   or exists(select 1 from public.ejecuciones_conciliacion where estado in ('fallida','sin_respuesta') and encolada_at>now()-interval '3 minutes')
   or exists(select 1 from public.conciliaciones_pago where estado='revision_manual' or (estado in ('pendiente','procesando','proveedor_pendiente') and created_at<now()-interval '15 minutes'))
   or exists(select 1 from public.pagos where medio='online' and estado='pendiente' and caduca_at<now()-interval '3 minutes')
   or exists(select 1 from public.reservas where medio='online' and estado='pendiente' and caduca_at<now()-interval '3 minutes'),
 'deuda_mas_antigua',(select min(created_at) from public.conciliaciones_pago where estado<>'reembolsado'),
 'ultimo_cron',(select jsonb_build_object('status',r.status,'start_time',r.start_time,'end_time',r.end_time) from cron.job_run_details r join cron.job j using(jobid) where j.jobname='faltauno-conciliacion' order by r.start_time desc limit 1)
 ) end;
$$;
REVOKE ALL ON FUNCTION public.encolar_conciliacion(),public.observar_conciliacion(),public.estado_conciliacion() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encolar_conciliacion(),public.observar_conciliacion() TO service_role;
GRANT EXECUTE ON FUNCTION public.estado_conciliacion() TO authenticated,service_role;

COMMIT;
