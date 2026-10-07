BEGIN;
-- Read-only aggregate for the external monitor. Deployment and its separate
-- header secret are configured explicitly; this migration never starts jobs.
CREATE OR REPLACE FUNCTION public.estado_salud() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  conciliacion jsonb;
  ahora timestamptz := now();
  retencion_instalada boolean;
BEGIN
  conciliacion := public.estado_conciliacion();
  -- Missing keys, JSON null, strings such as "false", and SQL NULL fail closed.
  IF jsonb_typeof(conciliacion->'alarma') IS DISTINCT FROM 'boolean'
     OR conciliacion->'alarma' IS DISTINCT FROM 'false'::jsonb THEN
    RETURN false;
  END IF;
  -- Paused/deleted jobs must not look healthy during the last success's grace
  -- period. Ambiguous duplicate names also require the operator's attention.
  IF (SELECT count(*)<>1 OR NOT coalesce(bool_and(active),false)
      FROM cron.job WHERE jobname='faltauno-conciliacion') THEN
    RETURN false;
  END IF;
  -- Retention history is evidence the purger already ran. Removing its job
  -- cannot hide an alarm while that history exists. Pause instead of deleting.
  retencion_instalada := EXISTS (
    SELECT 1 FROM cron.job WHERE jobname='faltauno-retencion'
  ) OR EXISTS (SELECT 1 FROM public.ejecuciones_retencion);
  IF retencion_instalada THEN
    IF (SELECT count(*)<>1 OR NOT coalesce(bool_and(active),false)
        FROM cron.job WHERE jobname='faltauno-retencion') THEN
      RETURN false;
    END IF;
    -- aplicar_retencion writes its receipt in the purge's own transaction. A
    -- failed transaction leaves no receipt; future timestamps are not success.
    IF NOT EXISTS (
      SELECT 1 FROM public.ejecuciones_retencion
      WHERE ejecutada_at>=ahora-interval '26 hours' AND ejecutada_at<=ahora
    ) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Never return SQL error details, counts, timestamps, IDs or payment data.
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.estado_salud() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.estado_salud() TO service_role;
COMMIT;
