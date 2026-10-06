# Plan de continuidad para Claude — Falta Uno

Fecha: 6 de octubre de 2026. Objetivo: lanzar una web útil y estable para jugadores y establecimientos, medir su capacidad y preparar Android/iOS con evidencia verificable. Este documento es un plan; no certifica producción ni aprobación de tiendas.

## 1. Contexto que debes conservar

Repositorios: `SebastianAyala13/falta-uno` y `SebastianAyala13/falta-uno-legal`, ambos en `main`. Lee `AGENTS.md`, `CLAUDE.md`, `docs/DESIGN.md` y los documentos siguientes antes de cambiar código:

- `docs/auditoria/fiabilidad-y-capacidad.md`.
- `docs/auditoria/revision-tiendas-2026-10-06.md`.
- `docs/superpowers/plans/2026-10-05-fiabilidad-y-concurrencia.md`.
- `docs/superpowers/plans/2026-10-06-revision-tiendas.md`.
- `docs/CUMPLIMIENTO-TIENDAS.md` y `docs/GUIA-PUBLICACION-GOOGLE-PLAY.md`.

La conversación aportada termina en `7da4eaf`, con recuperación web, aviso de suspensión y distinción entre fallo de red y recurso inexistente. Antes aparecen `c29f30e`, `c8ebb9e`, `537a5a0` y `74d584c`. El entorno de Codex parte de `86a5ae8` y contiene cambios extensos SIN COMMIT de fiabilidad, concurrencia, rendimiento y tiendas. No asumas que esos cambios están en GitHub o en producción. Recupera los archivos/diff de este entorno antes de integrar. No uses reset destructivo ni reemplaces archivos completos por una versión antigua.

Los informes de Codex registran 40 pruebas unitarias y 14 grupos SQL, tipos/lint, exportaciones y revisión web local. Las pruebas SQL usan PostgreSQL con stubs mínimos de Auth/Storage: no prueban Supabase completo. No hay evidencia de pruebas de carga, pagos reales/sandbox de extremo a extremo, compilación nativa firmada ni aprobación de tiendas. Reejecuta los controles después de integrar.

La conversación informa de Dokploy y SMTP Gmail configurados, registro sin confirmación y credenciales expuestas anteriormente. Esto debe verificarse en la configuración vigente. Un HTTP 200 de recuperación y un cambio del límite de correos no prueban entrega final ni remitente correcto. Sigue el flujo completo con una cuenta de pruebas; el enlace puede comenzar en el endpoint de verificación de Supabase y después redirigir a la app. Comprueba el destino final, no solamente el texto del enlace.

## 2. Reglas de ejecución

- Trabaja por fases y commits pequeños revisables; documenta archivos, pruebas, resultado y pendientes reales.
- Conserva Expo SDK 57 y consulta su documentación exacta antes de cambios nativos.
- Mantén los siete temas, accesibilidad, movimiento reducido y diseño existente.
- Los importes, roles, cupos y estados financieros se validan en servidor. Una vuelta del navegador desde el checkout nunca acredita un pago.
- Los cambios se prueban primero en un entorno independiente. No borres seeds de producción: las cascadas pueden eliminar información relacionada.
- No imprimas secretos, tokens, contraseñas ni enlaces de recuperación completos en logs o entregables.
- Si falta una credencial, completa todo el trabajo independiente y deja el bloqueo concreto. No declares la fase completada.
- No publiques migraciones nuevas en `main` sin preparar el despliegue: `.github/workflows/db-migrations.yml` aplica directamente a producción cuando cambian migraciones/config. Dokploy puede reconstruir la web por separado. Evita que ambas operaciones compitan.

## 3. Fases, en orden

### Fase 0 — Unificar el estado y proteger el despliegue (P0)

1. Inventaría commits locales/remotos, cambios de ambos repositorios, migraciones realmente aplicadas, funciones desplegadas y versión servida por Dokploy. Registra evidencia sin datos personales.
2. Conserva una copia del diff incluyendo archivos nuevos. Integra en una rama de trabajo los cambios de Claude y Codex resolviendo conflictos por comportamiento.
3. Unifica los diálogos: Codex aporta `lib/alert.ts`/`AlertProvider`, Claude aporta `lib/dialogo.ts`/`Dialogo`. Elige una implementación común que funcione en web y muestre todas las opciones de moderación en Android; evita montar dos proveedores y duplicar mensajes.
4. Conserva `usePartido` y las lecturas por ID: no vuelvas a depender de que un elemento esté en la primera página del feed. Separa carga, error/reintento, ausencia real y bloqueo en partido/publicación. El texto de inexistencia no debe aparecer junto a un error de red.
5. Integra recuperación web con origen permitido y recuperación nativa. Maneja errores de `setSession`, enlaces vencidos/reutilizados y limpieza de tokens de la URL; no dejes una sesión anterior habilitando un enlace inválido.
6. Crea staging Supabase independiente y un despliegue web de pruebas. Añade CI de tipos, lint y pruebas antes del despliegue y un mecanismo explícito de promoción a producción. Evita que el pipeline actual aplique schema mientras sirve un cliente incompatible.

