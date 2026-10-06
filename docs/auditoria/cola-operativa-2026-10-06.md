# Cola operativa: entrega para Claude

Se parte de la fusión 40cf40a. Se conservan modal propio en Android/iOS/web y
destinoReset web. No se editan cliente, tipos, CI ni archivos de build.
Todo PostgreSQL se ejecuta en contenedores desechables rotulados como aislados;
no se conecta a Supabase de producción. Cada punto se publica en codex/fiabilidad.

## 1. Respaldo y restauración

Scripts: scripts/db/logical_backup.py y logical_restore.py. Prueba ejecutable:
`python3 tests/backup_restore.py`. Resultados/times/filas/checksums en
respaldo-ensayo-2026-10-06.json. Es volcado custom de esquema public con datos,
funciones, triggers, índices, constraints, RLS y ACLs; no incluye propietarios.
No volca auth/storage/vault ni globals del cluster. UUIDs de perfiles se guardan
como anclas de dependencias, no son credenciales ni una copia de usuarios Auth.

Ejemplo de ensayo (container generado/etiquetado por tests/postgres_fixture.py):

```bash
python3 scripts/db/logical_backup.py --container "$LOCAL_CONTAINER" --database postgres --output /tmp/faltauno-backup
python3 scripts/db/logical_restore.py --container "$LOCAL_CONTAINER" --database restored --input /tmp/faltauno-backup --isolated-auth-stubs
```

Uso futuro fuera de Docker: sin --container, conexión por PGSERVICE/PGPASSFILE y
PG* seguros, nunca contraseña/URI en argumentos ni logs. pg_dump/pg_restore deben
ser de versión compatible (ensayado PostgreSQL 17). No se ejecutó esa variante
contra Supabase real. Requiere usuario autorizado con lectura completa/bypass RLS.
Preparar esquema auth/roles/extensiones/Storage mediante Supabase o restauración
separada ANTES de restaurar public. No ejecutar bootstrap de tests en Supabase.
El flag --isolated-auth-stubs sólo admite un contenedor Docker con la etiqueta
faltauno.isolated-test=true; crea únicamente UUIDs en una tabla auth.users de
prueba, no cuentas válidas ni passwords. Sin el flag exige que Auth ya contenga
las identidades de todos los perfiles; si faltan, para.

Restauración valida SHA256 y exige public sin tablas/vistas/secuencias; nunca
limpia una base con datos. Para el CREATE SCHEMA del archivo se elimina sólo el
namespace public vacío, SIN CASCADE: objetos inesperados impiden hacerlo. Luego
pg_restore en transacción única con abort on error. Un fallo puede dejar ese
namespace vacío ausente, pero no se borra ninguna fila para hacer pasar restore.
No sirve para «restaurar encima de producción». Restaurar a proyecto nuevo,
validar y planear recuperación antes de cambiar conexiones.

La prueba compara hash de cada tabla y catálogo de funciones/índices/constraints/
políticas/ACLs, no sólo número de filas; además rechaza repetir restore en base
ya poblada. Una copia corrupta se rechaza por checksum. Datos del ensayo son
ficticios. El volcado de datos REALES contendría PII y datos bancarios: modo 0600,
directorio 0700, cifrar al guardar/transferir, restringir acceso y no commitearlo.
Una ventana sin escrituras es necesaria al coordinar este dump de public con la
copia separada de Auth/Storage y sus anclas; no es un snapshot distribuido.

NO cubre: passwords/MFA/sesiones/tokens/usuarios sin perfil de Auth; bytes ni
metadatos de Storage; secretos Vault/Edge; roles globales/extensiones binarias;
configuración Auth/SMTP, tareas cron, publicación/subscripciones Realtime; ajustes
hosting/tiendas; datos financieros creados después del snapshot. Los backups y
su retención requieren política explícita (no hay plazo implementado automático).
No demuestra recuperación integral de Supabase ni sustitución del backup de Auth.
No requiere cambios de cliente. Claude debe completar el ensayo Supabase real
separado y política de protección/retención antes de aplicar migraciones.

## 2. Datos representativos

`scripts/db/generate_fixture.py` admite --courts, --players, --reservations,
--matches, --payments y --posts. Default: 40/1.000/15.000/2.000/50.000/10.000.
Sólo admite Docker con etiqueta faltauno.isolated-test=true y esquema app ya
migrado sin perfiles; rechaza volver a sembrar, no borra nada. Una transacción
crea todas las relaciones, así que un fallo revierte la siembra. Datos sintéticos,
correos example.test, sin SMTP/Auth remoto/Storage remoto. UUIDs se derivan de
índices de fixture; fecha ancla 2026-10-06 para reproducir distribución temporal.

