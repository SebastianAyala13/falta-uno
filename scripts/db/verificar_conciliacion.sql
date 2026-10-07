\set ON_ERROR_STOP on
-- READ ONLY. One result table for SQL Editor; no Vault, headers or cron.command.
BEGIN READ ONLY;
SELECT comprobacion,resultado FROM (
 SELECT '01_jobs'::text AS comprobacion,coalesce(jsonb_agg(jsonb_build_object('jobname',jobname,'schedule',schedule,'active',active) ORDER BY jobname),'[]') AS resultado
 FROM cron.job WHERE jobname IN ('faltauno-conciliacion','faltauno-retencion')
 UNION ALL
 SELECT '02_estado',public.estado_conciliacion()
 UNION ALL
 SELECT '03_ultimas_conciliaciones',coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM (
  SELECT encolada_at AT TIME ZONE 'America/Bogota' AS encolada_bogota,
   terminada_at AT TIME ZONE 'America/Bogota' AS terminada_bogota,
   estado,http_status,pagos_liberados,reservas_liberadas,reembolso_estado,error_codigo
  FROM public.ejecuciones_conciliacion ORDER BY encolada_at DESC,id DESC LIMIT 10
 ) e
 UNION ALL
 SELECT '04_historial_cron',coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM (
  SELECT j.jobname,r.start_time AT TIME ZONE 'America/Bogota' AS inicio_bogota,
   r.end_time AT TIME ZONE 'America/Bogota' AS fin_bogota,r.status
  FROM cron.job_run_details r JOIN cron.job j USING(jobid)
  WHERE j.jobname IN ('faltauno-conciliacion','faltauno-retencion') ORDER BY r.start_time DESC LIMIT 20
 ) r
 UNION ALL
 SELECT '05_devoluciones',coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM (
  SELECT estado,count(*) AS cantidad,min(created_at) AT TIME ZONE 'America/Bogota' AS mas_antigua_bogota
  FROM public.conciliaciones_pago GROUP BY estado ORDER BY estado
 ) d
 UNION ALL
 SELECT '06_ultima_retencion',(
  SELECT jsonb_build_object('ejecutada_bogota',ejecutada_at AT TIME ZONE 'America/Bogota','conteos',conteos)
  FROM public.ejecuciones_retencion ORDER BY ejecutada_at DESC,id DESC LIMIT 1
 )
) verificaciones ORDER BY comprobacion;
COMMIT;
