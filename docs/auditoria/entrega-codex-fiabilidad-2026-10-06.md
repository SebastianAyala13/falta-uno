# Entrega a Claude: rama codex/fiabilidad

No se modifica main ni Supabase de producción. La rama arranca en 86a5ae8;
Claude debe integrar con main y resolver el cliente dentro de su reparto.
No existe carpeta mobile/ en el workspace: los archivos nativos nuevos son
app.config.ts y cambios de configuración ya presentes en la tarea 0.

## Tarea 0 — cb14b02

Código completo previamente no publicado. 40 pruebas unitarias, todos los grupos
SQL originales, tipos y lint ejecutados y aprobados. La revisión del índice
señaló un espacio final en tests/database.py; corregido en el punto 1.
Inventario completo (A=nuevo, M=modificado respecto a 86a5ae8):

```text
M	.env.example
M	CLAUDE.md
M	Dockerfile
A	app.config.ts
M	app.json
M	app/(auth)/recuperar.tsx
M	app/(auth)/register.tsx
M	app/(auth)/welcome.tsx
M	app/(tabs)/_layout.tsx
M	app/(tabs)/buscar.tsx
M	app/(tabs)/crear.tsx
M	app/(tabs)/index.tsx
M	app/(tabs)/muro.tsx
M	app/(tabs)/perfil.tsx
M	app/_layout.tsx
M	app/admin/canchas.tsx
M	app/admin/index.tsx
M	app/admin/pagos.tsx
M	app/admin/reportes.tsx
M	app/admin/reservas.tsx
M	app/admin/retiros.tsx
M	app/admin/usuarios.tsx
M	app/apariencia.tsx
M	app/calificar/[id].tsx
M	app/cancha/[id]/index.tsx
M	app/cancha/[id]/reservar.tsx
M	app/cancha/agenda.tsx
M	app/cancha/editar.tsx
M	app/cancha/finanzas.tsx
M	app/cancha/panel.tsx
M	app/cancha/registrar.tsx
M	app/canchas.tsx
M	app/chat/[id].tsx
M	app/checkout/[id].tsx
M	app/crear-post.tsx
M	app/editar-perfil.tsx
M	app/mis-pagos.tsx
M	app/mis-partidos.tsx
M	app/mis-reservas.tsx
M	app/partido/[id].tsx
M	app/post/[id].tsx
M	app/reset.tsx
M	components/AdminGate.tsx
A	components/AlertProvider.tsx
M	components/AmenidadPicker.tsx
M	components/BackButton.tsx
M	components/CanchaMap.tsx
M	components/CanchaMap.web.tsx
M	components/DateTimeField.tsx
M	components/EmptyState.tsx
M	components/ErrorBanner.tsx
M	components/Field.tsx
M	components/GameCard.tsx
M	components/GlowButton.tsx
M	components/HomeButton.tsx
M	components/ModeracionBoton.tsx
M	components/PostCard.tsx
M	components/SearchBar.tsx
M	components/StarRating.tsx
M	components/StatCard.tsx
M	components/UbicacionPicker.tsx
M	components/UbicacionPicker.web.tsx
M	components/UrgencyPill.tsx
M	constants/config.ts
M	docs/CUMPLIMIENTO-TIENDAS.md
M	docs/GUIA-PUBLICACION-GOOGLE-PLAY.md
A	docs/auditoria/fiabilidad-y-capacidad.md
A	docs/auditoria/revision-tiendas-2026-10-06.md
A	docs/continuidad/plan-claude-2026-10-06.md
A	docs/superpowers/plans/2026-10-05-fiabilidad-y-concurrencia.md
A	docs/superpowers/plans/2026-10-06-revision-tiendas.md
A	docs/superpowers/specs/2026-10-05-fiabilidad-y-concurrencia.md
A	docs/superpowers/specs/2026-10-06-revision-tiendas.md
M	eas.json
M	legal/eliminar-cuenta.html
A	legal/normas-comunidad.html
M	legal/privacidad.html
M	legal/terminos.html
M	lib/admin.ts
A	lib/alert.ts
M	lib/auth.tsx
M	lib/canchas.ts
M	lib/chat.ts
A	lib/data-utils.ts
M	lib/format.ts
M	lib/images.ts
A	lib/media.ts
M	lib/moderation.ts
M	lib/notifications.ts
A	lib/notifications.web.ts
A	lib/partidos.ts
M	lib/payments.ts
A	lib/slots.ts
M	lib/store.ts
M	lib/useGuardInvitado.ts
A	lib/usePartido.ts
M	package.json
M	supabase/functions/delete-user/index.ts
A	supabase/functions/moderar-contenido/index.ts
M	supabase/functions/rapyd-crear-checkout/index.ts
M	supabase/functions/rapyd-webhook/index.ts
A	supabase/migrations/20261005200000_fiabilidad_concurrencia.sql
A	supabase/migrations/20261006120000_media_y_eliminacion.sql
A	supabase/migrations/20261006130000_moderacion_contenido_completo.sql
A	supabase/migrations/20261006140000_archivos_moderacion.sql
A	tests/alert.test.cjs
A	tests/browser-store-review.cjs
A	tests/browser.cjs
A	tests/database.py
A	tests/delete-user.test.cjs
A	tests/load-ts.cjs
A	tests/media.test.cjs
A	tests/moderation-edge.test.cjs
A	tests/notifications.test.cjs
A	tests/release-config.test.cjs
A	tests/search.test.cjs
A	tests/slots.test.cjs
A	tests/store.test.cjs
A	tests/webhook.test.cjs
M	types/database.ts
```