```bash
python3 tests/representative_data.py
python3 scripts/db/generate_fixture.py --container "$LOCAL_CONTAINER" --courts 40 --players 1000 --reservations 15000 --matches 2000 --payments 50000 --posts 10000
```

El test instala migrations en DB vacía aislada, genera 12 canchas, 600 jugadores,
2.400 reservas, 300 partidos, 12.000 pagos y 1.200 posts. Comprueba cantidades,
preflight sin conflictos, no modificación al reintentar, contadores sociales
exactos y presencia de cada caso difícil. Salida/tiempo en
datos-representativos-2026-10-06.json. Mantiene casos válidos de apertura 08:00 y
cierre 23:00, reservas pendientes vencidas/canceladas, pagos caducados, retiros
pendientes, perfiles suspendidos, canchas pausadas/ocultas y posts reportados.
No genera solapamientos inválidos: ésos pertenecen al test preflight previo.
25 % de los pagos se concentra en un jugador para probar historias largas;
fecha+hora de reserva sigue una cuadrícula por cancha sin solapamientos, repartida
antes/después del ancla. Saldo/ingresos/comisiones se sembraron en ledger, no se
estiman desde una página. Un usuario final admin y dueños iniciales son ficticios.

Limitaciones: no usuarios Auth reales, fotos binarias ni entrega Realtime; las
filas se insertan como backend confiable para generar volumen y estados históricos.
No simula un recorrido de producto ni constituye evidencia de la pasarela.
No requiere cambio de cliente. La carga usa >=500 actores activos de este dataset;
si se solicitan menos jugadores, el benchmark debe rechazar ese escalón.

## 3. Capacidad: POSTGRESQL LOCAL, NO USUARIOS SOPORTADOS NI SLA

`python3 tests/capacity_local.py` crea PostgreSQL 17 aislado con max_connections
650 y shared_buffers 128 MB; no cambia configuración de Supabase. Dataset default
40 canchas/1.000 jugadores/15.000 reservas/2.000 partidos/50.000 pagos/10.000 posts.
500 actores activos, identidad JWT emulada vía GUC, SET LOCAL ROLE authenticated;
se usan libpq y sockets reales, no llamadas Python serializadas de SQL.
No hay 500 usuarios Auth reales ni sesiones móviles. Todas las conexiones nuevas
se sincronizan antes de empezar cada escalón. Cada actor ejecuta siete operaciones:
feed, búsqueda, historial propio, agenda de dueño, lista admin, inscripción y
reserva. Dueño/admin son identidades de prueba separadas; no se concede admin al
actor jugador. No es una mezcla de tráfico inferida de usuarios reales.

Se adjuntan EXPLAIN ANALYZE BUFFERS con RLS de consultas equivalentes de feed,
búsqueda de partidos/canchas, historial largo, agenda por día y listas admin de
pagos/reservas/reportes. Feed RPC SECURITY DEFINER se mide también como RPC real:
su plan exterior no revela el interior; no se afirma que RLS filtre dentro de esa
función, que deriva explícitamente el filtro de bloqueos. El rol invocante de la
medición sigue authenticated. Otros planes corresponden a filtros/orden usados
por el cliente/servidor; no se desactiva RLS para acelerar medidas.

Primera corrida: capacidad-postgres-local-primer-ensayo-2026-10-06.json.

| Sesiones SQL | Solicitudes | p50 ms | p95 ms | p99 ms | Error inesperado | Rechazos de negocio |
|---|---:|---:|---:|---:|---:|---:|
| 50 | 350 | 133,521 | 425,878 | 615,778 | 0 % | 35 |
| 100 | 700 | 199,864 | 898,293 | 1.443,881 | 0 % | 85 |
| 500 | 3.500 | 675,404 | 4.482,444 | 6.566,945 | 0 % | 805 |

Segunda corrida instrumentada: capacidad-postgres-local-2026-10-06.json.
Se agregó muestreo de espera/CPU/memoria; hubo controles de regresión en paralelo
en el mismo runner durante parte del ensayo. No es una comparación controlada
entre optimizaciones; no elegir sólo el número más favorable. A 50/100/500:
p95 457,699 / 1.362,713 / 7.951,877 ms; p99 552,965 / 2.019,99 / 10.724,613 ms;
p50 117,209 / 284,745 / 649,378 ms. Error inesperado 0 % y mismas cantidades de
rechazos de negocio. Todas las conexiones fueron admitidas (50/100/500); latencia
de conexión se informa por separado en JSON. Los percentiles incluyen éxito y
rechazo esperado, más BEGIN/SET ROLE/GUC/COMMIT y transporte local.