**Cierre:** rama integrada sin cambios perdidos; pruebas verdes; matriz de diferencias entre local/staging/producción; despliegue ensayable y promoción documentada.

### Fase 1 — Autenticación y seguridad operativa (P0)

1. Rota las credenciales previamente compartidas: contraseña de cuenta, contraseña de aplicación SMTP y claves Wompi antiguas. Actualiza consumidores y verifica funcionamiento antes de revocar las antiguas cuando sea técnicamente posible; revoca de inmediato una credencial explotada. Inventaría además accesos Supabase/Dokploy/GitHub expuestos, sin rotar claves públicas por confusión.
2. Verifica Site URL y redirecciones exactas de producción, staging y móvil. Prefiere destinos explícitos a comodines amplios. Pasa `EXPO_PUBLIC_SITE_URL` como argumento de compilación en Dokploy: las variables públicas de Expo quedan incrustadas en el bundle.
3. Prueba registro, login, recuperar contraseña, cerrar sesión, restaurar sesión, cambio de usuario, suspensión y eliminación con cuentas desechables. Decide explícitamente la política de confirmación de email y prueba sus consecuencias.
4. Para crecimiento, configura correo transaccional con dominio propio y SPF/DKIM/DMARC según el proveedor; mide entrega, rebotes y límites. No aumentes límites sin controles de abuso. CAPTCHA/límites en puntos expuestos según riesgo y pruebas.
5. Prueba RLS/RPC/Storage como invitado, jugador, dueño, suspendido y administrador, incluyendo intentos HTTP directos de cambiar roles, ver información ajena, falsificar propietario y acreditar pagos.
6. Revisa borrado de cuentas con reservas futuras, saldos, retiros y pagos: define retención/anonymización legal y cierre operativo. Una cascada no debe borrar obligaciones pendientes ni destruir el registro contable. Documenta cualquier retención y asegúrate de que el usuario pueda solicitar/eliminar su cuenta.

**Cierre:** recuperación recibida y completada de extremo a extremo; permisos negativos probados; secretos expuestos revocados; borrado compatible con obligaciones y política publicada.

### Fase 2 — Reservas y dinero consistentes (P0)

Conserva las operaciones atómicas de inscripción, cupos, reservas sin solapamientos, retiros y confirmación de pagos añadidas por Codex. Revisa además:

1. Alta de establecimiento con varias canchas: RPC transaccional/idempotente para que un fallo intermedio no deje datos parciales.
2. Reserva con creación opcional de partido: define una transacción o un flujo recuperable con estados explícitos y reintento idempotente. Conserva comprobante y reserva válida si falla el paso social.
3. Pendientes de pago: vencimiento servidor, liberación segura del cupo/horario, tarea programada observable y reconciliación con el proveedor. Trata pago confirmado después de vencer/cancelar con una política explícita de devolución o intervención; no sobreocupes ni pierdas dinero.
4. Checkout Rapyd: verifica idempotencia en el proveedor además de en la base, reintentos y doble clic; reutiliza el checkout válido cuando corresponda. Valida moneda, importe, referencia, firma y estado. Webhooks duplicados/desordenados deben ser inocuos.
5. Cancelaciones y devoluciones: cálculo servidor según política aceptada, autorización, operación proveedor, estados pendientes/fallidos y conciliación. No habilites un botón que simule haber devuelto dinero.
6. Retiros: reserva saldo disponible mientras están pendientes; aprobación única y evidencia de liquidación. Prueba concurrencia y saldo exacto con historiales mayores que el límite de la API.

**Cierre:** última plaza disputada por varias personas concede una sola inscripción; reservas cruzadas no se solapan; no hay dobles cargos/abonos; devolución y retiro cierran con registros reconciliados. Si la pasarela no está operativa, lanza el piloto con efectivo y pagos online desactivados sin prometer funciones inexistentes.