## Punto 1 — preflight ejecutable

`scripts/preflight-fiabilidad.sql` abre una transacción REPEATABLE READ READ ONLY;
no crea objetos, modifica filas ni elimina registros. Requiere el esquema Falta Uno.
Un fallo de esquema/permisos es error, nunca informe vacío de éxito. Ejecutar con
`psql -X -f scripts/preflight-fiabilidad.sql`, configurando la conexión por un medio
seguro (p. ej. PGSERVICE/PGPASSFILE); no imprimir credenciales en la línea de comandos.
Usar una conexión autorizada con lectura completa y bypass de RLS; una conexión
de jugador filtraría registros y no sirve para el preflight administrativo.
Cada fila entrega tipo, cantidad e ids. Cero en las cuatro filas es requisito de
preflight, no autorización de despliegue. La transacción es consistente durante
las cuatro comprobaciones; repetir justo antes del despliegue evita cambios entre
preflight y migración. La migración vuelve a imponer las restricciones.

Prueba en base aislada anterior a fiabilidad, con cuatro conflictos intencionales:

```text
disponibilidad_invalida | 1 | duración 0, cierre 09:00, apertura 10:00, precio -1
intervalos_invalidos   | 1 | id 00000000-0000-0000-0000-0000000000cb
referencias_duplicadas | 1 | DUPLICATE: ids …00c9 y …00ca
reservas_solapadas     | 1 | ids …00c9 y …00ca, cancha …00c8, 2099-10-05
```

El test conserva todos los ids completos en su salida, verifica salida idéntica
al repetir y que PostgreSQL rechaza UPDATE en READ ONLY. Los fixtures están en
una base desechable distinta; no se borran conflictos para aplicar migraciones.
No requiere cambio de cliente.

## Punto 2 — ataques autenticados

Reproducción antes de fiabilidad en base aislada: INSERT online confirmada y
UPDATE de precio/comisión a cero se aceptan. Después de las migraciones, los
intentos se rechazan: precios/comisión por permisos de columna; confirmación
online por trigger/validación. Se añade una migración que rechaza expresamente
INSERT online con estado distinto a pendiente y revoca UPDATE/DELETE de pagos
 y retiros al cliente, además de RLS. Efectivo puede reservar confirmado, pero
no acredita un pago ni crea un ingreso online.

Pruebas JWT/rol authenticated: los tres ataques exactos, UPDATE de estado a
confirmada, autoascenso a admin, autoaprobación de pago/retiro, falsificación de
owner por INSERT/UPDATE y lectura de reserva ajena. RLS SELECT niega lectura
filtrando a cero filas; no debe esperarse una excepción SQL en ese caso. Se
comprueba también que dueño legítimo ve su reserva y los datos no cambian.