Contención provocada deliberadamente: todos compiten por 15 turnos de una cancha
y 20 partidos con 9 plazas libres cada uno. En 500 sesiones se rechazan 485
reservas y 320 inscripciones por regla de negocio; no son caídas del servidor.
En cada escalón exactamente 15 turnos se reservaron y ningún partido sobrepasó
cupos_totales. Los errores SQL inesperados y sus SQLSTATE se calculan aparte.
No sustituye carrera de confirmación/caducidad, ya cubierta por regresión SQL.

Cuello de botella observado: feed es el mayor p95 (hasta varios segundos),
y al escalar hay CPU próxima a cuatro núcleos y contención de locks interna:
picos de 405 esperas LWLock:LockManager, 191 BufferContent, 189 Lock:tuple y
62 Lock:transactionid. Memoria muestreada del contenedor alcanzó 1,529 GiB.
Es saturación/contención bajo demasiados backends simultáneos y escrituras sobre
las mismas filas; no sólo una consulta sin índice. Los JSON contienen tiempos,
planes, buffers, contadores por operación y muestras; no se concluye causalidad
única de CPU a partir de una muestra. Runner: cuota 4 CPU, límite memoria 32 GiB;
Docker no tuvo un límite adicional de CPU/memoria configurado.

Límites: dos ráfagas cortas, etapas secuenciales con caché calentándose, concurrencia
SQL elevada artificialmente, muestreo agrega overhead, sin ensayo sostenido,
sin Auth/Storage/Realtime HTTP, latencia móvil, CDN, SMTP ni pasarela. PostgreSQL
local con 650 conexiones no representa el pool PostgREST/plan de Supabase.
No se puede convertir esto a usuarios soportados, coste mensual ni SLA.

Próximo paso real: carga en staging vía Data API/Auth/Realtime con pool/plan real,
medir recursos y egress allí. No subir max_connections a 650 en producción por
este ensayo. Reducir consultas repetidas/coste de feed e investigar sus planes
internos, y acotar/poolizar concurrencia en servidor; no quitar locks financieros.
El generador se ajustó para crear reservas históricas antes de ocultar canchas,
porque el trigger (correctamente) no permite sembrar reservas en una cancha ya
retirada. Default de 40 canchas fue generado y medido exitosamente después del ajuste.
No se modificó cliente; lib/store.ts:216/222 y lib/canchas.ts:110 quedan como
referencias para controlar frecuencia/caché y consultas del feed/búsqueda con Claude.

## 4. Programación y observabilidad de conciliación

Preparado `scripts/db/programar_conciliacion.sql`, instalador explícito para
Claude, fuera de migrations/CI; NO se instaló cron/net/Vault en producción.
Requiere pg_cron, pg_net y Vault habilitados en staging/producción, Edge
conciliar-pagos desplegada con autenticación propia y RPCs de caducidad instaladas.
El test local usa doubles SQL de cron/net/Vault y PostgreSQL real para funciones,
permisos, fallos, conteos y estado; no certifica scheduler/HTTP reales de Supabase.

Provisionar vía panel/Vault (sin imprimir): faltauno_conciliacion_url = URL HTTPS
exacta de esa función en el proyecto, faltauno_conciliacion_secret = el mismo
secreto exclusivo configurado como CONCILIACION_JOB_SECRET en Edge. No colocar el
valor en SQL versionado ni EXPO_PUBLIC. La URL acepta sólo dominios supabase.co y
path exacto, evitando enviar ese secreto a un destino arbitrario. Si se utiliza
un dominio custom, extender/ensayar la allowlist expresamente.

Aplicación por Claude después del ensayo y verificación de proyecto:

```bash
psql -X -v ON_ERROR_STOP=1 -f scripts/db/programar_conciliacion.sql
psql -X -c 'select public.estado_conciliacion();'
```