### Fase 3 — Uso real, accesibilidad y moderación (P1)

1. Prueba con dos jugadores y un establecimiento reales en staging: alta de cancha/horarios, búsqueda, reserva, partido, inscripción, chat, cancelación, historial y calificación posterior al partido.
2. Cubre red lenta, desconexión durante escritura, reintento, refresh, doble pulsación y sesión vencida. No muestres éxito sin confirmación; conserva borradores.
3. Verifica carga de imágenes en Storage real: permisos por propietario, MIME/tamaño, visibilidad prevista, errores y limpieza de imágenes huérfanas. Define límites y compresión compatibles con web/móvil para reducir transferencia.
4. Prueba reportar/bloquear/moderar todos los tipos de contenido, borrado de archivos y suspensión. Comprueba que ocultar contenido no destruye reservas ni pagos y que el bloqueo no se limita a la pantalla del feed.
5. Define operación humana: responsable, canal público, plazo de atención, escalamiento y trazabilidad de reportes. Una lista de palabras no sustituye la moderación.
6. Revisa contraste y siete temas, lector de pantalla, teclado web, tamaños táctiles, fuente grande, Android de gama baja y iPhone; cubre estados vacío/error/carga y enlaces externos.
7. Añade cobertura de extremo a extremo con Auth/Storage/Realtime reales en staging para los flujos críticos; conserva pruebas unitarias/SQL existentes.

**Cierre:** guion completo ejecutado por roles, sin errores críticos, sin pérdida de datos; evidencias de permisos, archivos y moderación real.

### Fase 4 — Capacidad y coste medidos (P1)

1. Sustituye hidratación completa de historiales privados por páginas bajo demanda. Paginar internamente toda una historia sigue teniendo consumo proporcional al usuario. Mantén saldos/contadores exactos en SQL, independientes de la página visible.
2. Audita todas las listas restantes de historial, administración, selección de canchas y reservas; cursor estable e índices según filtros/orden. Verifica planes `EXPLAIN ANALYZE` con datos representativos.
3. Acota también memoria al recorrer muchas páginas del feed, cachés y suscripciones. Mantén Realtime solamente donde aporte y limpia al cambiar de pantalla/sesión; prueba reconexión sin mensajes perdidos ni duplicados.
4. Instrumenta errores y latencia con datos sensibles excluidos, consultas/bytes por acción, conexiones Realtime, CPU/memoria/IO de base, egress/Storage y coste mensual estimado.
5. Ejecuta carga exclusivamente en staging: 50, 100 y 500 usuarios simultáneos con mezcla documentada de lecturas, chat, reservas e inscripción. Incluye datos abundantes, picos y una prueba sostenida. Esos números son escalones de ensayo, no capacidad garantizada.
6. Objetivos iniciales propuestos: errores inesperados <1%, p95 de lectura <1 s y de escritura propia <2 s bajo la carga acordada; excluir rechazos de negocio esperados y separar latencia del proveedor. Cero corrupción financiera, sobrecupos o reservas duplicadas. Ajusta objetivos con mediciones y presupuesto.
7. Registra límite observado, cuello de botella y coste por 1.000 sesiones activas con duración/mezcla definidas. Elige plan/recursos Supabase con esos datos; verifica cuotas y disponibilidad del plan actual. No atribuyas cualquier fallo DNS a una pausa sin revisar DNS, estado del proyecto e incidentes.

**Cierre:** informe reproducible con configuración, datos, p50/p95/p99, tasa de errores, recursos/coste y capacidad recomendada con margen. Evita afirmar «soporta miles» a partir de unit tests.

### Fase 5 — Publicación web y preparación Android/iOS (P1)

