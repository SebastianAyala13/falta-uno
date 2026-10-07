# Estado Codex · cola del 6 de octubre, noche

Rama: codex/fiabilidad. Sin producción ni push a main. La primera tanda de 8 (9→17) y su aplicación en curso son información aportada por responsable, **no verificación remota nuestra**. La novena 20261006200000_retencion_eliminacion.sql y delete-user nuevo siguen separados. Plazos 10 años/90 días: **pendientes de aprobación, sin cambios**. No fusionar la rama para publicar política antes del backend.

## 1 · Verificación posterior a primera tanda

Commit: el commit que añade scripts/db/verificar_produccion_tanda1.sql (resolver `git log -1 --format=%h -- scripts/db/verificar_produccion_tanda1.sql`).

Antes faltaba una comprobación posterior con roles reales y evidencia de rollback: historial de migraciones o deploy verde no prueban RPC, RLS ni defensas. Se entrega SQL compatible con SQL Editor, salida nombre | ok/falla | detalle. Requiere sesión autorizada de base y ejecutar completo, nunca sustituir ROLLBACK por COMMIT. Usa Juan del seed, UUID a0e00000-0000-4000-a000-000000000005, no admin/no suspendido, con reserva y pago pendientes propios. Si falta, informa falla; no crea ni borra filas. No se ejecuta seed-demo.sql (ese archivo limpia datos y contiene credenciales de ejemplo).

67 comprobaciones locales con **exactamente 17 migraciones** pasaron. Incluye firmas y permisos efectivos de EXECUTE de anon/authenticated/service_role, RLS, confirmación/precio/admin/pago rechazados; estado de filas/catálogo equivalente y TEMP desaparecido tras rollback. Control negativo: historial incorrecto y precio permitido con trigger desactivado deliberadamente en fixture detectados como falla; incluso UPDATE inesperadamente exitoso se revierte antes del siguiente intento. JSON: tanda1-verificacion-local-2026-10-06.json. Auth/history/Storage simulados, no blobs ni consola real.

Controles comunes: 54 unitarias, regresiones database.py, TypeScript y Expo lint pasaron; diff --check limpio. Pendiente: responsable ejecuta SQL después de primera tanda y guarda filas redactadas, antes de avanzar. Cero resultado remoto afirmado. No requiere cambios de cliente; inventario cotejado con RPC de main 795cd59.

## 2 · Preflight segunda tanda
Pendiente en esta cola.

## 3 · Ficha Edge
Pendiente en esta cola.

## 4 · Guion tres cuentas
Pendiente en esta cola.