Conexión segura por PGSERVICE/PGPASSFILE, no contraseña en argv. Reinstalar actualiza
el mismo nombre de job: faltauno-conciliacion, cron '* * * * *'. Cadencia de un
minuto frente a vencimiento de 15 minutos: agrega como máximo aproximadamente un
minuto de retención nominal si no hay backlog/fallo. Edge procesa 100 vencimientos
de cada tipo por llamada y una devolución: techo nominal 100/min por tipo y
1 devolución/min; NO garantiza vaciar una avalancha. Alertas de vencidos/deuda
vieja requieren aumentar frecuencia/lotes/workers de forma ensayada si exceden
ese caudal, no esconder atraso ni prometer «15 minutos exactos».

HTTP asíncrono net con timeout 50 s. Un heartbeat encolada NO significa éxito:
la próxima ejecución observa respuesta real 200 + ok + conteos enteros válidos;
500/cuerpo inválido/timeout es fallida; sin respuesta a los 2 min es sin_respuesta.
Evita encolar otro request mientras el anterior está pendiente <2 min. La
función Edge limita fetch Rapyd a 20 s y leases de refund a 2 min; los reintentos
ambiguos siguen requiriendo revisión, no duplican POST de devolución.

`estado_conciliacion()` muestra: última ejecución/HTTP/estado/cantidades,
último ok, totales liberados del registro duradero ejecuciones_caducidad,
pendientes vencidos, devoluciones pendientes, revisión manual, deuda más antigua,
último estado cron (sin return_message ni headers) y alarma. Alarma si falta ok
reciente >3 min, hay fallo/sin respuesta reciente, vencidos >3 min, revisión
manual o deuda no devuelta >15 min. Admin tiene acceso; jugador recibe null,
no puede encolar ni observar ni leer registros ajenos. No expone secretos/raw body.

SQL de diagnóstico administrativo:

```sql
select public.estado_conciliacion();
select encolada_at,terminada_at,estado,http_status,pagos_liberados,reservas_liberadas,error_codigo
from public.ejecuciones_conciliacion order by encolada_at desc limit 20;
select estado,count(*),min(created_at) from public.conciliaciones_pago group by estado;
```

Configurar monitor EXTERNO con responsable/canal que consulte ese estado y alerte;
un indicador dentro de la misma base no avisa por sí solo si la base está caída.
Verificar cron.job activo y logging de cron.job_run_details en Supabase. Definir
retención de registros/pg_net sin borrar transacciones financieras; el instalador
no elimina logs ni deudas para hacer pasar nada. Cuando devoluciones están
desactivadas, el heartbeat puede responder ok para caducidad: revisar también
reembolso_estado, deuda/alarma, y mantener pagos online desactivados hasta sandbox.

Prueba: instalación repetida produce un job; configuración ausente visible;
conteos HTTP 2/3 observados; estado saludable tras ok; HTTP 500 visible; respuesta
faltante visible; permisos jugador denegados; secreto ausente del status. Resultado
en conciliacion-programacion-2026-10-06.json. Pendiente concreto: habilitar
extensiones reales, provisionar Vault, instalar/observar dos ciclos y ensayar
fallo de Edge en staging. No se afirma que un cron real ya haya corrido.

Requiere cambio de cliente sólo si Claude incorpora este estado al panel:
lib/admin.ts:45 y app/admin/index.ts: invocar estado_conciliacion como admin,
mostrar última ejecución/alarma/deuda; no sustituye monitor externo ni hacer
llamadas al scheduler con el secreto desde el navegador.

## 5. Declaraciones de privacidad contrastadas

Problema: declaración de julio excluía finanzas y ubicación por completo, usaba
PayU, asumía token push remoto y solo fotos de cancha. Inventario y discrepancias
en privacidad-codigo-2026-10-06.md, con pantallas, almacén, destinatarios,
retención, borrado y referencias de código. No se editaron el cliente ni el
archivo de declaraciones fuera de este territorio.

Ensayo privacy_retention.py: 11 verificaciones SQL reales pasaron; JSON adjunto.
Snapshots de denuncias y referencias de devolución sobreviven a borrar jugador;
eliminar dueño borra ledger/retiros. Auth/Storage de proveedor no se probaron.
Se corrigió además el generador: sus denuncias no pueden apuntar al propio
reportante, caso encontrado con pocos jugadores y muchos posts. No se relajó
ninguna regla SQL.

Controles reales: 52 unitarias, todos los grupos database.py, TypeScript y Expo
lint pasaron. Pendientes: actualizar formularios y política, definir TTL y
salvaguarda financiera, verificar proveedores/binario y borrar cuenta en staging.
Cambios potenciales de cliente con línea están en el inventario; ninguno aplicado.
