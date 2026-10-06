# Nueva cola: privacidad, retención, conciliación y cierre

## Punto 1 · Política e inventario de tiendas

Problema y consecuencia: negación de finanzas, PayU y supuesto token remoto daban una declaración incompatible con la recogida real. Se reescriben política y respuestas con el mismo inventario: pantalla, almacén, receptor, plazo real o no verificado, borrado. Se incluyen Nominatim, banco/documento, fotos de todas las funciones, copias locales y límites de eliminación. No se prometen plazos de terceros desconocidos. Versión documental de consentimiento: **2026-10-06.1**.

Este commit describe el comportamiento anterior al nuevo mecanismo de retención; el punto 2 sustituirá esa sección con el mecanismo implementado y su estado de despliegue. Cambios respecto a anterior: corrige GPS web opcional, elimina atribución infundada de email al payload Rapyd, reconoce ausencia de TTL y desaparición de ledger del dueño. Cada cambio evita prometer una conducta que el código no tiene.

Pendiente cliente, sin editar: constants/config.ts:32 actualizar POLITICA_VERSION; app/(auth)/register.tsx:180 aviso/aceptación coherentes; lib/auth.tsx:241 registra versión al alta pero no tiene reaceptación de cuentas existentes. Claude debe coordinar publicación y aceptación antes de activar política. No se tocan mirror ni panel. Fuente externa aportada por responsable: siete rutas propias 200; normas del mirror 404; el bundle apunta al mirror por falta de EXPO_PUBLIC_SITE_URL. No se presentan como pruebas corridas aquí.

Pruebas ejecutadas: legal_pages.py (7 GET locales 200 sin sesión, ausente 404), 52 unitarias, todas las regresiones database.py, tsc y Expo lint: pasaron. Sin comprobaciones HTTPS nuevas. git diff --check sin errores.
