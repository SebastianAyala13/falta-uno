-- SQL Editor, sesión de base autorizada; ejecutar COMPLETO. No ejecutar purga.
-- Solo fixtures de ensayo dentro de ROLLBACK. No imprime datos de usuarios,
-- cuerpos contables, comandos cron, claves ni claims. No cambiar a COMMIT.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,pg_catalog;
SET LOCAL row_security=on;
CREATE TEMP TABLE verificacion_tanda2(nombre text,estado text,detalle text) ON COMMIT DROP;
DO $verificar$
DECLARE versiones text[]:=ARRAY['20260711225940','20260711230642','20260712001946','20260712002743','20260712003321','20260712005302','20260714203828','20260715120000','20260716120000','20261005200000','20261006120000','20261006130000','20261006140000','20261006150000','20261006160000','20261006170000','20261006180000','20261006200000'];
 aplicadas text[];r record;fn regprocedure;rel regclass;good boolean;n integer;cantidad integer;sentencia text;etiqueta text;
 actor uuid:='a0e00000-0000-4000-a000-000000000005';ajeno uuid:='a0e00000-0000-4000-a000-000000000001';
 recibo jsonb;motivos jsonb;rls_previo text;solicitud uuid;archivo uuid:=gen_random_uuid();
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  INSERT INTO verificacion_tanda2 VALUES('migraciones_18','falla','Historial ausente');
 ELSE
  EXECUTE 'select array_agg(version::text order by version::text) from supabase_migrations.schema_migrations' INTO aplicadas;
  INSERT INTO verificacion_tanda2 VALUES('migraciones_18',CASE WHEN aplicadas=versiones THEN 'ok' ELSE 'falla' END,'esperadas=18; aplicadas='||coalesce(cardinality(aplicadas),0)||'; versiones='||coalesce(array_to_string(aplicadas,','),'ninguna'));
  INSERT INTO verificacion_tanda2 VALUES('ultima_migracion',CASE WHEN aplicadas[cardinality(aplicadas)]='20261006200000' THEN 'ok' ELSE 'falla' END,'Esperada 20261006200000_retencion_eliminacion');
 END IF;
 FOR r IN SELECT * FROM (VALUES
 ('public.solicitudes_eliminacion','eliminacion_lectura','((usuario_id = auth.uid()) OR is_admin())'),
 ('public.archivo_contable','archivo_contable_admin','(is_admin() OR (titular_vigente = auth.uid()))'),
 ('public.ejecuciones_retencion','retencion_admin','is_admin()')
 ) x(tabla,politica,condicion) LOOP
  rel:=to_regclass(r.tabla);
  INSERT INTO verificacion_tanda2 VALUES('tabla.'||r.tabla,CASE WHEN rel IS NOT NULL AND (SELECT relkind='r' FROM pg_class WHERE oid=rel) THEN 'ok' ELSE 'falla' END,'Tabla persistente esperada');
  INSERT INTO verificacion_tanda2 VALUES('rls.'||r.tabla,CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid=rel) THEN 'ok' ELSE 'falla' END,'RLS debe estar activo');
  SELECT count(*) INTO n FROM pg_policy WHERE polrelid=rel;
  SELECT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=rel AND polname=r.politica AND polcmd='r' AND polpermissive
   AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
   AND pg_get_expr(polqual,polrelid)=r.condicion AND polwithcheck IS NULL) INTO good;
  INSERT INTO verificacion_tanda2 VALUES('politica.'||r.tabla,CASE WHEN good AND n=1 THEN 'ok' ELSE 'falla' END,'SELECT authenticated con condición esperada; total políticas='||n);
  IF rel IS NOT NULL THEN
   good:=has_table_privilege('authenticated',rel,'SELECT') AND has_table_privilege('service_role',rel,'SELECT')
    AND NOT has_table_privilege('anon',rel,'SELECT')
    AND NOT has_table_privilege('authenticated',rel,'INSERT') AND NOT has_table_privilege('authenticated',rel,'UPDATE') AND NOT has_table_privilege('authenticated',rel,'DELETE')
    AND NOT has_table_privilege('anon',rel,'INSERT') AND NOT has_table_privilege('anon',rel,'UPDATE') AND NOT has_table_privilege('anon',rel,'DELETE');
   INSERT INTO verificacion_tanda2 VALUES('permisos.'||r.tabla,CASE WHEN good THEN 'ok' ELSE 'falla' END,'SELECT authenticated/service_role; anon sin lectura; anon/authenticated sin DML');
  END IF;
 END LOOP;