Archivos: tests/database.py y
supabase/migrations/20261006150000_reservas_permisos_negativos.sql.
No cambio de cliente necesario para el uso normal: reservas online ya envían
pendiente; efectivo conserva su flujo. No se verificó producción: el esquema
antiguo se reprodujo exclusivamente en el contenedor de prueba.

## Punto 3 — caducidad y conciliación

Un pendiente online vencía nunca y ocupaba indefinidamente. Ahora el servidor
fija un máximo de 15 minutos (o inicio del servicio si es anterior), ignorando
caducidad enviada por el cliente. Efectivo no caduca como pago online.
`caducar_pagos_pendientes(100)` es una RPC sólo service_role, invocable y con
registro de cada ejecución en ejecuciones_caducidad. Libera membresías no
confirmadas y cancela reservas pendientes bajo lock, sin tocar pagos aprobados.
Un consumidor debe programarla cada minuto en staging/producción: la migración
no instala cron ni ejecuta tareas en producción por sí misma.

La confirmación comprobada usa el mismo orden de locks. Vencido/cancelado,
servicio iniciado o retirado de disponibilidad: no resucita inscripción/reserva,
no registra ingreso en cancha, crea una deuda única de devolución en
conciliaciones_pago. Incluso antes de correr la tarea, el webhook comprueba
la fecha límite. Estados pagos: caducado, reembolso_pendiente, reembolsado;
reserva mantiene estado cancelada y expone estado_pago para el seguimiento.
El webhook conserva ID de pago del proveedor. Un duplicado aprobado no vuelve
a insertar una membresía eliminada. Checkout no admite pendientes vencidos y
envía referencia estable en el header idempotency del proveedor; su eficacia
real debe verificarse en sandbox (la base no puede garantizarla por sí sola).

`conciliar-pagos` autentica un secreto exclusivo de tarea, caduca y procesa una
devolución por invocación. Devoluciones desactivadas salvo
RAPYD_REEMBOLSOS_ACTIVOS=true. POST /v1/refunds usa payment y amount; luego GET
por ID para pendientes. Sólo COM con ID/pago/importe/COP concordantes acredita
reembolsado. PEN/NEW permanece pendiente. Timeout, respuesta inconsistente o
lease de ejecución vencida queda revision_manual: un operador debe consultar
Rapyd y corregir la cola mediante backend confiable antes de repetir. Nunca
se reintenta un POST ambiguo automáticamente. El plazo de tarea es dos minutos;
HTTP tiene timeout de 20 s. Leases/tokens evitan dos consumidores del mismo caso.

Esto implementa devolución y trazabilidad, pero NO certifica respuesta real de
Rapyd ni garantiza que todas las deudas se liquiden sin operación humana. Antes
de habilitar: validar contrato/status/refund e idempotencia en sandbox, disponer
fondos, configurar tarea/alertas y responsable de revision_manual. Si no, mantener
pagos online desactivados. No se aplicó nada a producción.

Despliegue por Claude, después de migraciones y ensayo:
`supabase functions deploy conciliar-pagos --project-ref "$PROJECT_REF" --no-verify-jwt`.
La función verifica CONCILIACION_JOB_SECRET (aleatorio y secreto, nunca EXPO_PUBLIC).
JWT de usuario no autoriza esta tarea. Configurar secreto por panel/Vault sin
imprimirlo, y scheduler que envíe Authorization: Bearer <secreto-de-tarea>.
SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY son inyectadas por Supabase. Secretos Rapyd:
RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY, RAPYD_BASE_URL (sandbox por defecto), y
RAPYD_REEMBOLSOS_ACTIVOS. Actualizar también rapyd-webhook y rapyd-crear-checkout.
Alertar si falta ejecución reciente, hay pendientes vencidos o deudas sin cerrar;
SELECT administrativos de las dos tablas son privados. Repetir lotes si hay backlog.

