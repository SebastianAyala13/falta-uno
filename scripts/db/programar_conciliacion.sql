\set ON_ERROR_STOP on
-- SQL Editor: omit only the \set line. Schema belongs to migration 19.
-- This installer checks prerequisites and schedules a job; it creates no schema.
BEGIN;
DO $$declare aplicada boolean;
begin
 if to_regclass('supabase_migrations.schema_migrations') is null then
  raise exception 'Se requiere migración 20261007120000 aplicada mediante workflow';
 end if;
 execute 'select exists(select 1 from supabase_migrations.schema_migrations where version::text=''20261007120000'')' into aplicada;
 if not aplicada or to_regclass('public.ejecuciones_conciliacion') is null
  or to_regprocedure('public.observar_conciliacion()') is null
  or to_regprocedure('public.encolar_conciliacion()') is null
  or to_regprocedure('public.estado_conciliacion()') is null then
  raise exception 'Aplicar migración 20261007120000 antes de programar conciliación';
 end if;
 if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
  or to_regclass('net._http_response') is null or to_regclass('cron.job') is null
  or to_regclass('cron.job_run_details') is null or to_regclass('vault.decrypted_secrets') is null
  or to_regprocedure('cron.schedule(text,text,text)') is null then
  raise exception 'Habilitar pg_cron, pg_net y Vault antes de instalar el horario';
 end if;
end $$;
-- Repeated install updates the same named job, not duplicate schedules.
SELECT cron.schedule('faltauno-conciliacion','* * * * *','select public.observar_conciliacion(); select public.encolar_conciliacion();');
COMMIT;
