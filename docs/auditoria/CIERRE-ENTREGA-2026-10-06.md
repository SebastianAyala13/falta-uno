# Cierre de entrega · 6 de octubre de 2026

Rama publicada: **codex/fiabilidad**. No se desplegaron migraciones, funciones, horarios ni variables en producción. No se modificaron app/**, components/**, lib/**, constants/**, types/**, .github/** ni archivos de build. No se editó ni publicó el espejo legal. La integración a main sigue a cargo de Claude/responsable.

## Los cuatro puntos de esta cola

| Punto / commit | Qué estaba mal y consecuencia | Qué se entregó | Evidencia y pendiente concreto |
|---|---|---|---|
| 1 · d4ab6f1 | Declaración negaba finanzas, atribuía PayU/token push remoto y no describía recogida/borrado real; podía producir declaraciones falsas a tiendas | legal/privacidad.html y docs/RESPUESTAS-PRIVACIDAD-TIENDAS.md con inventario común y versión documental **2026-10-06.1** | 7 HTML locales 200 y ausente 404; 52 unitarias, regresiones SQL, tsc/lint pasaron. Falta versión de cliente/reaceptación y publicación coordinada |
| 2 · e61337f | Cascada del dueño destruía ledger/retiros; reportes ajenos guardaban texto/foto indefinidamente | Migración 20261006200000_retencion_eliminacion.sql, Edge delete-user, solicitud persistente, bloqueo monetario revalidado, archivo mínimo, purga acotada y horario preparado; política actualizada con esos plazos | **27 comprobaciones** SQL, dos carreras reales, dinero llegado tras preparación, acceso de contraparte y purga por plazo; **54 unitarias**, regresiones SQL, tsc/lint y HTML pasaron. Falta staging real, aprobación de plazos por responsable, UI contextual, horario/monitor y publicación |
| 3 · f507f0d | Un cron success no prueba respuesta de Edge ni devolución; ausencia de una comprobación humana facilita fallo silencioso | [COMPROBAR-CONCILIACION.md](COMPROBAR-CONCILIACION.md) y scripts/db/verificar_conciliacion.sql solo lectura | scheduler_sql.py ejecutó consultas READ ONLY, alarma por heartbeat viejo/recuperación y fallos HTTP simulados; 54 unitarias, regresiones SQL, tsc/lint pasaron. Falta seguir guía con gateway/cron/net/Vault reales, monitor externo y responsable |
| 4 · este commit de cierre | Evidencias locales/externas y pendientes podían interpretarse como preparación integral o capacidad garantizada | Este único resumen vigente, con fuentes y límites; reensayo de respaldo con esquema de retención | Respaldo actual: resultados en respaldo-retencion-2026-10-06.json; diff --check y comprobación de enlaces/archivos. No cambia runtime; reutiliza validación completa de f507f0d, sin atribuir pruebas no corridas |

El hash del punto 4 es el commit que incorpora este archivo (`git log -1 --format=%h -- docs/auditoria/CIERRE-ENTREGA-2026-10-06.md`) y se comunica en la entrega final. Los commits se publicaron individualmente tras sus controles; ningún force push ni push a main.

## Retención: lo que hace el código preparado

Pedir borrado y completar cierre son estados distintos. La solicitud queda registrada, incluso cuando no puede completarse por reserva/partido futuro, pago/devolución pendiente, saldo positivo o negativo o retiro en curso. No se borran registros para liquidar ficticiamente. Nuevas obligaciones/fotos relacionadas se bloquean mientras la solicitud esté abierta; cancelación/liquidación legítimas siguen sujetas a permisos. El trigger vuelve a comprobar antes de eliminar el perfil por Auth o SQL directo.

Comprobantes mínimos de pagos/reservas/ledger/retiros quedan **10 años desde archivo**, sin campos de nombre/contacto/documento/banco/cuenta/foto/texto libre del usuario eliminado. La contraparte que conserva cuenta mantiene acceso por RLS; al borrarla pierde su vínculo UUID. Referencias siguen siendo pseudónimas, no anonimato irreversible. Reportes: **90 días desde creación**; texto/foto/enlace del autor borrado se minimizan inmediatamente. Recibos completados: **90 días desde cierre**, sin UUID del usuario. Devoluciones terminales: **10 años desde última actualización**. Deudas sin resolver y solicitudes pendientes no se purgan por antigüedad.

Son plazos propuestos e implementados, pendientes de validación jurídica/contable del responsable antes de producción; no se presentan como dictamen legal. Purga diaria propuesta 03:15 Bogotá, por lotes de 1000 por categoría, requiere cron en UTC confirmado e instalación explícita. **No existe una purga diaria efectiva solo por tener la migración**. Detalle y consultas en [política de retención](politica-retencion-cuentas-2026-10-06.md); evidencia [retencion-cuenta-2026-10-06.json](retencion-cuenta-2026-10-06.json).

Auth/Storage/cron del ensayo son dobles explícitos; la liquidación fue sintética mediante RPC y cambios de estado de fixture. Se eliminaron únicamente fixtures para ensayar borrado/purga; ninguna eliminación de datos fue un arreglo para hacer pasar una migración. La instalación de la nueva migración no purga registros.

## Evidencia anterior y qué cubre

- Respaldo anterior: 40ad139, estado de tablas y catálogo/ACL equivalente, rechazo de base poblada y copia corrupta. Reensayo en este cierre instala también la nueva migración y compara el esquema actual completo de public. Dataset pequeño: las tablas nuevas de retención están vacías en ese ensayo; sus datos/reglas se probaron en el ensayo específico de 27 comprobaciones, no en un respaldo representativo de volumen. Volcado **0,652 s** y restauración **0,992 s** en ese fixture; no son tiempos de recuperación de producción.
- Excluye credenciales/sesiones y usuarios reales de Auth, metadatos/blobs **y políticas/triggers administrados de Storage**, Vault, roles globales, extensiones binarias, publicación Realtime, horarios y configuración de proveedores. El trigger nuevo sobre storage.objects necesita preparación/verificación separada. No acredita restauración integral de Supabase.
- Dataset: 14bbb0c con ajustes posteriores; generador N/M/K sintético, historial largo, límites horarios, vencimientos, retiros, suspensión y reportes. Corregido auto-reporte al usar pocos jugadores. No crea identidades válidas Auth ni fotos binarias reales.
- Conciliación anterior: 776401b más f507f0d, PostgreSQL real con pg_cron/pg_net/Vault simulados. Job cada minuto y alarmas preparados; **no** scheduler real desplegado ni mensaje de alerta entregado.
- Privacidad anterior: 97360f4 probó el comportamiento problemático de las cascadas **antes de la nueva migración**. Ese JSON es histórico; el resultado vigente de retención es el de 27 comprobaciones. El documento de tiendas de julio fue sustituido, no debe copiarse una versión vieja.

## Capacidad: límites que no deben omitirse

**50, 100 y 500 son conexiones/sesiones simuladas de PostgreSQL local. NO son usuarios de la app soportados, NO capacidad de Supabase y NO un compromiso de servicio.** Los ensayos 772328a son anteriores a los nuevos guards de retención: no se reejecutó ese benchmark tras esta cola ni se infiere su rendimiento nuevo.

Ráfagas de siete operaciones por sesión, acceso libpq directo, RLS donde corresponde, roles de jugador/dueño/admin, fixtures, CPU compartida y max_connections aumentado a 650. Una tanda no es carga sostenida, uso móvil ni recorrido completo de una persona. No incluye pool/PgBouncer, API PostgREST, Auth, Storage, Realtime real, red de cliente, mapas, Rapyd, costos o comportamiento nativo.

| Sesiones locales | p95 total primer ensayo | p95 total segundo ensayo instrumentado |
|---|---|---|
| 50 | 425,878 ms | 457,699 ms |
| 100 | 898,293 ms | 1.362,713 ms |
| 500 | 4.482,444 ms | 7.951,877 ms |

En la tanda de 500 hubo 3500 solicitudes, cero errores SQL inesperados y **805 rechazos de negocio** (cupos/turnos disputados), no 3500 operaciones exitosas. El segundo ensayo añadió instrumentación y compartió recursos con otras pruebas; no es comparación controlada para elegir la cifra conveniente. Se observaron CPU cerca del límite y esperas de locks/contención; feed tuvo latencias altas. Planes EXPLAIN ANALYZE BUFFERS son locales; un plan cálido corto no promete p95 del servicio.

Fuentes completas con p50/p95/p99, errores, dataset y entorno: [primer ensayo](capacidad-postgres-local-primer-ensayo-2026-10-06.json), [segundo ensayo](capacidad-postgres-local-2026-10-06.json). Falta medir API/SDK y servicios reales en staging con carga representativa y objetivos definidos.

## Legal: conclusión corregida por verificación externa

El responsable comunicó el 6 de octubre que **las siete páginas responden 200 sin sesión en https://falta-uno.kodarify.com/legal/**. Disponibilidad del dominio propio: pendiente **cerrado con evidencia aportada por responsable**, no con una comprobación HTTP nueva nuestra. El rechazo CONNECT 403 anterior era del proxy del entorno y no evidencia de caída de esos sitios.

El responsable también confirmó **404 de normas-comunidad.html en el mirror GitHub Pages** y que el bundle desplegado sigue apuntando allí por ausencia de variable. El enlace de producción está roto hasta configurar en panel **EXPO_PUBLIC_SITE_URL=https://falta-uno.kodarify.com** y reconstruir/desplegar con freno manual. No basta cambiar una variable después de generar un bundle Expo: se incorpora al build. **No tocar el espejo.** Las otras respuestas HTTP del espejo no se infieren de este 404. Tras publicar la nueva política, verificar su contenido/versión, no reabrir como desconocida la disponibilidad ya comprobada por el responsable.

Las URLs guardadas realmente en Play Console/App Store Connect y el binario final siguen sin inspeccionarse aquí. La web accesible no demuestra que las fichas usen ese dominio ni que la política nueva esté desplegada.

## Lo que Claude debe cambiar en su territorio

Líneas basadas en main 795cd59 cuando se inspeccionó; reubicar si main avanzó. No se editaron esos archivos.

| Archivo / línea | Cambio necesario |
|---|---|
| constants/config.ts:32 | POLITICA_VERSION = 2026-10-06.1; HTML versionado solo no cambia aceptación del cliente |
| lib/auth.tsx:251 / app/(auth)/register.tsx:180 | Registro/aviso y reaceptación de usuarios existentes cuando corresponda; no falsificar aceptación actualizando timestamps por SQL |
| lib/auth.tsx:302–304 (:292–294 en codex) | Leer body 409 del contexto de functions.invoke y mostrar que la solicitud se recibió y qué falta; hoy lo reemplaza por error genérico |
| app/(tabs)/perfil.tsx:41 | Estado de solicitud, soporte y reintento tras liquidación; recepción no es cierre completado; enlace público también para suspendidos |
| lib/canchas.ts:214 / lib/store.ts:226 | Historial de comprobantes archivo_contable de la contraparte cuando desaparece cancha/partido; no simular cuenta borrada como cero transacciones |
| types/database.ts:292 | Tipos de nuevas tablas/RPC de retención para lectura del cliente, sin ampliar permisos |
| constants/config.ts:20 | Construcción del origen sin slash final/duplicación de /legal; variable del panel y nuevo build son el arreglo del enlace desplegado confirmado |
| lib/admin.ts:45 / app/admin/index.ts | Dashboard opcional de alarma/deuda/última ejecución; no sustituye monitor externo ni expone secreto del job |

## Qué falta y qué no se afirma

1. Integración por responsable en main y cliente anterior; publicar política, consentimiento, dominio y backend coordinadamente.
2. Validar plazos contables, responsable/canal y atención de solicitudes, sin exigir renuncia al dinero. Registrar excepciones reales de proveedores y contratos; no elegir “Not shared” por comodidad.
3. Staging Supabase: restore completo separado de Auth/Storage, migraciones con preflight y respaldo, eliminación con archivos reales, carreras con API y webhook, gateway JWT de cada función. Nuevos triggers de schema administrado requieren ese ensayo.
4. Seguir guía humana de conciliación: tres ciclos reales, falla/recuperación, alarma recibida; instalar purgador y monitor. Sin monitoreo externo, la base no avisa por sí sola cuando cae.
5. Rapyd sandbox: checkout, firmas/webhook, expiración tardía, devolución confirmada y ambigua, reintentos. Pago en dinero real y custodia/transferencia no certificados. Mantener activación separada con freno manual.
6. Carga API/SDK real y pruebas en dispositivos Android/iOS, binarios firmados, permisos, accesibilidad, enlaces y borrado completo; formularios vigentes y revisión de las tiendas.

**No se puede afirmar capacidad real de Supabase, pasarela certificada, recuperación integral, cron/alertas desplegados, purga efectiva, eliminación completa de terceros/proveedores ni aprobación de Android/iOS.** Esta entrega proporciona implementación y evidencia local, no sustituye esos controles. Los pasos de producción los ejecuta el responsable en orden y con freno manual.
