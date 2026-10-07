\set ON_ERROR_STOP on
-- READ ONLY, after installation, on the project authorized by the operator.
-- No Vault values, JWTs, request headers, bodies or provider error details.
BEGIN READ ONLY;
SELECT jobname,schedule,active FROM cron.job WHERE jobname='faltauno-conciliacion';
SELECT public.estado_conciliacion() AS estado;
SELECT encolada_at AT TIME ZONE 'America/Bogota' AS encolada_bogota,
 terminada_at AT TIME ZONE 'America/Bogota' AS terminada_bogota,
 estado,http_status,pagos_liberados,reservas_liberadas,reembolso_estado,error_codigo
 FROM public.ejecuciones_conciliacion ORDER BY encolada_at DESC,id DESC LIMIT 10;
SELECT r.start_time AT TIME ZONE 'America/Bogota' AS inicio_bogota,
 r.end_time AT TIME ZONE 'America/Bogota' AS fin_bogota,r.status
 FROM cron.job_run_details r JOIN cron.job j USING(jobid)
 WHERE j.jobname='faltauno-conciliacion' ORDER BY r.start_time DESC LIMIT 10;
SELECT estado,count(*) AS cantidad,min(created_at) AT TIME ZONE 'America/Bogota' AS mas_antigua_bogota
 FROM public.conciliaciones_pago GROUP BY estado ORDER BY estado;
COMMIT;