Pruebas: vencimiento/confirmación concurrentes en partido y reserva, nueva persona
ocupando el cupo liberado, webhook tardío repetido, sin ingreso ficticio, consumidores
paralelos, token inválido y cierre de deuda. Dobles de frontera comprueban secreto,
devolución pendiente/completada, GET, timeout y discordancia de importe/moneda.
Son pruebas PostgreSQL/HTTP simulado; falta sandbox real del proveedor.

Requiere cambio de cliente (Claude): types/database.ts, tipos Pago/Reserva, nuevos
estados y campos caduca_at/estado_pago; app/checkout/[id].tsx debe mostrar vencimiento,
permitir nueva referencia al reintentar y no celebrar un pago reembolso_pendiente;
app/mis-pagos.tsx y app/mis-reservas.tsx deben representar devolución/caducidad.
lib/payments.ts debe interpretar esos estados y actualizar desde servidor, sin
confirmación cliente. Líneas concretas se adjuntan en el inventario final.

## Punto 4 — transacciones idempotentes

`crear_establecimiento(p_referencia,p_datos)` recibe el formato actual de
NuevoEstablecimiento (canchas/horarios/dirección/amenidades/legal_version).
Deriva owner de auth.uid, requiere perfil activo y aceptación legal vigente;
crea todas las canchas y horarios y agrega rol cancha en una transacción.
Referencia por usuario/tipo, payload idéntico obligatorio, respuesta almacenada:
reintentos concurrentes devuelven las mismas filas. Error de segunda cancha
revierte la primera, horarios, rol y operación; no deja un alta parcial.

`reservar_con_partido(p_referencia,p_cancha,p_fecha,p_inicio,p_fin,p_medio,p_partido)`
deriva jugador y precios del servidor; partido opcional es JSON con formato/nivel.
En efectivo crea y vincula ambos en una transacción. Online conserva intención
pero no publica hasta que el webhook confirma realmente: el trigger crea/vincula
partido junto a confirmación y ledger en la misma transacción. Pago vencido no
publica partido. Reintentar la misma referencia devuelve reserva original con
estado actual, no duplica ni reclama un horario liberado como nueva reserva.
Cambiar datos con la misma referencia falla. Un usuario distinto no obtiene el
comprobante. INSERT cliente sólo admite columnas normales: no puede falsificar
partido_id/partido_solicitado/caduca_at/estado_pago. RPC controla esas columnas.

El precio por plaza se deriva de la reserva/precio congelado; formato de la
intención se valida al solicitar y no depende de cambios posteriores de formatos.
Una pérdida de respuesta HTTP se recupera consultando la misma referencia. Si
falló transacción de alta/reserva, no hubo comprobante confirmado: se reintenta.
Si falla publicación al webhook, se revierte confirmación/ledger y el proveedor
recibe 500 para reintentar. Si vence mientras tanto, el cobro pasa a devolución.
No se elimina una reserva confirmada preexistente para simular recuperación.

Requiere cambio de cliente (Claude): lib/canchas.ts crearEstablecimiento y
crearReserva deben consumir estas RPC con referencia estable por intención;
app/cancha/[id]/reservar.tsx debe quitar la creación separada mediante crearPartido
(y no publicar después de cerrar el navegador del checkout). Renderizar el
comprobante de respuesta y consultar estado para online. No enviar partido_id
ni siquiera null por INSERT antiguo; ese campo deja de tener permiso cliente.
app/cancha/registrar.tsx debe conservar referencia durante reintentos. Tipos RPC
nuevos en types/database.ts. No se han editado esos archivos, conforme al reparto.

Preflight adicional antes de esta migración:
`select partido_id,array_agg(id) from public.reservas where partido_id is not null group by partido_id having count(*)>1;`
La unicidad falla ante conflictos existentes; no se borran filas.

## Punto 5 — historiales con cursor

`historial_paginado` es SECURITY INVOKER: conserva RLS y añade ámbito propio,
cancha del dueño o admin verificado, sin aceptar usuario objetivo del cliente.
Tipos permitidos: pagos, reservas, movimientos, retiros, canchas, usuarios,
reportes, inscripciones, partidos, calificaciones y bloqueos. Reportes propios
siguen sujetos a su política actual (sólo lectura admin); esta RPC no amplía RLS.

