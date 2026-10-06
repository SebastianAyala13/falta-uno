\set ON_ERROR_STOP on
-- Prepared installer, NOT run by migrations/CI. Claude installs first in staging.
-- Pre-req: pg_cron, pg_net, Vault installed; secrets provisioned privately via panel.
BEGIN;
DO $$begin
 if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
   or to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null
 then raise exception 'Habilitar pg_cron, pg_net y Vault antes de instalar'; end if;
end $$;
CREATE TABLE IF NOT EXISTS public.ejecuciones_conciliacion(
 id uuid primary key default gen_random_uuid(),request_id bigint unique,
 encolada_at timestamptz not null default clock_timestamp(),terminada_at timestamptz,
 estado text not null check(estado in ('encolada','ok','fallida','sin_respuesta')),
 http_status integer,pagos_liberados integer,reservas_liberadas integer,
 reembolso_estado text,error_codigo text
);
ALTER TABLE public.ejecuciones_conciliacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ejecuciones_conciliacion FROM anon,authenticated;
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
-- Repeated install updates the same named job, not duplicate schedules.
SELECT cron.schedule('faltauno-conciliacion','* * * * *','select public.observar_conciliacion(); select public.encolar_conciliacion();');
COMMIT;
