\set ON_ERROR_STOP on
-- Ejecutar con psql -X -f scripts/preflight-fiabilidad.sql (credencial fuera del comando/log).
-- Requiere el esquema Falta Uno previo o posterior a fiabilidad. No crea objetos.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH conflictos AS (
  SELECT 'reservas_solapadas' AS tipo,
    jsonb_build_object('ids',jsonb_build_array(a.id,b.id),'cancha_id',a.cancha_id,'fecha',a.fecha) AS detalle
  FROM public.reservas a JOIN public.reservas b
    ON a.cancha_id=b.cancha_id AND a.fecha=b.fecha AND a.id<b.id
    AND a.estado<>'cancelada' AND b.estado<>'cancelada'
    AND a.hora_inicio<b.hora_fin AND b.hora_inicio<a.hora_fin
  UNION ALL
  SELECT 'referencias_duplicadas', jsonb_build_object('referencia',referencia,'ids',jsonb_agg(id ORDER BY id))
  FROM public.reservas GROUP BY referencia HAVING count(*)>1
  UNION ALL
  SELECT 'intervalos_invalidos',jsonb_build_object('id',id,'inicio',hora_inicio,'fin',hora_fin)
  FROM public.reservas WHERE hora_fin<=hora_inicio
  UNION ALL
  SELECT 'disponibilidad_invalida',jsonb_build_object('id',id,'duracion_min',duracion_min,'apertura',hora_apertura,'cierre',hora_cierre,'precio',precio)
  FROM public.cancha_disponibilidad WHERE duracion_min<=0 OR hora_cierre<=hora_apertura OR precio<0
), tipos(tipo) AS (VALUES ('reservas_solapadas'),('referencias_duplicadas'),('intervalos_invalidos'),('disponibilidad_invalida'))
SELECT t.tipo,count(c.detalle) AS conflictos,coalesce(jsonb_agg(c.detalle ORDER BY c.detalle::text) FILTER(WHERE c.detalle IS NOT NULL),'[]'::jsonb) AS detalles
FROM tipos t LEFT JOIN conflictos c USING(tipo) GROUP BY t.tipo ORDER BY t.tipo;
COMMIT;
