# Comprobar conciliación después del despliegue

Para la persona responsable de operación. Este procedimiento está preparado y sus consultas ensayadas con PostgreSQL aislado y dobles de servicios. **No se ejecutó un cron ni un pago de Supabase/Rapyd real.** No ejecutar en producción sin el freno manual del responsable; primero hacerlo en staging con datos sintéticos.

## Antes de activar el horario

1. Confirmá en el panel el proyecto correcto y anotá su nombre público, la hora Bogotá y quién autorizó. Confirmá las migraciones previas, la nueva de retención si se usa delete-user, **20261007120000_conciliacion_programada.sql (19) aplicada por workflow**, extensiones pg_cron/pg_net/Vault y despliegue de conciliar-pagos. La tabla/RPC de observación vienen de esa migración; el instalador del horario ya no crea esquema.
2. Verificá **solo presencia**, sin copiar valores: CONCILIACION_JOB_SECRET en Edge; faltauno_conciliacion_secret en Vault debe coincidir; faltauno_conciliacion_url debe apuntar a esa función, en ese proyecto. La allowlist solo admite HTTPS de proyecto supabase.co. No pegues secretos en editor SQL, consola, chat o documento, ni actives trazas HTTP.
3. La función usa una clave exclusiva del job, **no un JWT de usuario**. La verificación JWT del gateway debe estar desactivada **solo en conciliar-pagos** para que llegue a su comprobación de secreto propio; si no, el gateway rechaza con 401 aunque coincidan los secretos. No desactivar JWT en delete-user ni otras funciones. Esta configuración no se probó contra el gateway real: verificá con el primer ciclo y prueba negativa de staging. Una petición sin clave debe ser 401, GET 405; no debe ejecutar caducidad.
4. Mantener RAPYD_REEMBOLSOS_ACTIVOS desactivado hasta certificar sandbox y acordar autorización de activación. Un job puede liberar vencimientos con reembolsos desactivados, pero eso **no demuestra devoluciones funcionando**. No habilitar pagos reales para ensayar.
5. Registrá un conteo inicial, sin datos personales:

```sql
select count(*) as pagos_vencidos from public.pagos
 where medio='online' and estado='pendiente' and caduca_at<now();
select count(*) as reservas_vencidas from public.reservas
 where medio='online' and estado='pendiente' and caduca_at<now();
select estado,count(*) from public.conciliaciones_pago group by estado;
```

6. Con autorización, instalá el horario preparado en scripts/db/programar_conciliacion.sql. Ejecutarlo **actualiza/crea** el job; este documento no lo ejecuta. Cada minuto se justifica por la retención de turnos/plazas de hasta 15 minutos y por observar resultados del ciclo previo. No es garantía de liberación al minuto exacto.

## Qué consultar y qué significa

En SQL Editor con sesión de base autorizada, corré scripts/db/verificar_conciliacion.sql (para SQL Editor copiá las consultas, sin la línea de psql `\set`). Es solo lectura; no llama encolar_conciliacion ni caducar_pagos_pendientes. Muestra horas Bogotá, estado del job, última petición/éxito, conteos y fallos genéricos, sin secretos. Si el estado sale NULL por un usuario no admin, usá la sesión administrativa autorizada, no publiques un acceso anónimo para sortearlo.

| Señal | Resultado esperado | Si no ocurre |
|---|---|---|
| cron.job | Un solo faltauno-conciliacion, active true, * * * * * | No instalado/inactivo/duplicado: parar avance y corregir el horario |
| job_run_details | Ejecuciones recientes por minuto | Si logging está deshabilitado, habilitarlo/establecer auditoría; sin evidencia no declarar cron corrido |
| ultima_ejecucion | Primero encolada; luego ok con http_status 200 y conteos | Cron success solo encoló: no prueba respuesta Edge |
| ultimo_ok | Avanza con ciclos exitosos | Sin éxito reciente: alarma; revisar fallo de transporte/clave/gateway |
| pagos_liberados / reservas_liberadas | Enteros no negativos, 0 si no hay vencimientos | Deben corresponder a vencimientos, no a borrado de pagos ni devolución efectuada |
| devoluciones_pendientes / revision | Visibles aunque el heartbeat sea ok | No marcar verde completo si hay deuda envejecida o revisión manual |
| pendientes_vencidos | Bajan entre ciclos si hay backlog | Si no bajan, revisar caducidad, errores, capacidad y lote; no limpiar filas para bajar el contador |

