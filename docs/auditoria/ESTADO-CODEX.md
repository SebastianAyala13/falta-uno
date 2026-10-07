# Estado Codex · cola del 6 de octubre, noche

Rama: codex/fiabilidad. Sin producción ni push a main. La primera tanda de 8 (9→17) y su aplicación en curso son información aportada por responsable, **no verificación remota nuestra**. La novena 20261006200000_retencion_eliminacion.sql y delete-user nuevo siguen separados. Plazos 10 años/90 días: **pendientes de aprobación, sin cambios**. No fusionar la rama para publicar política antes del backend.

## 1 · Verificación posterior a primera tanda

Commit: **f57765a**.

Antes faltaba una comprobación posterior con roles reales y evidencia de rollback: historial de migraciones o deploy verde no prueban RPC, RLS ni defensas. Se entrega SQL compatible con SQL Editor, salida nombre | ok/falla | detalle. Requiere sesión autorizada de base y ejecutar completo, nunca sustituir ROLLBACK por COMMIT. Usa Juan del seed, UUID a0e00000-0000-4000-a000-000000000005, no admin/no suspendido, con reserva y pago pendientes propios. Si falta, informa falla; no crea ni borra filas. No se ejecuta seed-demo.sql (ese archivo limpia datos y contiene credenciales de ejemplo).

67 comprobaciones locales con **exactamente 17 migraciones** pasaron. Incluye firmas y permisos efectivos de EXECUTE de anon/authenticated/service_role, RLS, confirmación/precio/admin/pago rechazados; estado de filas/catálogo equivalente y TEMP desaparecido tras rollback. Control negativo: historial incorrecto y precio permitido con trigger desactivado deliberadamente en fixture detectados como falla; incluso UPDATE inesperadamente exitoso se revierte antes del siguiente intento. JSON: tanda1-verificacion-local-2026-10-06.json. Auth/history/Storage simulados, no blobs ni consola real.

Controles comunes: 54 unitarias, regresiones database.py, TypeScript y Expo lint pasaron; diff --check limpio. Pendiente: responsable ejecuta SQL después de primera tanda y guarda filas redactadas, antes de avanzar. Cero resultado remoto afirmado. No requiere cambios de cliente; inventario cotejado con RPC de main 795cd59.

## 2 · Preflight segunda tanda

Commit: **315fb0f**.

Antes solo se comprobaban los conflictos de primera tanda. La novena no copia datos a las tablas nuevas ni agrega un NOT NULL existente: dinero pendiente, suspensión y Storage antiguo no provocan fallo de instalación y no deben cortar workflow. Se agregan colisiones reales de relaciones/índices/tipos, columna, firmas de función, triggers y prerrequisitos. Solo inspección con READ ONLY REPEATABLE READ, formato tipo|cantidad|detalles; sin secretos, cambios de datos ni excepciones silenciosas. Se activa tras primera tanda, y no trata los objetos de una novena ya registrada como conflictos. No predice permisos de schema administrado, locks, falta de extensiones ni SQL modificado; cero conflictos no certifica instalación en cloud.

Pruebas: preflight_retencion.py → 10 tipos cero en esquema de 17 con reserva/pago pendiente, saldo/retiro en curso, suspendido y Storage heredado; mismo estado tras consulta; migración real pasó. Cinco colisiones preparadas en bases separadas → cada una detectada y migración realmente rechazada; ninguna limpieza para lograr éxito. Reconsulta con versión 18 registrada → cero colisiones falsas. JSON preflight-retencion-local-2026-10-06.json. representative_data.py pasó con el formato ampliado; el fixture ahora registra versiones simuladas como Supabase. database.py conserva cuatro conflictos intencionales y seis tipos nuevos cero en etapa anterior; todas sus regresiones pasaron. 54 unitarias, tsc, lint y diff --check pasaron.

Pendiente: responsable ejecuta preflight en ensayo propio de segunda tanda; workflow de main ya interpreta cantidades y corta (inspeccionado, sin editar .github). Ningún cambio de cliente requerido. No aprobaron plazos ni se aplicó la novena a producción.

## 3 · Ficha Edge

Commit: ficha y pruebas de este punto (`git log -1 --format=%h -- docs/auditoria/DESPLIEGUE-FUNCIONES.md`).

Faltaba una ficha operativa que separara autenticación del gateway, del handler y dependencias de migración: desplegar todas las funciones juntas publicaría delete-user antes de la novena. DESPLIEGUE-FUNCIONES.md describe las cinco, secretos solo por nombre, verify_jwt, respuestas sin credenciales y comprobación en ensayo sin datos reales. conciliar-pagos ya rechazaba secreto ausente; no fue necesario modificar el handler. Nueva prueba cubre secreto ausente/vacío y tres tokens, incluido Bearer undefined: 401, cero consultas y cero solicitudes a pasarela. Las cinco funciones rechazan POST anónimo configurado con 401; webhook sin configuración devuelve 500 sin efectos.

Pruebas reales: 61 unitarias pasaron, todas las regresiones database.py, 67 comprobaciones de primera tanda con rollback, TypeScript y Expo lint pasaron. Son handlers con servicios simulados; no certifican gateway Supabase, Deno desplegado ni pagos. diff --check limpio. Pendiente: responsable comprueba configuración efectiva y respuestas en staging; delete-user nuevo solo tras novena. Plazos aún no aprobados. Cliente pendiente: main lib/auth.tsx:302 debe presentar 409 de eliminación como solicitud pendiente, y constants/legal.ts:32 debe acompañar versión de consentimiento del despliegue coordinado; no se editaron.

## 4 · Guion tres cuentas
Pendiente en esta cola.
