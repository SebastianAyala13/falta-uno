-- Para SQL Editor, entero, con usuario de base autorizado. Nunca lo ejecutó
-- Codex contra producción. Solo TEMP y ensayos que se deshacen con ROLLBACK.
-- No ejecutar fragmentos ni cambiar el ROLLBACK por COMMIT.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE verificacion_tanda1(nombre text,estado text,detalle text) ON COMMIT DROP;
DO $verificar$
DECLARE versiones text[];aplicadas text[];r record;fn regprocedure;anon_ok boolean;auth_ok boolean;svc_ok boolean;
 tabla text;rel regclass;rls boolean;actor uuid:='a0e00000-0000-4000-a000-000000000005';reserva uuid;pago uuid;
 sentencia text;etiqueta text;n integer;negativas text[];
BEGIN
 versiones:=ARRAY['20260711225940','20260711230642','20260712001946','20260712002743','20260712003321','20260712005302','20260714203828','20260715120000','20260716120000','20261005200000','20261006120000','20261006130000','20261006140000','20261006150000','20261006160000','20261006170000','20261006180000'];
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  INSERT INTO verificacion_tanda1 VALUES('migraciones','falla','No existe historial supabase_migrations.schema_migrations');
 ELSE
  EXECUTE 'select array_agg(version::text order by version::text) from supabase_migrations.schema_migrations' INTO aplicadas;
  INSERT INTO verificacion_tanda1 VALUES('migraciones_17',CASE WHEN aplicadas=versiones THEN 'ok' ELSE 'falla' END,
   'esperadas=17; aplicadas='||coalesce(cardinality(aplicadas),0)||'; versiones='||coalesce(array_to_string(aplicadas,','),'ninguna'));
  FOREACH etiqueta IN ARRAY versiones LOOP
   INSERT INTO verificacion_tanda1 VALUES('migracion.'||etiqueta,CASE WHEN etiqueta=ANY(coalesce(aplicadas,'{}')) THEN 'ok' ELSE 'falla' END,'Solo historial versionado; no prueba que el SQL nunca haya sido alterado');
  END LOOP;
 END IF;
 FOR r IN SELECT * FROM (VALUES
 ('public.inscribirse_partido(uuid,text,text)',false,true,null::boolean),
 ('public.feed_posts(timestamp with time zone,uuid,integer,uuid)',true,true,null::boolean),
 ('public.organizadores_partidos(uuid[])',true,true,null::boolean),
 ('public.set_post_like(uuid,boolean)',false,true,null::boolean),
 ('public.reemplazar_disponibilidad(uuid,jsonb)',false,true,null::boolean),
 ('public.horarios_ocupados(uuid,date)',true,true,null::boolean),
 ('public.saldo_cancha(uuid)',false,true,null::boolean),
 ('public.admin_metricas()',false,true,null::boolean),
 ('public.admin_procesar_retiro(uuid,text,text)',false,true,null::boolean),
 ('public.admin_set_estado_cancha(uuid,text)',false,true,null::boolean),
 ('public.admin_ajuste_saldo(uuid,integer,text)',false,true,null::boolean),
 ('public.admin_suspender_usuario(uuid,boolean)',false,true,null::boolean),
 ('public.admin_resolver_reporte(uuid,text,boolean)',false,true,null::boolean),
 ('public.crear_establecimiento(text,jsonb)',false,true,null::boolean),
 ('public.reservar_con_partido(text,uuid,date,time without time zone,time without time zone,text,jsonb)',false,true,null::boolean),
 ('public.historial_paginado(text,text,uuid,timestamp with time zone,uuid,integer,text,date,text)',false,true,null::boolean),
 ('public.archivos_usuario(uuid)',false,false,true),
 ('public.archivos_reporte(uuid)',false,false,true),
 ('public.caducar_pagos_pendientes(integer)',false,false,true),
 ('public.confirmar_pago_online(text,integer,text,text)',false,false,true),
 ('public.tomar_reembolso()',false,false,true),
 ('public.registrar_reembolso(uuid,uuid,text,text,text)',false,false,true)
 ) esperadas(firma,anon_esperado,auth_esperado,service_esperado) LOOP
  fn:=to_regprocedure(r.firma);
  IF fn IS NULL THEN INSERT INTO verificacion_tanda1 VALUES('rpc.'||r.firma,'falla','Firma ausente');
  ELSE
   anon_ok:=has_function_privilege('anon',fn,'EXECUTE');auth_ok:=has_function_privilege('authenticated',fn,'EXECUTE');svc_ok:=has_function_privilege('service_role',fn,'EXECUTE');
   INSERT INTO verificacion_tanda1 VALUES('rpc.'||r.firma,
    CASE WHEN anon_ok=r.anon_esperado AND auth_ok=r.auth_esperado AND (r.service_esperado IS NULL OR svc_ok=r.service_esperado) THEN 'ok' ELSE 'falla' END,
    format('EXECUTE efectivo anon=%s (esperado %s), authenticated=%s (esperado %s), service_role=%s (%s)',anon_ok,r.anon_esperado,auth_ok,r.auth_esperado,svc_ok,coalesce(r.service_esperado::text,'informativo para RPC de cliente')));
  END IF;
 END LOOP;
 FOREACH tabla IN ARRAY ARRAY['profiles','canchas','cancha_disponibilidad','datos_desembolso','membresias_cancha','reservas','pagos','partidos','partido_jugadores','movimientos_cancha','retiros','posts','post_likes','comentarios','mensajes','calificaciones','bloqueos','reportes','conciliaciones_pago','ejecuciones_caducidad','operaciones_idempotentes'] LOOP
  rel:=to_regclass('public.'||tabla);
  SELECT relrowsecurity INTO rls FROM pg_class WHERE oid=rel;
  INSERT INTO verificacion_tanda1 VALUES('rls.public.'||tabla,CASE WHEN coalesce(rls,false) THEN 'ok' ELSE 'falla' END,'Existe y RLS activo; políticas se ensayan por separado');
 END LOOP;
 rel:=to_regclass('storage.objects');SELECT relrowsecurity INTO rls FROM pg_class WHERE oid=rel;
 INSERT INTO verificacion_tanda1 VALUES('rls.storage.objects',CASE WHEN coalesce(rls,false) THEN 'ok' ELSE 'falla' END,'Storage metadata; no prueba acceso a blobs reales');
 IF NOT EXISTS(select 1 from public.profiles where id=actor and 'jugador'=any(roles) and not 'admin'=any(roles) and not suspendido) THEN
  INSERT INTO verificacion_tanda1 VALUES('actor_demo','falla','Requiere Juan seed UUID a0e00000-0000-4000-a000-000000000005 no admin/no suspendido; no crea cuentas');RETURN;
 END IF;
 SELECT id INTO reserva FROM public.reservas WHERE jugador_id=actor AND estado='pendiente' ORDER BY id LIMIT 1;
 SELECT id INTO pago FROM public.pagos WHERE jugador_id=actor AND estado='pendiente' ORDER BY id LIMIT 1;
 INSERT INTO verificacion_tanda1 VALUES('actor_demo',CASE WHEN reserva IS NOT NULL AND pago IS NOT NULL THEN 'ok' ELSE 'falla' END,'Juan seed UUID '||actor||'; requiere reserva y pago pendientes propios');
 -- Set both Supabase JSON claims and legacy settings for local bootstrap support.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);
 negativas:=ARRAY['confirmar_reserva','cambiar_precio_reserva','ascender_admin','aprobar_pago'];
 FOREACH etiqueta IN ARRAY negativas LOOP
  IF (etiqueta IN ('confirmar_reserva','cambiar_precio_reserva') AND reserva IS NULL) OR (etiqueta='aprobar_pago' AND pago IS NULL) THEN
   INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'falla','Falta fixture propio pendiente; no se considera pasada');CONTINUE;
  END IF;
  sentencia:=CASE etiqueta
   WHEN 'confirmar_reserva' THEN format('update public.reservas set estado=%L where id=%L','confirmada',reserva)
   WHEN 'cambiar_precio_reserva' THEN format('update public.reservas set precio=precio+1 where id=%L',reserva)
   WHEN 'ascender_admin' THEN format('update public.profiles set roles=array_append(roles,%L) where id=%L','admin',actor)
   ELSE format('update public.pagos set estado=%L where id=%L','aprobado',pago) END;
  -- EACH attempt has its own subtransaction. Even an unexpected successful
  -- UPDATE is rolled back immediately before the next attempt, then outer ROLLBACK.
  BEGIN
   EXECUTE 'SET LOCAL ROLE authenticated';
   IF auth.uid() IS DISTINCT FROM actor OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Claims no activas' USING ERRCODE='P7778';END IF;
   EXECUTE sentencia;GET DIAGNOSTICS n=ROW_COUNT;
   RAISE EXCEPTION '%',n USING ERRCODE='P7777';
  EXCEPTION
   WHEN SQLSTATE 'P7777' THEN
    INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'falla','UPDATE aceptado (filas='||SQLERRM||'); incluso cero filas no prueba defensa sobre la fila propia');
   WHEN insufficient_privilege OR check_violation THEN
    INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'ok','Rechazo explícito SQLSTATE='||SQLSTATE||'; intento revertido');
   WHEN raise_exception THEN
    IF (etiqueta='confirmar_reserva' AND SQLERRM='Esta reserva requiere gestión del servidor') THEN
     INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'ok','Trigger rechaza confirmación; intento revertido');
    ELSE INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'falla','Excepción inesperada SQLSTATE='||SQLSTATE||'; sin datos de error');END IF;
   WHEN OTHERS THEN INSERT INTO verificacion_tanda1 VALUES('negativa.'||etiqueta,'falla','Error no clasificable como defensa SQLSTATE='||SQLSTATE||'; sin datos de error');
  END;
 END LOOP;
END $verificar$;
SELECT nombre,estado AS "ok/falla",detalle FROM verificacion_tanda1 ORDER BY nombre;
ROLLBACK;
