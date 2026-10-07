\set ON_ERROR_STOP on
-- Ejecutar con psql -X -f scripts/preflight-fiabilidad.sql (credencial fuera del comando/log).
-- Segunda tanda: solo si primera completa y novena no registrada en historial.
-- Conciliación: solo si novena completa y 20261007120000 no registrada.
-- Los objetos compatibles del antiguo instalador NO bloquean su incorporación
-- al historial. conciliacion_inventario siempre tiene cantidad=0: detalles son
-- metadatos para comprobar presencia/ausencia, nunca filas ni valores de Vault.
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
  AND NOT coalesce('20261006200000'=ANY(string_to_array(versiones,',')),false) AS segunda_pendiente,
  coalesce('20261006200000'=ANY(string_to_array(versiones,',')),
   to_regclass('public.archivo_contable') IS NOT NULL AND to_regprocedure('public.aplicar_retencion(integer)') IS NOT NULL)
  AND NOT coalesce('20261007120000'=ANY(string_to_array(versiones,',')),false) AS conciliacion_pendiente FROM historial
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
), conciliacion_objetos AS (
 SELECT to_regclass('public.ejecuciones_conciliacion') AS relacion,
        to_regclass('public.conciliacion_ejecuciones_fecha_idx') AS indice
), conciliacion_columnas(nombre,tipo,obligatoria) AS (VALUES
 ('id','uuid'::regtype,true),('request_id','bigint'::regtype,false),
 ('encolada_at','timestamptz'::regtype,true),('terminada_at','timestamptz'::regtype,false),
 ('estado','text'::regtype,true),('http_status','integer'::regtype,false),
 ('pagos_liberados','integer'::regtype,false),('reservas_liberadas','integer'::regtype,false),
 ('reembolso_estado','text'::regtype,false),('error_codigo','text'::regtype,false)
), conciliacion_columnas_actuales AS (
 SELECT a.attname,a.atttypid,a.attnotnull,a.attgenerated,a.attidentity,d.adbin
 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 CROSS JOIN conciliacion_objetos o
 WHERE a.attrelid=o.relacion AND a.attnum>0 AND NOT a.attisdropped
), conciliacion_rpc(firma,retorno) AS (VALUES
 ('public.observar_conciliacion()','void'::regtype),
 ('public.encolar_conciliacion()','bigint'::regtype),
 ('public.estado_conciliacion()','jsonb'::regtype)
), conciliacion_inventario AS (
 SELECT jsonb_build_object('objeto','public.ejecuciones_conciliacion','existe',o.relacion IS NOT NULL,
  'tipo',CASE WHEN c.oid IS NULL THEN NULL ELSE c.relkind::text END) AS detalle
 FROM conciliacion_objetos o LEFT JOIN pg_class c ON c.oid=o.relacion CROSS JOIN fase
 WHERE conciliacion_pendiente
 UNION ALL
 SELECT jsonb_build_object('objeto','public.conciliacion_ejecuciones_fecha_idx','existe',o.indice IS NOT NULL,
  'tipo',CASE WHEN c.oid IS NULL THEN NULL ELSE c.relkind::text END)
 FROM conciliacion_objetos o LEFT JOIN pg_class c ON c.oid=o.indice CROSS JOIN fase
 WHERE conciliacion_pendiente
 UNION ALL
 SELECT jsonb_build_object('objeto',r.firma,'existe',p.oid IS NOT NULL,
  'tipo',p.prokind::text,'retorno',CASE WHEN p.oid IS NULL THEN NULL ELSE p.prorettype::regtype::text END)
 FROM conciliacion_rpc r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.firma) CROSS JOIN fase
 WHERE conciliacion_pendiente
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
  UNION ALL
  SELECT 'conciliacion_tipo_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion','tipo',t.typtype::text)
  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace CROSS JOIN conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND n.nspname='public' AND t.typname='ejecuciones_conciliacion'
    AND (o.relacion IS NULL OR t.typrelid IS DISTINCT FROM o.relacion)
  UNION ALL
  SELECT 'conciliacion_relacion_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion','tipo',c.relkind::text)
  FROM conciliacion_objetos o JOIN pg_class c ON c.oid=o.relacion CROSS JOIN fase
  WHERE conciliacion_pendiente AND c.relkind<>'r'
  UNION ALL
  SELECT 'conciliacion_columna_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion.'||coalesce(e.nombre,a.attname),
    'existe',a.attname IS NOT NULL,'tipo_esperado',e.tipo::text,'tipo_actual',a.atttypid::regtype::text,
    'obligatoria',a.attnotnull,'tiene_default',a.adbin IS NOT NULL)
  FROM conciliacion_columnas e FULL JOIN conciliacion_columnas_actuales a ON a.attname=e.nombre
  CROSS JOIN conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND o.relacion IS NOT NULL AND (
    a.attname IS NULL
    OR (e.nombre IS NULL AND a.attnotnull AND a.adbin IS NULL AND a.attgenerated='' AND a.attidentity='')
    OR (e.nombre IS NOT NULL AND (a.atttypid<>e.tipo OR a.attnotnull<>e.obligatoria OR a.attgenerated<>'' OR a.attidentity<>'')))
  UNION ALL
  SELECT 'conciliacion_default_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion.'||e.nombre,'default_esperado',e.expresion)
  FROM (VALUES('id','gen_random_uuid()'),('encolada_at','clock_timestamp()')) e(nombre,expresion)
  CROSS JOIN conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND o.relacion IS NOT NULL AND (
    SELECT regexp_replace(pg_get_expr(d.adbin,d.adrelid),'(pg_catalog|public)\.','','g')
    FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
    WHERE d.adrelid=o.relacion AND a.attname=e.nombre
  ) IS DISTINCT FROM e.expresion
  UNION ALL
  SELECT 'conciliacion_restriccion_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion','requiere',e.nombre)
  FROM (VALUES('primary_key_id','p','id'),('unique_request_id','u','request_id')) e(nombre,tipo,columna)
  CROSS JOIN conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND o.relacion IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid=o.relacion AND c.contype=e.tipo::"char"
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=o.relacion AND attname=e.columna)]::smallint[])
  UNION ALL
  SELECT 'conciliacion_restriccion_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion','requiere','check_estados_encolada_ok_fallida_sin_respuesta')
  FROM conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND o.relacion IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid=o.relacion AND c.contype='c' AND c.convalidated
      AND regexp_replace(pg_get_expr(c.conbin,c.conrelid),'[[:space:]()]','','g') LIKE 'estado=ANYARRAY[%'
      AND ARRAY(SELECT literal[1] FROM regexp_matches(pg_get_expr(c.conbin,c.conrelid),'''([^'']*)''::text','g') literal ORDER BY literal[1])
          =ARRAY['encolada','fallida','ok','sin_respuesta'])
  UNION ALL
  SELECT 'conciliacion_politica_incompatible',jsonb_build_object('objeto','public.ejecuciones_conciliacion','politica',p.polname,'requiere','revision_lectura_permisiva_adicional')
  FROM pg_policy p CROSS JOIN conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND p.polrelid=o.relacion AND p.polname<>'conciliacion_ejecuciones_admin'
    AND p.polpermissive AND p.polcmd IN ('r','*')
    AND p.polroles && ARRAY[0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
    AND regexp_replace(coalesce(pg_get_expr(p.polqual,p.polrelid),'true'),'[[:space:]()]|public\.','','g') NOT IN ('is_admin','false')
  UNION ALL
  SELECT 'conciliacion_indice_incompatible',jsonb_build_object('objeto','public.conciliacion_ejecuciones_fecha_idx','requiere','btree_encolada_at_desc_valido_no_unico_sin_expresion_predicado_include')
  FROM conciliacion_objetos o CROSS JOIN fase
  WHERE conciliacion_pendiente AND o.indice IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam
    WHERE i.indexrelid=o.indice AND i.indrelid=o.relacion AND c.relkind='i' AND am.amname='btree'
      AND i.indisvalid AND i.indisready AND NOT i.indisunique
      AND i.indnkeyatts=1 AND i.indnatts=1 AND i.indexprs IS NULL AND i.indpred IS NULL
      AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid=o.relacion AND attname='encolada_at')
      AND (i.indoption[0] & 1)=1)
  UNION ALL
  SELECT 'conciliacion_rpc_incompatible',jsonb_build_object('objeto',r.firma,'tipo',p.prokind::text,'retorno_actual',p.prorettype::regtype::text,
    'retorno_esperado',r.retorno::text,'retorna_conjunto',p.proretset)
  FROM conciliacion_rpc r JOIN pg_proc p ON p.oid=to_regprocedure(r.firma) CROSS JOIN fase
  WHERE conciliacion_pendiente AND (p.prokind<>'f' OR p.proretset OR p.prorettype<>r.retorno)
  UNION ALL
  SELECT 'conciliacion_prerrequisito_ausente',jsonb_build_object('objeto','public.is_admin()')
  FROM fase WHERE conciliacion_pendiente AND to_regprocedure('public.is_admin()') IS NULL
  UNION ALL
  SELECT 'conciliacion_prerrequisito_ausente',jsonb_build_object('rol',rol)
  FROM unnest(array['anon','authenticated','service_role']) rol CROSS JOIN fase
  WHERE conciliacion_pendiente AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=rol)
), tipos(tipo) AS (VALUES ('reservas_solapadas'),('referencias_duplicadas'),('intervalos_invalidos'),('disponibilidad_invalida'),
 ('retencion_relacion_existente'),('retencion_tipo_existente'),('retencion_columna_existente'),('retencion_funcion_existente'),('retencion_trigger_existente'),('retencion_prerrequisito_ausente'),
 ('conciliacion_tipo_incompatible'),('conciliacion_relacion_incompatible'),('conciliacion_columna_incompatible'),('conciliacion_default_incompatible'),
 ('conciliacion_restriccion_incompatible'),('conciliacion_politica_incompatible'),('conciliacion_indice_incompatible'),('conciliacion_rpc_incompatible'),('conciliacion_prerrequisito_ausente'))
SELECT tipo,cantidad,detalles FROM (
 SELECT t.tipo,count(c.detalle) AS cantidad,coalesce(jsonb_agg(c.detalle ORDER BY c.detalle::text) FILTER(WHERE c.detalle IS NOT NULL),'[]'::jsonb) AS detalles
 FROM tipos t LEFT JOIN conflictos c USING(tipo) GROUP BY t.tipo
 UNION ALL
 SELECT 'conciliacion_inventario',0,coalesce(jsonb_agg(detalle ORDER BY detalle::text),'[]'::jsonb) FROM conciliacion_inventario
) resultado ORDER BY tipo;
COMMIT;
