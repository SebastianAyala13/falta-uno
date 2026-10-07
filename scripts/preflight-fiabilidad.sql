\set ON_ERROR_STOP on
-- Ejecutar con psql -X -f scripts/preflight-fiabilidad.sql (credencial fuera del comando/log).
-- Segunda tanda: solo si primera completa y novena no registrada en historial.
-- No confundir dinero pendiente/datos reportados con conflictos de instalación:
-- la novena crea tablas vacías y una columna nullable; no migra filas existentes.
-- Requiere el esquema Falta Uno previo o posterior a fiabilidad. No crea objetos.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH historial AS (
 SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN NULL::text
 ELSE (xpath('/table/row/versiones/text()',query_to_xml(
  'select string_agg(version::text,'','' order by version::text) as versiones from supabase_migrations.schema_migrations',false,false,'')))[1]::text END versiones
), fase AS (
 SELECT coalesce('20261006180000'=ANY(string_to_array(versiones,',')),
  to_regclass('public.operaciones_idempotentes') IS NOT NULL AND to_regprocedure('public.historial_paginado(text,text,uuid,timestamptz,uuid,integer,text,date,text)') IS NOT NULL)
  AND NOT coalesce('20261006200000'=ANY(string_to_array(versiones,',')),false) AS segunda_pendiente FROM historial
), relaciones_nuevas(nombre) AS (VALUES
 ('solicitudes_eliminacion'),('archivo_contable'),('ejecuciones_retencion'),
 ('archivo_contable_retencion_idx'),('solicitudes_eliminacion_retencion_idx'),('reportes_retencion_idx'),('conciliaciones_retencion_idx')
), funciones_nuevas(firma) AS (VALUES
 ('public.motivos_no_eliminar(uuid)'),('public.solicitar_eliminacion(uuid)'),
 ('public.guard_obligaciones_eliminacion()'),('public.guard_storage_eliminacion()'),
 ('public.retencion_antes_eliminar_perfil()'),('public.aplicar_retencion(integer)')
), triggers_nuevos(esquema,tabla,nombre) AS (
 SELECT 'public',tabla,'a_guard_eliminacion' FROM unnest(array['canchas','partidos','partido_jugadores','pagos','reservas','movimientos_cancha','retiros']) tabla
 UNION ALL SELECT 'public','profiles','a_retencion_perfil'
 UNION ALL SELECT 'storage','objects','a_guard_eliminacion_storage'
), requisitos_relacion(firma) AS (VALUES
 ('public.profiles'),('public.reportes'),('public.canchas'),('public.partidos'),('public.partido_jugadores'),
 ('public.pagos'),('public.reservas'),('public.movimientos_cancha'),('public.retiros'),('public.conciliaciones_pago'),('storage.objects')
), conflictos AS (
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
  UNION ALL
  SELECT 'retencion_relacion_existente',jsonb_build_object('objeto','public.'||nombre)
  FROM relaciones_nuevas,fase WHERE segunda_pendiente AND to_regclass('public.'||nombre) IS NOT NULL
  UNION ALL
  SELECT 'retencion_tipo_existente',jsonb_build_object('objeto','public.'||nombre)
  FROM unnest(array['solicitudes_eliminacion','archivo_contable','ejecuciones_retencion']) nombre,fase
  WHERE segunda_pendiente AND to_regtype('public.'||nombre) IS NOT NULL
  UNION ALL
  SELECT 'retencion_columna_existente',jsonb_build_object('objeto','public.reportes.desidentificado_at')
  FROM pg_attribute,fase WHERE segunda_pendiente AND attrelid=to_regclass('public.reportes') AND attname='desidentificado_at' AND NOT attisdropped
  UNION ALL
  SELECT 'retencion_funcion_existente',jsonb_build_object('objeto',firma)
  FROM funciones_nuevas,fase WHERE segunda_pendiente AND to_regprocedure(firma) IS NOT NULL
  UNION ALL
  SELECT 'retencion_trigger_existente',jsonb_build_object('objeto',n.esquema||'.'||n.tabla||'.'||n.nombre)
  FROM triggers_nuevos n JOIN pg_trigger t ON t.tgrelid=to_regclass(n.esquema||'.'||n.tabla) AND t.tgname=n.nombre AND NOT t.tgisinternal
  CROSS JOIN fase WHERE segunda_pendiente
  UNION ALL
  SELECT 'retencion_prerrequisito_ausente',jsonb_build_object('objeto',firma)
  FROM requisitos_relacion,fase WHERE segunda_pendiente AND to_regclass(firma) IS NULL
  UNION ALL
  SELECT 'retencion_prerrequisito_ausente',jsonb_build_object('objeto',firma)
  FROM unnest(array['auth.uid()','auth.role()','public.is_admin()']) firma,fase WHERE segunda_pendiente AND to_regprocedure(firma) IS NULL
  UNION ALL
  SELECT 'retencion_prerrequisito_ausente',jsonb_build_object('rol',rol)
  FROM unnest(array['anon','authenticated','service_role']) rol,fase
  WHERE segunda_pendiente AND NOT EXISTS(select 1 from pg_roles where rolname=rol)
), tipos(tipo) AS (VALUES ('reservas_solapadas'),('referencias_duplicadas'),('intervalos_invalidos'),('disponibilidad_invalida'),
 ('retencion_relacion_existente'),('retencion_tipo_existente'),('retencion_columna_existente'),('retencion_funcion_existente'),('retencion_trigger_existente'),('retencion_prerrequisito_ausente'))
SELECT t.tipo,count(c.detalle) AS cantidad,coalesce(jsonb_agg(c.detalle ORDER BY c.detalle::text) FILTER(WHERE c.detalle IS NOT NULL),'[]'::jsonb) AS detalles
FROM tipos t LEFT JOIN conflictos c USING(tipo) GROUP BY t.tipo ORDER BY t.tipo;
COMMIT;
