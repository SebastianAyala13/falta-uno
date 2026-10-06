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