Esperá y observá **tres ciclos** usando el panel; no lances peticiones de pago repetidas desde terminal. Una llamada HTTP se ejecuta después de confirmar la transacción del job. El observador suele registrar su resultado al siguiente ciclo. Compará conteo inicial, últimas filas de ejecuciones_conciliacion y ejecuciones_caducidad (hora y cantidad); no deduzcas una devolución de un HTTP 200.

## Primera ejecución con datos existentes

- Las migraciones fijan fechas originales de caducidad, no conceden otros 15 minutos a todo lo viejo. Puede haber muchas plazas/turnos pendientes ya vencidos. El job procesa **hasta 100 pagos y 100 reservas por llamada**; conserva la fila histórica y libera la ocupación. El lote es un límite de trabajo, no capacidad garantizada por minuto.
- Con devoluciones desactivadas: reembolso_estado = desactivados; es esperado que las deudas permanezcan. No es una prueba de devolución ni autorización para activar compras online.
- Con devoluciones activadas **en sandbox certificado**: intenta como máximo una deuda por llamada. sin_pendientes solo significa que no tomó una elegible, no que nunca existan deudas (pueden estar en revisión o con lease vigente). proveedor_pendiente significa que falta confirmación; reembolsado solo tras respuesta coincidente y completada del PSP. Error/resultado ambiguo queda en revision_manual: verificar en PSP antes de otro intento. Nunca resolverlo cambiando estado a mano sin evidencia.
- Si la primera tanda tiene muchas expiraciones, la alarma puede seguir encendida aunque HTTP sea 200 hasta que se atienda el atraso. Guardá evidencia de conteos/horas, no headers, cuerpos ni información de jugadores. No puede prometerse cuánto durará ese vaciado sin medir el proyecto real.

## Alarmas y reacción humana

estado_conciliacion().alarma = true si no hay ok en los últimos **3 minutos**; si hubo fallo/sin_respuesta en esa ventana; si hay devolución en revisión; si una deuda pendiente supera **15 minutos**; o si hay pago/reserva vencido desde hace más de **3 minutos**. Una petición sin respuesta durante **2 minutos** se marca sin_respuesta al observarla. El historial de cron por sí solo no cubre fallo HTTP.

| Síntoma | Acción |
|---|---|
| CONFIGURACION_AUSENTE_O_INVALIDA | Comprobar nombres/presencia y destino Vault en privado; no imprimir contenido |
| HTTP 401/403 | Comprobar gateway JWT y autenticación exclusiva del job; no quitar autenticación propia |
| HTTP 500 / respuesta inválida | Revisar despliegue, RPC y logs redactados con responsable; conservar deudas |
| HTTP_AUSENTE / timeout | Revisar pg_net y conectividad; comprobar PSP si hubo intento de devolución ambiguo |
| revision_manual | Responsable de pagos consulta PSP y registra resolución probada; no reintento ciego |
| No hay datos recientes, monitor no conecta | Tratar como alarma de disponibilidad, no como “0 problemas” |

Hace falta un **monitor externo** y una persona de guardia que reciba el aviso. Un booleano dentro de una base caída no avisa a nadie. El monitor debe ejecutar con credencial privada adecuada cada minuto, distinguir NULL/fallo de lectura de estado saludable y notificar por el canal acordado. Aquí no se instaló monitor, no se enviaron mensajes y no se afirma cobertura real de alertas.

En staging, con autorización explícita de su responsable, pausar solo ese job durante más de 3 minutos debe generar alarma por último éxito viejo; reactivar debe recuperarlo tras ciclos saludables (el fallo reciente puede sostener alarma hasta vencer la ventana). Hacer además prueba controlada de clave ausente/incorrecta y restaurar configuración por panel. No simular fallos en producción ni almacenar secretos en evidencia. La prueba de scheduler_sql.py solo simula esas respuestas; no sustituye este ensayo.

## Registro que completa la persona

- Proyecto/ambiente y autorización: ______
- Fecha/hora Bogotá, operador, versión desplegada: ______
- Job único y activo / última ejecución cron: ______
- Tres ciclos observados / último ok / conteos liberados: ______
- Pendientes/revisión y responsable asignado: ______
- Prueba negativa staging / pausa y recuperación / aviso recibido: ______
- Evidencia redactada y decisión seguir/parar: ______

No rellenamos esos espacios con hechos no ejecutados. Cambios de cliente opcionales para dashboard: lib/admin.ts:45 y app/admin/index.ts (cargar estado_conciliacion y mostrar deuda/alarma); no reemplaza monitor externo. El procedimiento no necesita cambiar cliente para consultarse por SQL autorizado.
