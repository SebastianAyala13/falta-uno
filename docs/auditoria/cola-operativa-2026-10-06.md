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
