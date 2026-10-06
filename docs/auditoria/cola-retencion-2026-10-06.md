# Nueva cola: privacidad, retención, conciliación y cierre

## Punto 1 · Política e inventario de tiendas

Problema y consecuencia: negación de finanzas, PayU y supuesto token remoto daban una declaración incompatible con la recogida real. Se reescriben política y respuestas con el mismo inventario: pantalla, almacén, receptor, plazo real o no verificado, borrado. Se incluyen Nominatim, banco/documento, fotos de todas las funciones, copias locales y límites de eliminación. No se prometen plazos de terceros desconocidos. Versión documental de consentimiento: **2026-10-06.1**.

Este commit describe el comportamiento anterior al nuevo mecanismo de retención; el punto 2 sustituirá esa sección con el mecanismo implementado y su estado de despliegue. Cambios respecto a anterior: corrige GPS web opcional, elimina atribución infundada de email al payload Rapyd, reconoce ausencia de TTL y desaparición de ledger del dueño. Cada cambio evita prometer una conducta que el código no tiene.

Pendiente cliente, sin editar: constants/config.ts:32 actualizar POLITICA_VERSION; app/(auth)/register.tsx:180 aviso/aceptación coherentes; lib/auth.tsx:241 registra versión al alta pero no tiene reaceptación de cuentas existentes. Claude debe coordinar publicación y aceptación antes de activar política. No se tocan mirror ni panel. Fuente externa aportada por responsable: siete rutas propias 200; normas del mirror 404; el bundle apunta al mirror por falta de EXPO_PUBLIC_SITE_URL. No se presentan como pruebas corridas aquí.

Pruebas ejecutadas: legal_pages.py (7 GET locales 200 sin sesión, ausente 404), 52 unitarias, todas las regresiones database.py, tsc y Expo lint: pasaron. Sin comprobaciones HTTPS nuevas. git diff --check sin errores.

## Punto 2 · Retención y cierre protegido

Problema: la cascada del dueño destruía contabilidad y el borrado del jugador
conservaba snapshots personales sin plazo. Implementado en nueva migración
20261006200000_retencion_eliminacion.sql y delete-user: petición persistente,
409 contextual si pendiente, bloqueo de nuevas obligaciones/archivos,
revalidación final y archivo mínimo con acceso de contraparte. Guarda contabilidad
10 años, reportes/recibos completados 90 días; no purga deudas sin resolver.
Purgador acotado y programación diaria preparados, no desplegados. Política
pública/declaraciones actualizadas con estos plazos y límites de terceros.

Pruebas reales: 27 comprobaciones PostgreSQL en privacy_retention.py, incluidas
dos carreras con transacciones superpuestas y dinero que aparece tras lista;
54 unitarias incluidas Edge solicitud bloqueada y error seguro; todas las
regresiones database.py, tsc, Expo lint y HTML locales pasaron. Cron/Auth/Storage
son dobles explícitos, no se afirma liquidación Rapyd real. Solo purga de
fixtures envejecidos para probar plazos; ninguna limpieza para pasar migraciones.

Detalle, límites, plazos propuestos sujetos a validación del responsable y
cliente con líneas de main 795cd59 en politica-retencion-cuentas-2026-10-06.md.
El cliente todavía oculta el mensaje contextual y no muestra archivo contable;
Claude debe adaptar eso y consentimiento antes de publicar coordinadamente.
El script SQL del purgador instalado dos veces produjo un solo job en dobles;
no se instaló cron real.

## Punto 3 · Verificación humana de conciliación

Problema: instalar horario y obtener cron success no acreditaba llamada Edge,
caducidad ni devolución; una deuda podía pasar desapercibida. Guía
COMPROBAR-CONCILIACION.md con pasos antes/después, tres ciclos, interpretación
de primeros lotes y tabla de alarmas/responsables. verificar_conciliacion.sql
es solo lectura y no devuelve secretos. Se explicita gateway JWT de función
con clave propia y se distingue de delete-user con JWT habilitado.

Pruebas ejecutadas: scheduler_sql.py ejecutó consultas READ ONLY, alarma por
heartbeat viejo y recuperación, 500, sin respuesta, config ausente, conteos y
permisos; PostgreSQL real con cron/net/Vault simulados, no worker/HTTP real.
54 unitarias, todas las regresiones database.py, tsc, Expo lint y diff --check
pasaron. Pendientes: operador completa guía en staging, configura monitor externo
y prueba pausa/recuperación y gateway/PSP reales antes de producción. Dashboard
opcional requiere lib/admin.ts:45 y app/admin/index.ts; sin cambios de cliente.
