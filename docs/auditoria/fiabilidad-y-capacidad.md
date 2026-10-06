# Correcciones de fiabilidad y consumo

Se revisaron autenticación, navegación, partidos, muro, chat, canchas, reservas,
administración, pagos y migraciones. Los cambios quedan en el repositorio; no se
modificó Supabase de producción, no se publicaron Edge Functions ni la web.
El repositorio de páginas legales no necesitó cambios funcionales.

## Cambios

- Inscripción y recibo en una transacción con bloqueo por partido; reintentos
  devuelven el mismo recibo. Capacidad comprobada bajo concurrencia.
- Precios, comisiones y aprobación de pagos decididos por el servidor. El webhook
  verifica firma y moneda e invoca una transacción idempotente; los errores
  devuelven 500 para permitir el reintento del proveedor.
- Reservas activas con exclusión de intervalos solapados. Las canceladas liberan
  el horario. Ocupación pública expone sólo horas. Horarios reemplazados de forma
  atómica y duración inválida rechazada, evitando bucles infinitos.
- Retiros serializados por cancha, con saldo reservado para solicitudes pendientes.
- Autenticación sin consultas de perfil por cada refresh del token, ni listener
  filtrado; cambio de cuenta invalida lecturas pendientes y limpia datos privados.
- Errores de escritura no generan éxito local ficticio. Borradores de chat y
  comentarios se conservan si falla el envío. Alertas de confirmación funcionan
  en web sin ejecutar acciones destructivas automáticamente.
- Partidos, muro, comentarios y chat por páginas; chat mantiene hasta 200 mensajes
  y abre Realtime sólo mientras la pantalla está visible. Hidratación compartida
  y caché de 30 segundos. Búsqueda filtrada en servidor y lista virtualizada.
- Marketplace público por páginas de 30, con filtros de formato en SQL y protección
  frente a respuestas obsoletas. Contadores sociales persistidos con actualizaciones
  atómicas, sin descargar todas las interacciones.
- Hora de Colombia consistente, calificaciones sólo después del partido, comisión
  cero en efectivo y precio por jugador repartido al crear partido desde una reserva.
- Dockerfile normaliza permisos de archivos estáticos para que nginx pueda
  servir exportaciones producidas con umask restrictiva (antes respondía 403).
- Imports de fuentes e íconos específicos y notificaciones nativas excluidas del
  bundle web. Comparación de exportaciones del mismo entorno: fuentes de 38 archivos
  / 6.515.664 bytes a 6 / 1.033.576 bytes (84,1 % menos); JavaScript de 3.480.548
  bytes a 3.005.334 bytes (aproximadamente 14 % menos). Son bytes sin gzip.

## Verificación reproducible

```sh
node --test tests/*.test.cjs
python3 tests/database.py
./node_modules/.bin/tsc --noEmit
CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo lint
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --max-workers 2
BASE_URL=http://localhost:8085 node tests/browser.cjs
```

22 pruebas unitarias pasan. PostgreSQL 17 aislado verifica toda la cadena de
migraciones y 12 grupos: 32 inscripciones compiten por 3 cupos, 12 reintentos
simultáneos, rollback ante fallo de pago, solapamientos, precios del servidor,
reemplazo de horarios, 8 retiros concurrentes, webhooks paralelos, permisos de
chat, paginación, contadores y permisos/métricas/calificaciones.
El contenedor de prueba se elimina al terminar; no usa credenciales de producción.
El test SQL emula JWT con GUCs; no emula servicios HTTP Auth, Storage ni Realtime.
Playwright verifica pago efectivo en demo, siete temas, búsqueda y ruta inexistente.
No sustituye pruebas de pasarela real ni pruebas nativas en dispositivos.

El export web, tipos y lint pasan. El build completo del Dockerfile se intentó,
pero el daemon no resuelve registry.npmjs.org (EAI_AGAIN), incluso con red host
y proxy heredado. Es un límite del entorno de comprobación; no se declara ese
build como validado. El export local sí se empaquetó por separado con nginx
para comprobar el comportamiento del runtime sin reinstalar dependencias.

## Aplicación a producción

La nueva migración es `20261005200000_fiabilidad_concurrencia.sql`. Hacer backup y
probar en staging. Antes de aplicarla, revisar sin borrar datos:

```sql
select a.id, b.id from public.reservas a join public.reservas b
  on a.cancha_id = b.cancha_id and a.fecha = b.fecha and a.id < b.id
  and a.estado <> 'cancelada' and b.estado <> 'cancelada'
  and a.hora_inicio < b.hora_fin and b.hora_inicio < a.hora_fin;
select referencia, count(*) from public.reservas
  group by referencia having count(*) > 1;
select id from public.reservas where hora_fin <= hora_inicio;
select id from public.cancha_disponibilidad
  where duracion_min <= 0 or hora_cierre <= hora_apertura or precio < 0;
```

Resolver registros inconsistentes con sus responsables. La migración falla
atómicamente si existen conflictos; no cancela reservas ni borra registros.
Coordinar una ventana de actualización: aplica migración, despliega ambas Edge
Functions y publica cliente. Los clientes antiguos que insertaban pagos e
inscripciones directamente dejarán de escribir; exigir actualización de versión.
`rapyd-webhook` requiere `--no-verify-jwt` y secretos Rapyd existentes; la firma
sigue siendo obligatoria. Validar checkout y webhook en sandbox, incluyendo
reintentos y reservas canceladas, antes de habilitar pagos reales.

## Trabajo que sigue requiriendo validación o implementación

- Capacidad real depende del plan de Supabase, conexiones, índices sobre datos
  reales y hosting. Medir p95, error rate, CPU, memoria y consultas a 50/100/500
  usuarios simultáneos en staging; estas pruebas no certifican una cifra de usuarios.
- Actualización del 6 de octubre: las fotos de perfil/posts/partidos ahora se
  suben al bucket media con límites y políticas por autor. La migración nueva
  y funciones de eliminación/moderación deben desplegarse antes de habilitarlo.
- La creación de un establecimiento con varias canchas y la publicación opcional
  de partido desde una reserva siguen siendo operaciones separadas. Si falla el
  partido, se conserva el comprobante de la reserva y se informa la situación.
- Reservas/pagos online pendientes necesitan caducidad y conciliación programadas;
  una cancelación cuyo proveedor ya cobró requiere reembolso gestionado en servidor.
  Se bloquea cancelar una reserva online confirmada desde el cliente para evitar
  liberar el horario sin revertir el dinero. No se implementó un flujo de reembolso.
- Historiales privados y listas administrativas conservan límites de la Data API
  en algunas pantallas; las métricas administrativas y el saldo ya se calculan en
  SQL sin truncamiento. Hace falta paginar esos historiales antes de volúmenes grandes.
