# Estado Codex · cola del 6 de octubre, noche

Rama: codex/fiabilidad. Sin producción ni push a main. Al 6 de octubre 20:55, responsable informa primera tanda aplicada/verificada (17), conciliar-pagos y moderar-contenido v1 desplegadas y web main 795cd59 con EXPO_PUBLIC_SITE_URL. Los 11 commits anteriores están integrados en integracion/retencion 52edd0f, PR #2 borrador/CI verde. Son datos aportados por responsable, **no verificación remota nuestra**. No escribir en integración ni main. Actualización del responsable: novena aplicada en producción (Actions #9, 18 migraciones), verificador integrado en PR #2 9c7ad9a y delete-user nuevo redesplegándose, merge posterior. No se comprobó producción desde Codex. Plazos 10 años/90 días: **pendientes de aprobación, sin cambios**. No fusionar la rama para publicar política antes del backend.

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

Commit: **fd219d9**.

Faltaba una ficha operativa que separara autenticación del gateway, del handler y dependencias de migración: desplegar todas las funciones juntas publicaría delete-user antes de la novena. DESPLIEGUE-FUNCIONES.md describe las cinco, secretos solo por nombre, verify_jwt, respuestas sin credenciales y comprobación en ensayo sin datos reales. conciliar-pagos ya rechazaba secreto ausente; no fue necesario modificar el handler. Nueva prueba cubre secreto ausente/vacío y tres tokens, incluido Bearer undefined: 401, cero consultas y cero solicitudes a pasarela. Las cinco funciones rechazan POST anónimo configurado con 401; webhook sin configuración devuelve 500 sin efectos.

Pruebas reales: 61 unitarias pasaron, todas las regresiones database.py, 67 comprobaciones de primera tanda con rollback, TypeScript y Expo lint pasaron. Son handlers con servicios simulados; no certifican gateway Supabase, Deno desplegado ni pagos. diff --check limpio. Pendiente: responsable comprueba configuración efectiva y respuestas en staging; delete-user nuevo solo tras novena. Plazos aún no aprobados. Cliente pendiente: main lib/auth.tsx:302 debe presentar 409 de eliminación como solicitud pendiente, y constants/config.ts:32 debe acompañar versión de consentimiento del despliegue coordinado; no se editaron.

## 4 · Guion tres cuentas

Commit: **1037012**.

Faltaba un recorrido reproducible con dos teléfonos y navegador que distinguiera resultado esperado de prueba ejecutada. Se entregan 29 pasos con actor, pantalla, esperado y evidencia de fallo: partido/chat, carrera de reserva en efectivo, historiales, muro/bloqueo/reporte/moderación/suspensión y solicitud de borrado con/sin obligaciones. D necesita admin habilitado por responsable solo en ensayo; no se concede automáticamente a dueños. Online apagado exige variable ausente/vacía, no texto false. Saldo ficticio para caso pendiente solo en ensayo autorizado; no hay desembolsos, borrados de datos para pasar ni falsa liquidación. Se termina con D pendiente, no borrando al único admin.

Verificación real: cotejo de rutas y controles actuales, comprobación de estructura de 29 filas, referencias locales existentes y diff --check. Guion NO ejecutado en dispositivos, ni Auth/Storage/gateway reales. No se afirma éxito funcional remoto. Pruebas de código de punto 3: 61 unitarias/regresiones/tsc/lint pasadas, sin presentarlas como ejecución de este recorrido. Pendiente: dos personas completan estados y evidencias en staging; novena + delete-user nuevo + UX de 409 antes de borrado; liquidación final del dueño requiere otro ensayo controlado. Plazos no aprobados. Cliente: lib/auth.tsx:302, constants/config.ts:32 y configuración constants/config.ts:71, descritos en guion; archivos protegidos intactos.


## Cola 20:55 · 1 · Verificación posterior a segunda tanda

