# Fase 7: activar y comprobar los dos horarios

Para Valen, desde Windows y el panel de Supabase, sin terminal. Actualizado el 6 de octubre de 2026, hora de Colombia. **No ejecutado por Codex contra producción.** Estado informado: novena aplicada (18 migraciones, Actions #9), delete-user nuevo redesplegándose y merge del PR pendiente. **Antes de seguir esta fase, el responsable debe aplicar por el workflow la migración `20261007120000_conciliacion_programada.sql`: primero ensayo y después aplicar.** Eso lleva el historial a 19 migraciones. No pegar esa migración en SQL Editor ni asumir que existe por estar en el repositorio. Confirmar que terminó el despliegue y que se habilita esta fase en el proyecto correcto. Tener respaldo y responsable disponible. Si se está actualizando una configuración que ya tiene jobs activos, usar primero la pausa del paso 9 antes de cambiar la clave; así no quedan llamadas con las dos copias distintas. No habilitar pagos online ni reembolsos reales para esta prueba.

⚠️ significa que una operación puede causar cambios que no se deshacen pausando el horario. Guardar evidencia solo de nombres, fechas, estados y conteos; nunca de valores de secretos, cabeceras o datos de jugadores. **Valen aprobó el 6 de octubre los plazos: 10 años para archivo contable y 90 días para reportes y recibos. El paso 7 ya no está bloqueado por esa aprobación.** Siguen siendo necesarios el respaldo y la migración 19 antes de continuar.

## 1. Generar una clave fuerte en Windows

1. Usar un gestor de contraseñas privado. Si ya usás Bitwarden, abrir **Generador → Contraseña**. Otra opción local para Windows es **KeePassXC**, instalador oficial de [keepassxc.org](https://keepassxc.org/): abrir una base de contraseñas privada y protegida, crear una entrada llamada “Falta Uno · conciliación · proyecto correspondiente”.
2. En KeePassXC, abrir el generador del campo contraseña (icono de dado; también Herramientas → Generador de contraseñas). Elegir **64 caracteres**, con mayúsculas, minúsculas y números, y generar al azar. En Bitwarden usar esos mismos ajustes. No usar frase elegida por vos, contraseña de cuenta, token de Supabase ni una clave de ejemplo de internet.
3. Guardarla **solo en el gestor**, no en este documento, chat, captura, archivo de texto ni SQL Editor. Mantener abierta la entrada: se copiará el mismo valor dos veces. Antes de copiar, en Windows **Configuración → Sistema → Portapapeles**, desactivar historial y sincronización entre dispositivos. Si había entradas sensibles, eliminarlas de Win+V. No hacer grabación de pantalla mientras se pega.

## 2. Cargar la clave en Edge Functions

1. Abrir el proyecto autorizado en [Supabase Dashboard](https://supabase.com/dashboard). Verificar su nombre: no confundir ensayo con producción.
2. Menú **Edge Functions → Secrets → Add secret / Add new secret**. Nombre exacto: **CONCILIACION_JOB_SECRET**. En Value pegar desde el gestor. Guardar con Save/Add. Si el nombre ya existe, actualizarlo, no crear otro con espacios o distinto uso de mayúsculas.
3. Abrir **Edge Functions → conciliar-pagos → Details/Settings** y confirmar que **Verify JWT está desactivado para esta función**: el job usa su clave exclusiva, no JWT de usuario. No quitar JWT de delete-user ni de moderar-contenido. No utilizar Invoke con credenciales en capturas.
4. Copiar la **URL de la función** que muestra el panel, terminada en `/functions/v1/conciliar-pagos`. Debe ser `https://REFERENCIA-DEL-PROYECTO.supabase.co/functions/v1/conciliar-pagos`, la del mismo proyecto; no la URL del sitio web ni una URL de desarrollo local. La referencia real sustituye el texto de ejemplo; este ejemplo no se pega literalmente.

## 3. Cargar en Vault la misma clave y la URL

1. Abrir **Vault** en el menú del proyecto (según versión del panel, bajo Database o Integrations) → **Secrets → Add/Create secret**. Si no aparece Vault o no permite crear un secreto, detenerse y pedir al responsable que habilite esa pantalla; no reemplazar este paso pegando la clave en SQL Editor o en Table Editor.
2. Crear **faltauno_conciliacion_secret**. En Secret/Value pegar de nuevo **la misma entrada del gestor**, sin regenerar ni escribirla a mano. Guardar. Si ya existe, editar esa entrada; no dejar dos con el mismo nombre.
3. Crear **faltauno_conciliacion_url**. En Secret/Value pegar la URL de la función copiada en el paso 2. Guardar. No abrir ni exportar la vista `vault.decrypted_secrets` para comprobarlo.
4. Borrar la copia del portapapeles (copiar un texto inofensivo y eliminar la entrada de Win+V si se hubiera registrado). Conservar la clave en el gestor privado, por si hace falta corregir el valor en uno de los dos lugares.

## 4. Mantener desactivadas las devoluciones reales

Volver a **Edge Functions → Secrets**, localizar **RAPYD_REEMBOLSOS_ACTIVOS** y dejar su valor exactamente **false**, o confirmar que no existe. Si ya está en true, poner false y guardar antes de continuar. No activar este valor ni pagos online por ver un resultado 200. Las devoluciones pendientes seguirán pendientes: eso es esperado y requiere un responsable de pagos, no borrarlas.

## 5. Activar extensiones y comprobar requisitos

1. **Database → Extensions**: buscar **pg_cron**. Si está desactivada, Enable y aceptar los valores predeterminados del panel. Repetir con **pg_net**. Si ya están activas, no desinstalarlas ni reinstalarlas. Vault debe estar disponible por el paso 3; si pide habilitar su integración, hacerlo en esa interfaz. Si el panel indica reinicio o acceso insuficiente, detener este proceso y avisar al responsable.
2. Abrir **SQL Editor → New query**. Pegar el bloque completo siguiente y pulsar **Run**. Usar una sesión administrativa de base, no una credencial de jugador. No compartir enlaces públicos a consultas.

<!-- SQL: requisitos -->
```sql
BEGIN READ ONLY;
SELECT requisito,resultado FROM (
 SELECT 'cron'::text AS requisito,(to_regclass('cron.job') IS NOT NULL)::text AS resultado
 UNION ALL SELECT 'pg_net',(to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL)::text
 UNION ALL SELECT 'vault',(to_regclass('vault.decrypted_secrets') IS NOT NULL)::text
 UNION ALL SELECT 'novena',(to_regprocedure('public.aplicar_retencion(integer)') IS NOT NULL)::text
 UNION ALL SELECT 'migracion_19',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261007120000')::text
 UNION ALL SELECT 'conciliacion_tabla_y_rpc',(to_regclass('public.ejecuciones_conciliacion') IS NOT NULL AND to_regprocedure('public.observar_conciliacion()') IS NOT NULL AND to_regprocedure('public.encolar_conciliacion()') IS NOT NULL AND to_regprocedure('public.estado_conciliacion()') IS NOT NULL)::text
 UNION ALL SELECT 'conciliacion_rls',coalesce((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.ejecuciones_conciliacion')),false)::text
 UNION ALL SELECT 'faltauno_conciliacion_secret',count(*)::text FROM vault.secrets WHERE name='faltauno_conciliacion_secret'
 UNION ALL SELECT 'faltauno_conciliacion_url',count(*)::text FROM vault.secrets WHERE name='faltauno_conciliacion_url'
 UNION ALL SELECT 'zona_cron',coalesce(current_setting('cron.timezone',true),'NO_CONFIRMADA')
 UNION ALL SELECT 'historial_cron',coalesce(current_setting('cron.log_run',true),'NO_CONFIRMADO')
) requisitos ORDER BY requisito;
COMMIT;
```

Devuelve **once filas** en una sola tabla. cron/pg_net/vault/novena/migracion_19/conciliacion_tabla_y_rpc/conciliacion_rls deben mostrar true; los dos nombres Vault deben mostrar **1** cada uno; zona_cron debe mostrar UTC/GMT/Etc/UTC e historial_cron debe mostrar on. Si falta migracion_19 o las piezas de conciliación, detenerse y pedir al responsable que complete el workflow; no usar un instalador anterior que creaba esas piezas desde el editor. Si zona/historial no está confirmado o es diferente, no adivinar: el responsable debe comprobar la configuración efectiva antes de seguir. **No cambies la zona del cron:** afectaría otros horarios del proyecto. Si falta la vista Vault o cualquier requisito y aparece error, detenerse, no empezar con horarios.

## 6. Instalar el horario de conciliación

**⚠️ Al confirmar este bloque queda activo el job cada minuto.** Liberará pagos/reservas online ya vencidos: cambia estados históricos y libera plazas/turnos. Pausarlo no vuelve a reservar esos lugares. Verificar respaldo y autorización antes de Run.

En SQL Editor → New query, pegar **todo** este bloque y Run. Corresponde al nuevo programar_conciliacion.sql: solo comprueba requisitos y programa el job; la tabla, RLS, índices, funciones y permisos ya deben venir de la migración 19 aplicada por el workflow. No crea esas piezas desde el editor. No escribir secretos dentro del bloque. Si el archivo descargado contiene una línea `\set`, omitirla: pertenece a terminal y no sirve en el editor. Si aparece error, no continuar con retención; usar la pausa del paso 9 si ya había un job previo.

<!-- SQL: programar_conciliacion -->
```sql
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
```

Si termina sin error, comprobar la fila 01_jobs del paso 8; no depende de que el editor muestre el identificador numérico o COMMIT. Repetir el instalador actualiza el mismo nombre, pero **no repetir para provocar ejecuciones**: esperar los ciclos normales. No pegar en SQL Editor `public.encolar_conciliacion()` ni `caducar_pagos_pendientes()` para “probar”.

## 7. Instalar el horario diario de retención

**Los plazos ya están aprobados por Valen desde el 6 de octubre: 10 años para archivo contable y 90 días para reportes y recibos.** Este paso no está bloqueado por una aprobación pendiente de plazos. Antes de Run, comprobar que se cumplieron los requisitos anteriores, que el respaldo está disponible y que el proyecto es el correcto.

**⚠️ La próxima ejecución diaria puede desidentificar evidencia huérfana y borrar definitivamente reportes de más de 90 días, archivo contable vencido de 10 años, recibos completados vencidos, devoluciones ya reembolsadas antiguas y logs viejos.** No borra obligaciones pendientes para hacer pasar nada. Pausar después no restaura lo que ya se borró. Datos demo de julio podrían ya superar 90 días; no asumir que la primera ejecución será vacía.

SQL Editor → New query, pegar todo y Run:

<!-- SQL: programar_retencion -->
```sql
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
```

No ejecuta la purga al pegarlo; la programa a **03:15 Bogotá cada día**, solo si cron está en UTC/GMT como se comprobó. No llamar `aplicar_retencion` manualmente. El verificador de tanda 2 comprueba exactamente 18 migraciones: corresponde al momento anterior a la 19. Después de aplicar la 19, sus comprobaciones de cantidad/última migración ya no representan esta fase; usar los requisitos de 19 del paso 5. También esperaba purgador SIN cron: después de este paso esa comprobación falla deliberadamente; no significa que se rompió la migración.

## 8. Comprobar los primeros tres ciclos

Crear otra consulta de SQL Editor y pegar el bloque siguiente. Ejecutarlo al terminar cada uno de los **primeros tres minutos de cron**, anotando la hora Bogotá. No se cuentan tres clics en Run como tres ciclos: esperar a que avance el horario. Solo lee datos; no provoca pagos, vencimientos ni purga.

<!-- SQL: verificar_conciliacion -->
```sql
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
```

Devuelve **seis filas**, columnas comprobacion y resultado. Abrir/expandir el JSON de resultado en el panel si está recortado; no consultar secretos para entenderlo.

| Fila | Qué debe mostrar |
|---|---|
| 01_jobs | Una sola entrada por cada nombre: faltauno-conciliacion, `* * * * *`, active true; y faltauno-retencion, `15 8 * * *`, active true después del paso 7. Los plazos están aprobados: si no se ejecutó ese paso por otro bloqueo, anotar ese bloqueo concreto; no declarar que retención está activa. |
| 02_estado | ultimo_ok, alarma, última ejecución y conteos. Al principio ultimo_ok puede ser null. ultima_ejecucion suele ser **encolada** porque el job acaba de iniciar la petición nueva: mirar también el historial de fila 03. |
| 03_ultimas_conciliaciones | Primera petición encolada; después filas ok con http_status 200, pagos_liberados/reservas_liberadas enteros no negativos y reembolso_estado **desactivados**. No necesita haber liberados: cero es válido si no había vencidos. |
| 04_historial_cron | Ejecuciones recientes de faltauno-conciliacion con status **succeeded**. Ese estado prueba que el cron corrió, no que Edge respondió bien. Retención no tiene por qué aparecer antes de la primera 03:15. |
| 05_devoluciones | Conteos por estado; [] si no hay deudas. Pendiente/revisión no se solucionan al activar el horario con reembolsos apagados. |
| 06_ultima_retencion | null hasta su primera ejecución, salvo historial previo. Después aparece hora y conteos de archivo/reportes/solicitudes/devoluciones; no llamar a purga manual para forzar esta fila. |

En instalación nueva, con respuesta HTTP que llega antes del minuto siguiente y sin fallos:

| Momento | Filas en 03, más reciente primero | 02_estado / 04_historial_cron |
|---|---|---|
| Después del ciclo 1 | 1 encolada, http_status/conteos null | ultimo_ok null y alarma true esperables; 1 cron succeeded. |
| Después del ciclo 2 | 1 encolada nueva + 1 ok 200 del ciclo 1 | ultimo_ok reciente; 2 cron succeeded. |
| Después del ciclo 3 | 1 encolada nueva + 2 ok 200 de ciclos 1 y 2 | ultimo_ok reciente; 3 cron succeeded. |

Los conteos exactos pueden variar si había historial o respuesta lenta. Si aún hay petición encolada reciente, el job espera y no duplica otra durante dos minutos. Pasados más de dos minutos sin respuesta, el siguiente observador informa sin_respuesta/HTTP_AUSENTE. No exigir tres filas ok en los primeros tres ciclos. **Si para el tercer ciclo no hay ningún ok reciente, pausar y revisar.** Una alarma true puede persistir aun con ok por atrasos, devolución en revisión o deuda de más de 15 minutos: no declarar sano todo el sistema por un HTTP 200.

| Si aparece esto | Qué hacer desde el panel |
|---|---|
| No hay job o active false | Pausar avance. Revisar que se pegó completo y en el proyecto correcto; conservar error redactado para el responsable. |
| No hay historial cron reciente | No declarar que corrió. Comprobar extensiones y logs de Cron; pedir al responsable revisar registro/worker. |
| CONFIGURACION_AUSENTE_O_INVALIDA | Revisar nombres únicos en Vault y URL exacta; pegar nuevamente desde el gestor el mismo secreto en Edge y Vault. Nunca mostrarlo. |
| HTTP 401/403 | Revisar Verify JWT de conciliar y coincidencia de claves. No quitar la comprobación de CONCILIACION_JOB_SECRET ni JWT de otras funciones. |
| fallida, HTTP 500 o HTTP_O_RESPUESTA_INVALIDA | Pausar. Edge Functions → conciliar-pagos → Logs: registrar solo hora y mensaje genérico; no enviar tokens/cuerpos. Responsable revisa despliegue y RPC. |
| sin_respuesta / HTTP_AUSENTE | Pausar y revisar pg_net/Logs con responsable. No reenviar a ciegas una devolución. |
| estado null en fila 02 o error de permisos | Abrir sesión administrativa autorizada del proyecto; no conceder acceso público. |
| alarma true con ok y deuda/revisión | Asignar revisión humana; no poner pagos/retiros/devoluciones en aprobado/reembolsado a mano ni activar Rapyd para quitar alarma. |

Al final anotar proyecto, hora de instalación, tres horas observadas, si hubo ok, conteos, deuda/revisión y decisión seguir/parar. No copiar filas con datos personales. Este SQL muestra alarma, **no manda avisos**: sigue pendiente un monitor externo y una persona que lo atienda.

## 9. Pausa de emergencia en una línea

SQL Editor → New query → pegar esta única línea → Run. Desactiva **los dos jobs por nombre**, sin borrar sus historiales:

<!-- SQL: pausa -->
```sql
SELECT cron.alter_job(job_id := jobid, active := false) FROM cron.job WHERE jobname IN ('faltauno-conciliacion','faltauno-retencion');
```

Después correr de nuevo paso 8: ambos deben mostrar active false si existían. **No cancela una ejecución ya iniciada ni un HTTP ya encolado, y no deshace purgas, liberaciones o reembolsos ya hechos.** Si reembolsos estuvieran activos, dejar RAPYD_REEMBOLSOS_ACTIVOS false en Secrets y avisar al responsable. No reactivar hasta resolver la causa de la pausa y confirmar con el responsable; repetir instaladores puede reactivar los jobs. Conservar evidencia y no borrar jobs para esconder un fallo.

## Evidencia y límites

El ensayo actualizado de tests/fase7_editor.py pasó 14 controles con 19 migraciones: bloques idénticos a scripts sin línea psql, requisitos de 19, paso 6 sin cambios de esquema, instalación sin purga inmediata, dos horarios, tres ciclos simulados, verificador sin secretos y pausa de ambos. Resultado: fase7-editor-local-2026-10-06.json; evidencia de idempotencia/colisiones de migración en conciliacion-migracion19-local-2026-10-06.json y ESTADO-CODEX.md. Vault, cron y HTTP se simulan con dobles de SQL: ese ensayo no prueba worker, panel ni Edge HTTP real. La interfaz actual del panel y el generador de Windows no se pudieron recorrer aquí; si los rótulos difieren, detenerse ante dudas de proyecto o campos, no pegar secretos en consultas como sustituto.