-- baseline grants service_role EXECUTE through postgres default privileges;
 -- ninth revokes PUBLIC/anon/authenticated, not that direct default-privileges grant.
 FOR r IN SELECT * FROM (VALUES
 ('public.motivos_no_eliminar(uuid)',true),('public.solicitar_eliminacion(uuid)',true),
 ('public.guard_obligaciones_eliminacion()',true),('public.guard_storage_eliminacion()',true),
 ('public.retencion_antes_eliminar_perfil()',true),('public.aplicar_retencion(integer)',true)
 ) x(firma,servicio) LOOP
  fn:=to_regprocedure(r.firma);
  IF fn IS NULL THEN INSERT INTO verificacion_tanda2 VALUES('rpc.'||r.firma,'falla','Firma ausente');
  ELSE
   good:=NOT has_function_privilege('anon',fn,'EXECUTE') AND NOT has_function_privilege('authenticated',fn,'EXECUTE') AND has_function_privilege('service_role',fn,'EXECUTE')=r.servicio;
   INSERT INTO verificacion_tanda2 VALUES('rpc.'||r.firma,CASE WHEN good THEN 'ok' ELSE 'falla' END,
    format('EXECUTE efectivo anon=%s authenticated=%s service_role=%s (esperado servicio=%s)',has_function_privilege('anon',fn,'EXECUTE'),has_function_privilege('authenticated',fn,'EXECUTE'),has_function_privilege('service_role',fn,'EXECUTE'),r.servicio));
  END IF;
 END LOOP;
 FOR r IN SELECT * FROM (VALUES
 ('public.canchas','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.partidos','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.partido_jugadores','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.pagos','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.reservas','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.movimientos_cancha','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('public.retiros','a_guard_eliminacion','public.guard_obligaciones_eliminacion()',23),
 ('storage.objects','a_guard_eliminacion_storage','public.guard_storage_eliminacion()',23),
 ('public.profiles','a_retencion_perfil','public.retencion_antes_eliminar_perfil()',11)
 ) x(tabla,trigger_nombre,firma,tipo) LOOP
  SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass(r.tabla) AND tgname=r.trigger_nombre
    AND tgfoid=to_regprocedure(r.firma) AND tgtype=r.tipo AND tgenabled IN ('O','A') AND NOT tgisinternal AND tgqual IS NULL) INTO good;
  INSERT INTO verificacion_tanda2 VALUES('trigger.'||r.tabla||'.'||r.trigger_nombre,CASE WHEN good THEN 'ok' ELSE 'falla' END,'Función, eventos, fila BEFORE y habilitación comprobados');
 END LOOP;
 INSERT INTO verificacion_tanda2 VALUES('columna.reportes.desidentificado_at',CASE WHEN EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.reportes') AND attname='desidentificado_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped) THEN 'ok' ELSE 'falla' END,'timestamptz esperada');
 -- Never print job.command: another cron task may embed credentials.
 IF to_regclass('cron.job') IS NULL THEN
  INSERT INTO verificacion_tanda2 VALUES('purgador_no_programado','ok','cron.job ausente; purgador existe si comprobación RPC es ok');
 ELSE
  BEGIN
   rls_previo:=current_setting('row_security');PERFORM set_config('row_security','off',true);
   EXECUTE 'select count(*) from cron.job where lower(command) like ''%aplicar_retencion%'' or jobname=''faltauno-retencion''' INTO n;
   PERFORM set_config('row_security',rls_previo,true);
   INSERT INTO verificacion_tanda2 VALUES('purgador_no_programado',CASE WHEN n=0 THEN 'ok' ELSE 'falla' END,'Jobs coincidentes (incluye inactivos)='||n||'; no se ejecutó purga');
  EXCEPTION WHEN OTHERS THEN INSERT INTO verificacion_tanda2 VALUES('purgador_no_programado','falla','No se pudo inspeccionar cron; SQLSTATE='||SQLSTATE);END;
 END IF;
 -- Do not call missing/new functions or count absence of a fixture as a pass.
 IF to_regprocedure('public.motivos_no_eliminar(uuid)') IS NULL OR to_regprocedure('public.solicitar_eliminacion(uuid)') IS NULL OR to_regclass('public.archivo_contable') IS NULL OR to_regclass('public.solicitudes_eliminacion') IS NULL OR to_regclass('public.ejecuciones_retencion') IS NULL THEN
  INSERT INTO verificacion_tanda2 VALUES('negativas','falla','Novena incompleta: negativas no ejecutadas');RETURN;
 END IF;
 good:=EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND NOT ('admin'=ANY(roles)) AND NOT suspendido)
  AND EXISTS(SELECT 1 FROM public.profiles WHERE id=ajeno);
 INSERT INTO verificacion_tanda2 VALUES('actor_demo',CASE WHEN good THEN 'ok' ELSE 'falla' END,'Juan seed a0e00000-0000-4000-a000-000000000005; ajeno dueño seed termina 000001');
 IF NOT good THEN INSERT INTO verificacion_tanda2 VALUES('negativas','falla','Falta actor no admin/no suspendido o titular ajeno del seed; no se crean perfiles');RETURN;END IF;
 -- Minimal foreign sentinels, only within outer rollback. No financial rows deleted.
 INSERT INTO public.solicitudes_eliminacion(usuario_id,estado) VALUES(ajeno,'pendiente') ON CONFLICT(usuario_id) DO NOTHING;
 INSERT INTO public.archivo_contable(tipo,origen_id,titular_vigente,datos) VALUES('pago',archivo,ajeno,'{}');
 SELECT id INTO solicitud FROM public.solicitudes_eliminacion WHERE usuario_id=ajeno;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);
 FOREACH etiqueta IN ARRAY ARRAY['leer_solicitud_ajena','leer_archivo_ajeno','insertar_archivo','insertar_ejecucion','rpc_solicitud_directa'] LOOP
  sentencia:=CASE etiqueta
   WHEN 'leer_solicitud_ajena' THEN format('select count(*) from public.solicitudes_eliminacion where id=%L',solicitud)
   WHEN 'leer_archivo_ajeno' THEN format('select count(*) from public.archivo_contable where origen_id=%L',archivo)
   WHEN 'insertar_archivo' THEN 'insert into public.archivo_contable(tipo,origen_id,datos) values (''pago'',gen_random_uuid(),''{}'')'
   WHEN 'insertar_ejecucion' THEN 'insert into public.ejecuciones_retencion(conteos) values (''{}'')'
   ELSE format('select public.solicitar_eliminacion(%L::uuid)',actor) END;
  BEGIN
   EXECUTE 'SET LOCAL ROLE authenticated';
   IF auth.uid() IS DISTINCT FROM actor OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Claims no activas' USING ERRCODE='P7778';END IF;
   IF etiqueta LIKE 'leer_%' THEN EXECUTE sentencia INTO n;ELSE EXECUTE sentencia;n:=1;END IF;
   -- Roll back even an accepted malicious insertion/call before next check.
   RAISE EXCEPTION '%',n USING ERRCODE='P7777';
  EXCEPTION WHEN SQLSTATE 'P7777' THEN
   INSERT INTO verificacion_tanda2 VALUES('negativa.'||etiqueta,CASE WHEN etiqueta LIKE 'leer_%' AND SQLERRM='0' THEN 'ok' ELSE 'falla' END,'Filas visibles/operación aceptada='||SQLERRM||'; intento revertido');
  WHEN insufficient_privilege THEN
   INSERT INTO verificacion_tanda2 VALUES('negativa.'||etiqueta,'ok','Rechazo explícito SQLSTATE=42501; intento revertido');
  WHEN OTHERS THEN INSERT INTO verificacion_tanda2 VALUES('negativa.'||etiqueta,'falla','Excepción inesperada SQLSTATE='||SQLSTATE||'; sin cuerpo de error');
  END;
 END LOOP;
 motivos:=public.motivos_no_eliminar(actor);
 IF motivos='[]'::jsonb THEN INSERT INTO verificacion_tanda2 VALUES('solicitud_pendiente','falla','Seed sin obligación pendiente: prueba no ejecutada; no se considera pasada');RETURN;END IF;
 -- The actual client calls Edge; only its service-role prepares this request.
 -- No EXECUTE granted to player. Simulate that server path, within rollback.
 BEGIN
  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','service_role')::text,true);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  EXECUTE 'select public.solicitar_eliminacion($1)' INTO recibo USING actor;
  RAISE EXCEPTION USING ERRCODE='P7779';
 EXCEPTION WHEN SQLSTATE 'P7779' THEN NULL;
 WHEN OTHERS THEN INSERT INTO verificacion_tanda2 VALUES('solicitud_pendiente','falla','RPC de servidor falló; SQLSTATE='||SQLSTATE);RETURN;
 END;
 -- Above subtransaction deliberately rolled back to restore role. Register in
 -- outer transaction via privileged operator, then verify persisted row and guard.
 recibo:=public.solicitar_eliminacion(actor);
 SELECT count(*) INTO n FROM public.solicitudes_eliminacion s WHERE s.usuario_id=actor AND s.estado='pendiente' AND s.motivos<>'[]'::jsonb;
 INSERT INTO verificacion_tanda2 VALUES('solicitud_pendiente',CASE WHEN n=1 AND recibo->>'lista'='false' THEN 'ok' ELSE 'falla' END,'Solicitud registrada dentro del ensayo; obligación pendiente; se revierte al terminar');
 BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO cantidad FROM public.solicitudes_eliminacion WHERE usuario_id=actor AND estado='pendiente';
  RAISE EXCEPTION USING ERRCODE='P7779';
 EXCEPTION WHEN SQLSTATE 'P7779' THEN
  INSERT INTO verificacion_tanda2 VALUES('solicitud_propia_visible',CASE WHEN cantidad=1 THEN 'ok' ELSE 'falla' END,'Jugador puede consultar su recibo pendiente');
 WHEN OTHERS THEN INSERT INTO verificacion_tanda2 VALUES('solicitud_propia_visible','falla','Lectura propia falló; SQLSTATE='||SQLSTATE);
 END;
 BEGIN
  -- Privileged final Auth cascade exercises retention guard, not ordinary RLS.
  DELETE FROM auth.users WHERE id=actor;GET DIAGNOSTICS n=ROW_COUNT;
  RAISE EXCEPTION '%',n USING ERRCODE='P7777';
 EXCEPTION WHEN check_violation THEN
  INSERT INTO verificacion_tanda2 VALUES('guard_cierre_auth',CASE WHEN SQLERRM='Solicitud de borrado pendiente: liquidar reservas, pagos, saldo y retiros antes de cerrar la cuenta' THEN 'ok' ELSE 'falla' END,'Cascada Auth rechazada SQLSTATE=23514; intento revertido');
 WHEN SQLSTATE 'P7777' THEN INSERT INTO verificacion_tanda2 VALUES('guard_cierre_auth','falla','Cierre aceptado filas='||SQLERRM||'; revertido incluso si tuvo éxito');
 WHEN OTHERS THEN INSERT INTO verificacion_tanda2 VALUES('guard_cierre_auth','falla','Excepción inesperada SQLSTATE='||SQLSTATE);
 END;
 INSERT INTO verificacion_tanda2 VALUES('cuenta_y_solicitud_conservadas',CASE WHEN EXISTS(SELECT 1 FROM auth.users WHERE id=actor) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) AND EXISTS(SELECT 1 FROM public.solicitudes_eliminacion WHERE usuario_id=actor AND estado='pendiente') THEN 'ok' ELSE 'falla' END,'Auth, perfil y solicitud siguen presentes tras intento de cierre; rollback final pendiente');
END $verificar$;
SELECT nombre,estado AS "ok/falla",detalle FROM verificacion_tanda2 ORDER BY nombre;
ROLLBACK;