Entrada: p_tipo; p_ambito ('propio' por defecto/'cancha'/'admin'); p_cancha para
historial del establecimiento; p_antes y p_antes_id juntos; p_limite 1–100
(default 50); p_estado/p_fecha según tabla; p_busqueda literal de nombre para
usuarios/canchas (escapa comodines). Salida: filas, hay_mas, cursor {fecha,id}.
Pasar cursor.fecha como p_antes y cursor.id como p_antes_id. Orden descendente
por created_at e id; retiros usa solicitado_at e id. No usa OFFSET para navegar.
La búsqueda de nombre de esta RPC no incluye email; conservar o adaptar el
buscador admin deliberadamente, sin descargar perfiles completos para filtrar.

Consulta limit+1 para saber si hay más y devuelve máximo p_limite filas en JSON,
independiente del límite de filas de Data API. Índices para filtros/orden tanto
personales/dueño como administrativos y estados. Saldo/contadores continúan en
SQL exacto. El cursor estable evita desplazamiento por nuevas inserciones;
no representa una instantánea inmutable si alguien cambia/borrar registros entre
páginas. Una lista refrescada reinicia cursor; no mezclar cursores de otros filtros.

Prueba con 20.000 pagos, 1.200 propios y timestamps empatados: 12 páginas de 100
sin duplicados/faltantes/filas ajenas. Prueba acceso admin/propio/dueño, cursores
incompletos/límites inválidos/tipo malicioso y ledger de más de 2.000 movimientos.
EXPLAIN ANALYZE/BUFFERS con RLS activa se adjunta en
planes-historiales-2026-10-06.md (primera página, cursor profundo, admin por estado,
movimientos de cancha). Son medidas PostgreSQL local, no carga ni SLA real.