1. Publica y verifica las siete páginas legales en ambos repositorios/dominios; privacidad, eliminación y normas accesibles sin login. Alinea formularios de tiendas con datos realmente recogidos y proveedores utilizados.
2. Vincula EAS y configura variables por entorno. Maps Android requiere clave restringida al paquete y SHA-1 de firma de Google Play cuando corresponda. Verifica credenciales públicas frente a secretas; ninguna clave de servidor en `EXPO_PUBLIC_*`.
3. Genera AAB/IPA de distribución. Comprueba permisos efectivos, manifiestos de privacidad, icono sin transparencia y compatibilidad de todas las dependencias. El prebuild/export de Hermes no sustituye la compilación ni la prueba de un binario.
4. Consulta requisitos vigentes oficiales de target Android, SDK/Xcode de iOS, bibliotecas de 16 KB, clasificación, cuentas y pruebas cerradas según tipo de cuenta/fecha. No copies respuestas antiguas ni asumas que la versión mínima de iOS equivale al SDK de compilación.
5. Instala builds mediante pruebas internas/TestFlight; valida mapas, fotos, notificaciones, teclado, deep links, recuperación, pagos, eliminación y moderación en dispositivos reales.
6. Prepara cuentas de revisión de jugador/dueño y una cuenta desechable para borrado, instrucciones reproducibles, soporte activo, capturas reales y declaración de privacidad exacta. Decide clasificación de membresías/servicios y métodos de cobro conforme a las políticas vigentes antes de habilitarlos en tiendas.

**Cierre:** binarios firmados probados, backend compatible desplegado, páginas públicas verificadas y checklist de consola completado. La aprobación final depende de Apple/Google.

### Fase 6 — Lanzamiento gradual y recuperación (P1)

1. Ensaya las migraciones en staging: `20261005200000_fiabilidad_concurrencia.sql`, `20261006120000_media_y_eliminacion.sql`, `20261006130000_moderacion_contenido_completo.sql` y `20261006140000_archivos_moderacion.sql`, en ese orden. Preflight de duplicados, intervalos y solapamientos; no borres conflictos automáticamente. Las de media necesitan Storage real.
2. Documenta backup y restauración ensayada, compatibilidad de cliente y ventana de mantenimiento o despliegue compatible. La migración de fiabilidad cambia permisos/RPC y puede romper clientes antiguos: diseña mínimo de versión o transición, incluyendo web almacenada en caché.
3. Coordina migraciones → funciones `delete-user`, `moderar-contenido` y las de Rapyd si se habilitan → cliente y legal. No asumas que el workflow de base despliega Edge Functions. Autentica funciones de usuario y valida firma del webhook del proveedor.
4. Abre un piloto pequeño con canchas reales y soporte, revisa métricas/errores y amplía solamente tras estabilidad y capacidad medidas. Mantén indicadores/flags para desactivar pagos o nuevas reservas sin destruir historiales.
5. Define umbrales de parada, responsable e instrucciones de recuperación. Revertir un commit no revierte una migración; usa corrección hacia delante o restauración ensayada según el caso y protege transacciones creadas después del backup.

**Cierre:** versión publicada identificable, comprobación posterior al despliegue, seguimiento y procedimiento de incidentes. Sin problemas P0 abiertos.

## 4. Controles y entregable de cada fase

Ejecuta en la rama integrada, con dependencias instaladas y entorno preparado:

```bash
node --test tests/*.test.cjs
python3 tests/database.py
./node_modules/.bin/tsc --noEmit
CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo lint
git diff --check
```

Las pruebas de navegador/export requieren iniciar/configurar el entorno según los informes; añade pruebas de staging y builds nativos donde corresponda. No atribuyas un fallo de infraestructura a código sin diagnóstico, ni declares una prueba pasada si no la ejecutaste.

Por cada fase entrega: problema y comportamiento resultante, cambios/commit, pruebas ejecutadas con resultados, riesgos/bloqueos pendientes y criterio de cierre alcanzado o no. Mantén una tabla de estado con cuatro valores: implementado, verificado local, verificado staging, publicado/verificado producción.

## 5. Prompt para empezar en Claude

> Continúa Falta Uno siguiendo `docs/continuidad/plan-claude-2026-10-06.md`. Primero lee los informes de auditoría y las instrucciones del repositorio. Integra los cambios de Codex sin commit con el trabajo de Claude hasta `7da4eaf`; verifica si hay commits posteriores. Conserva las operaciones atómicas, paginación, consultas por ID, tratamiento de errores, moderación y eliminación. Unifica los diálogos y corrige recuperación web sin perder las mejoras de sesión. Empieza por la fase 0 y continúa con la fase 1 y los problemas P0 de la fase 2, con commits revisables y pruebas reales. No publiques migraciones a main ni cambies producción hasta tener staging validado y un despliegue coordinado y revisable. No declares capacidad, correo, pagos o tiendas listos por inferencia: aporta evidencia. Al terminar cada fase informa cambios, pruebas, pendientes y el siguiente paso. Si algo requiere una credencial o acceso que no tienes, completa lo independiente y especifica exactamente el bloqueo.