Commit: **2726186** (integrado por responsable en PR #2, 9c7ad9a).

Antes solo había verificador de 17, que no prueba la retención ni debe aceptar 18 como primera tanda. Se entrega scripts/db/verificar_produccion_tanda2.sql para SQL Editor, formato nombre | ok/falla | detalle, BEGIN/ROLLBACK completo. Comprueba versiones exactas 18/última 20261006200000, tres tablas/RLS/condiciones de políticas y permisos de tabla, seis firmas/EXECUTE efectivos por rol, nueve triggers activos con eventos y función (incluido Storage), columna de desidentificación y ausencia de cron del purgador. Los grants default de baseline conceden service_role EXECUTE también a helpers; anon/authenticated deben carecer de EXECUTE. No confundir una función purgadora existente con un job autorizado.

Negativas con Juan seed a0e00000-0000-4000-a000-000000000005, no admin/no suspendido: solicitudes/archivo ajenos invisibles e INSERT en archivo/ejecuciones rechazados. También se rechaza RPC directa de solicitud de jugador; Edge la llama con service_role. Se ensaya ese permiso de servidor y se registra recibo en la transacción del operador; Juan ve su recibo pendiente y el guard bloquea la cascada Auth privilegiada. Se usan registros centinela mínimos para lectura ajena (titular dueño seed termina 000001), solo dentro de rollback. No hay nuevas cuentas, ejecución del seed destructivo ni secretos en salida. Requiere obligación real ya presente en seed; si ninguna sigue pendiente, informa falla/no ejecutado, no fabrica aprobación.

Pruebas reales: python3 tests/verificar_tanda2.py → **41/41 ok** con 18 migraciones. Snapshot de filas/catálogo/ACL públicos, Auth, Storage, historial y cron igual después; tabla TEMP ausente. Con 17, faltantes informados sin abortar. cron ausente y catálogo vacío pasan; job incluso inactivo detectado como falla. Controles defectuosos deliberados detectan 13 fallas: permisos/políticas ampliados, cuatro negativas vulneradas, guard de perfil/Storage desactivados y cron registrado. INSERT indebido y cascada Auth inesperadamente aceptados quedan revertidos. Evidencia: tanda2-verificacion-local-2026-10-06.json. **61 unitarias** y **27 controles de privacy_retention.py** pasaron; diff --check limpio. PostgreSQL 17 aislado con metadatos Auth/Storage y catálogo cron simulados; no gateway, SDK Auth/Storage ni worker cron reales. Ninguna ejecución nuestra contra producción.

Uso: después de aplicar novena, abrir SQL completo y ejecutar en una sola sesión de base autorizada; no cambiar ROLLBACK. Guardar solo las 41 filas redactadas. Si falta actor/obligación, no contar ese bloque como pasado. Si cron no permite lectura completa (RLS/privilegios), informa falla, no concluye ausencia a partir de lista filtrada. No imprime cron.command ni ejecuta purga. No deja solicitud o archivo centinela persistido; no prueba una solicitud real a través de HTTP.

Pendiente: responsable aprueba plazos antes de fase 6, aplica novena en tanda propia y ejecuta verificador. El permiso TRIGGER sobre storage.objects y dos triggers propios existentes fueron confirmados por otra sesión según actualización del responsable; no lo verificó Codex. Ningún cambio de cliente requerido por este verificador; siguen los pendientes de UX/consentimiento ya documentados. Migración del PR intacta.

## Cola 20:55 · 2 · Plan B Storage

**Baja prioridad/en espera por actualización del responsable**: postgres sí tiene TRIGGER sobre storage.objects. No se creó codex/plan-b-storage ni se modificó la migración del PR. No hay implementación ni pruebas de variante sin trigger que declarar. Si vuelve a necesitarse, exclusivamente rama separada; sin fallback silencioso ni push a integración/main. Se priorizó entregar el verificador para la aplicación inmediata de novena.


## Cola fase 7 / beta · 1 · Guía de panel para Valen

Commit: `docs(fase7): guia de panel con SQL ensayado y pausa de ambos jobs`; hash mediante `git log -1 --format=%h -- docs/auditoria/PASOS-FASE-7.md`.

Antes había scripts separados con metacomandos de terminal y varias tablas de resultados: era fácil omitir un requisito, interpretar encolada como fallo o confundir un cron succeeded con Edge ok. PASOS-FASE-7.md explica generar 64 caracteres aleatorios en gestor de Windows, Edge Secrets/Vault por interfaz (sin valores en SQL/historial/chat), nombres exactos, flag de devoluciones false, JWT exclusivo de conciliar, extensiones, bloques completos de instalación en orden, primeros tres ciclos y pausa cron.alter_job de ambos. El verificador ahora entrega una sola tabla de seis filas, también con job/última ejecución diaria de retención. Requisitos en tabla única; no hay selección manual de fragmentos SQL. ⚠️ diferencia liberación de vencimientos y purga irreversible, no cancela HTTP ya encolado ni deshace cambios. Aprobación explícita de plazos sigue siendo requisito antes de activar retención; no se supone por tener novena aplicada.

Pruebas reales: tests/fase7_editor.py extrajo los cinco bloques del documento, verificó identidad de los tres scripts sin línea psql y los ejecutó en PostgreSQL 17 con 18 migraciones. **13/13 controles pasaron**: requisitos, dos jobs únicos, instalación sin HTTP/purga, reintento sin duplicados, tres ciclos (encolada=1; ok=0/1/2), expiración SQL real de reserva sintética, seis filas de observación sin secreto, pausa activa=false de ambos y petición en curso conservada. JSON fase7-editor-local-2026-10-06.json. scheduler_sql.py pasó también errores HTTP, falta de configuración, sin respuesta, alarma y permisos. **61 unitarias**, TypeScript y Expo lint pasaron; diff --check limpio. Vault/cron/net son dobles SQL: no se ejecutó worker ni HTTP Edge real, panel/Windows ni producción.

Pendientes: Valen sigue la guía con respaldo/aprobación y registra tres ciclos reales; confirmar nombres/rótulos de panel si difieren. Monitor externo/avisos sigue pendiente. Intento de consulta de documentación web oficial bloqueado por proxy (403), por eso no se afirma haber recorrido interfaz actual. Ningún cambio de cliente necesario; cambia únicamente salida del script administrativo de solo lectura. No se modificaron instaladores ni función Edge, ni main/integración.