Requiere cambio de cliente (Claude): lib/admin.ts listas de usuarios/canchas/
reservas/pagos/retiros/reportes/movimientos; lib/canchas.ts misCanchas,
misReservas,reservasDeCancha,movimientos,retirosDeCancha; lib/store.ts hidratar
no debe recorrer todas las páginas privadas al iniciar. Sustituir por primera
página y carga bajo demanda. Historial por created_at cambia el orden previo de
reservas por fecha de juego: si agenda filtra por día usar p_fecha y ordenar su
página visible por hora, evitando interpretar una página como toda la agenda.
Pantallas app/admin/**, app/mis-pagos.tsx, app/mis-reservas.tsx,
app/cancha/finanzas.tsx y app/cancha/agenda.tsx requieren controles de paginación,
estados de carga/reintento y cursor por filtro. Tipos RPC en types/database.ts.

Este commit entrega la capa servidor. Los historiales de la app NO quedan
integrados hasta que Claude adapte esos archivos; no se editaron por el reparto.

## Punto 6 — moderar-contenido lista para desplegar

Código en supabase/functions/moderar-contenido/index.ts. Solicitud POST con JWT
de usuario válido: getUser valida identidad y RPC is_admin valida rol. Body:
{reporte: UUID, estado: 'resuelto'|'descartado', eliminar: boolean}. Rechaza JSON
malformado/objetos inválidos con 400 y métodos distintos a POST con 405; OPTIONS
sólo sirve CORS. Usuario inválido 401 y sin rol admin 403, sin acceso privilegiado.

La función inventaría únicamente archivos propios identificados por
archivos_reporte, los elimina por bucket en lotes de 100 y resuelve el reporte
con el JWT del moderador, no con service_role: SQL vuelve a validar autorización.
Si Storage falla, no resuelve. Si SQL falla después de limpiar archivos, retorna
500, no éxito; la limpieza se puede repetir (el borrado físico y SQL no son una
transacción distribuida). Logs genéricos: no se imprime el objeto de error del
proveedor ni cabeceras/tokens/rutas privadas. Contenido externo/cachés no puede
borrarse mediante Storage propio. Reintentar después de comprobar estado real.

### Despliegue exacto, a cargo de Claude

1. Integrar rama y validar staging Supabase real. Ensayar backup/restauración y
   preflight. Aplicar toda la cadena en orden, incluidas las migraciones de media,
   moderación completa y archivos_moderacion. Nunca instalar los stubs del test.
2. Autenticar CLI mediante acceso seguro (no imprimir token). Definir PROJECT_REF
   con el proyecto de staging verificado. Desde la raíz del repo ejecutar:

```bash
./node_modules/.bin/supabase functions deploy moderar-contenido --project-ref "$PROJECT_REF"
```

Mantener verify_jwt=true; NO usar --no-verify-jwt para moderación. El comando de
conciliación es diferente porque autentica un secreto de tarea y no un usuario.
No desplegar accidentalmente todas las funciones ni inferir proyecto por una
vinculación local antigua. Repetir la misma operación con el ref de producción
sólo tras ensayo y coordinación de cliente/migraciones aprobada por el responsable.

3. Variables necesarias, inyectadas normalmente por Supabase Edge del proyecto:
   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. No requiere secretos
   Rapyd ni otro secreto custom. Verificar su disponibilidad sin mostrar valores;
   service_role sólo vive en servidor y nunca entra en EXPO_PUBLIC ni navegador.
4. Prueba en staging con admin real, jugador real y JWT inválido: reportar una
   imagen propia de usuario de pruebas, resolver con eliminar=true y comprobar
   200 {ok:true}, archivo inaccesible y reporte resuelto. Jugador debe recibir 403,
   JWT inválido 401. Simular fallo Storage: reporte conserva estado pendiente.
   Descartar sin eliminación no debe usar Storage. Verificar luego HTTP/RLS reales;
   los tests locales sólo simulan las fronteras de Auth y Storage.
5. Publicar cliente después de tener función/migraciones operativas; confirmar que
   lib/admin.ts resolverReporte llama functions.invoke('moderar-contenido'), valida
   error/data.ok y muestra el fallo. Revalidar por navegador y Android/iOS.

Pruebas unitarias extendidas: JWT ausente/vencido, no admin, lookup de rol fallido,
GET/OPTIONS, JSON inválido, UUID/estado/boolean inválidos, descartar sin Storage,
205 archivos media + un archivo canchas en lotes 100/100/5/1 y fallo final SQL.
No se desplegó ninguna función ni se accedió al Supabase de producción.

## Referencias exactas de cambios de cliente requeridos

Líneas de la rama codex/fiabilidad (pueden cambiar al integrar con main):

| Archivo / línea | Comportamiento esperado por Claude |
|---|---|
| lib/canchas.ts:351 | crearEstablecimiento → RPC crear_establecimiento; referencia estable, payload idéntico al reintentar |
| app/cancha/registrar.tsx:192 | Conservar referencia de alta mientras se reintenta; no duplicar intentos por nueva referencia |
| lib/canchas.ts:186 | crearReserva → reservar_con_partido; quitar INSERT con partido_id incluso si null; usar respuesta server |
| app/cancha/[id]/reservar.tsx:97 | Solicitar reserva e intención opcional de partido en una RPC; conservar referencia y comprobante |
| app/cancha/[id]/reservar.tsx:121 | Quitar crearPartido separado tras cerrar checkout; publicación online sólo tras webhook |
| types/database.ts:95 | Reserva: caduca_at, estado_pago y partido_solicitado derivados del servidor |
| types/database.ts:273 | EstadoPago: incluir caducado, reembolso_pendiente y reembolsado |
| types/database.ts:415 | Registrar nuevas firmas RPC, Args/Returns y cursor de historial |
| app/checkout/[id].tsx:228 | Representar pendiente/vencido/devolución; no tratar retorno del navegador como aprobación |
| app/mis-pagos.tsx:34 | Etiquetas/seguimiento de nuevos estados financieros y paginación |
| app/mis-reservas.tsx:116 | Mostrar caducidad/estado_pago y consultar confirmación real; paginación |
| lib/payments.ts:54 | Checkout de reserva debe manejar vencimiento y leer estado real; sin escrituras de aprobación |
| lib/store.ts:210 | Hidratación inicial acotada; sustituir lecturas completas de pagos/partidos/inscripciones/calificaciones/bloqueos por primera página y carga bajo demanda |
| lib/canchas.ts:84 | misCanchas paginado; no limitar selección de canchas a primera página silenciosamente |
| lib/canchas.ts:214 | misReservas con cursor y estados de carga/reintento |
| lib/canchas.ts:225 | reservasDeCancha con ámbito cancha y p_fecha para agenda; no presentar una página como agenda completa |
| lib/canchas.ts:252 | movimientos paginados; saldo sigue en saldo_cancha, no suma de página |
| lib/canchas.ts:263 | retirosDeCancha paginados por solicitado_at,id |
| lib/admin.ts:55 | listarUsuarios con cursor; búsqueda servidor por nombre (email/ciudad requieren extensión deliberada) |
| lib/admin.ts:71 | listarCanchasAdmin con ámbito admin |
| lib/admin.ts:78 | listarReservasAdmin con estado/cursor |
| lib/admin.ts:87 | listarPagosAdmin con estado/cursor |
| lib/admin.ts:96 | retirosTodos con cursor |
| lib/admin.ts:107 | reportesAdmin con cursor |
| lib/admin.ts:118 | movimientosCancha con ámbito admin/cancha y cursor |
| lib/admin.ts:173 | resolverReporte mantiene invoke moderar-contenido y exige data.ok |
| app/admin/** | Cargar siguiente página; reiniciar cursor al cambiar filtros; métricas usan admin_metricas |
| app/cancha/finanzas.tsx y app/cancha/agenda.tsx | Historiales bajo demanda; saldo exacto SQL independiente; día completo de agenda |

No se han modificado estos archivos después de la tarea 0. La decisión de
unificar lib/alert.ts/AlertProvider con lib/dialogo.ts/Dialogo queda a Claude.

## Commits publicados por punto

| Punto | Commit | Archivos |
|---|---|---|
| Tarea 0 | cb14b02 | 120 archivos: lista completa al principio |
| 1 | ec4882a | scripts/preflight-fiabilidad.sql, tests/database.py, este informe |
| 2 | d8e81f0 | 20261006150000_reservas_permisos_negativos.sql, tests/database.py, este informe |
| 3 | 958d045 | 20261006160000_caducidad_conciliacion.sql; funciones conciliar-pagos, rapyd-crear-checkout, rapyd-webhook; tests/database.py, tests/webhook.test.cjs, tests/reconciliation.test.cjs; este informe |
| 4 | 2765bcc | 20261006170000_operaciones_transaccionales.sql, tests/database.py, este informe |
| 5 | 7ac7d23 | 20261006180000_historiales_cursor.sql, tests/database.py, planes-historiales-2026-10-06.md, este informe |
| 6 | Commit final de esta entrega | función moderar-contenido, tests/moderation-edge.test.cjs, este informe |

Todas las migraciones citadas están bajo supabase/migrations/. Todas las funciones
citadas están bajo supabase/functions/<nombre>/index.ts. Cada punto pasó sus
controles antes de publicarse; fallos de desarrollo se corrigieron y se repitió
SQL antes del commit. El punto 3 amplió a 47 pruebas unitarias; el 6 a 52.

Estado final verificado: 52 pruebas unitarias, 17 grupos funcionales SQL, aplicación
de todas las migraciones y dos comprobaciones adicionales de preflight/esquema
antiguo, tipos/lint/diff: todos pasaron en la comprobación final.
Pruebas aisladas, no equivalen a Auth/Storage/Realtime/pasarela real ni carga.

Pendiente de Claude: integrar cliente, ensayar y desplegar backend/funciones/tareas,
probar Rapyd sandbox antes de activar devoluciones/pagos, publicar legales del
segundo repo, medir carga y compilar/probar binarios de tiendas. Mantener main
sin estas migraciones hasta preparar promoción coordinada: el workflow actual
las aplica directamente a producción. No ejecutar merge/push a main a ciegas.

La rama remota main avanzó por el trabajo paralelo de Claude durante esta tarea;
no se hizo push a main, rebase sobre su trabajo ni modificación de sus archivos
tras la tarea 0. Integrar en rama de ensayo y resolver conflictos explícitamente.
Los planes SQL publicados corresponden a la prueba validada del punto 5; la suite
final volvió a producir planes válidos sin reemplazar esa evidencia histórica.
