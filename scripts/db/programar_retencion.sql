\set ON_ERROR_STOP on
-- Prepared only: run first in staging, after the retention migration.
-- pg_cron timezone assumed UTC: 08:15 UTC = 03:15 America/Bogota.
-- Install does not execute a purge immediately.
BEGIN;
DO $$begin
 if to_regclass('cron.job') is null or to_regprocedure('public.aplicar_retencion(integer)') is null then
  raise exception 'Se requiere pg_cron y migración de retención';
 end if;
end $$;
SELECT cron.schedule('faltauno-retencion','15 8 * * *','select public.aplicar_retencion(1000);');
COMMIT;
-- Verify active job and timezone privately; never SELECT command/secret tables.
-- No production deployment performed by Codex.
