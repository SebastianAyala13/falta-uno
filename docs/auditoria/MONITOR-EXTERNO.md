# Aviso de salud por correo, sin terminal

Para Valen. Preparado el 6 de octubre de 2026, hora de Colombia. **Codex no desplegó la función, no creó un monitor externo ni envió correos.** La ruta propuesta usa el panel de Supabase y Better Stack Uptime. El correo es el canal previsto; no se promete WhatsApp gratis.

El servicio externo consulta una URL y avisa cuando deja de responder sano. Recibe únicamente `{"ok":true}` o `{"ok":false}`: no recibe fechas, conteos, IDs ni datos de pagos. La clave permite consultar ese booleano y debe ser distinta de CONCILIACION_JOB_SECRET. No es una contraseña de jugador ni una clave de Supabase.

## 1. Esperar el despliegue autorizado

1. Confirmar con el responsable que están aplicadas la migración 19 y la nueva **20261007130000_estado_salud.sql**, migración 20, que agrega la RPC privada `public.estado_salud()`. Después debe estar desplegada **estado-salud** en el proyecto correcto. Esta guía no aplica la migración ni despliega la función. Si faltan, detenerse; no crear objetos desde SQL Editor para sustituirlas.
2. En **Supabase → Edge Functions → estado-salud → Details/Settings**, comprobar que **Verify JWT está desactivado solo para esta función**, porque usa su cabecera privada propia. No desactivar JWT de delete-user ni de moderar-contenido.
3. Copiar la URL del panel terminada exactamente en `/functions/v1/estado-salud`. Su forma es `https://REFERENCIA-DEL-PROYECTO.supabase.co/functions/v1/estado-salud`: usar la referencia real, no el marcador. No usar la dirección de la web ni agregar una clave en la URL.

La función responde sano solo si la alarma de conciliación es false y su job está activo. Retención se considera instalada si existe el job **faltauno-retencion** o hay historial de purga: entonces exige el job activo y una purga exitosa en las últimas **26 horas**, sin fechas futuras. Pausar el job no la vuelve sana. Si nunca se instaló ni ejecutó retención, no exige esa purga todavía; un verde en ese caso **no certifica retención funcionando**.

Si alguien elimina el job antes de su primera purga, no queda evidencia que permita distinguirlo de una instalación pendiente. Por eso se pausa con `active=false`, se conserva el historial y se confirma la instalación en el registro de esta guía; no se borran jobs para resolver una alarma.

Al instalar retención por primera vez, habrá alarma hasta su primer éxito previsto a las **03:15 Bogotá**, si cron está en UTC. No ejecutar una purga manual para conseguir un verde. Los plazos ya están aprobados por Valen: **10 años archivo contable y 90 días reportes y recibos**. El monitor no cambia plazos, no hace devoluciones ni ejecuta purgas.

## 2. Crear una clave nueva y cargarla en Supabase

1. En Windows, abrir el gestor privado de contraseñas, por ejemplo Bitwarden o KeePassXC. Crear la entrada **Falta Uno · monitor de salud · proyecto correspondiente** y generar **64 caracteres aleatorios**, con mayúsculas, minúsculas y números. Generar una clave nueva aunque ya exista la de conciliación.
2. Antes de copiar, abrir **Configuración de Windows → Sistema → Portapapeles** y desactivar historial y sincronización. Guardar la clave solamente en el gestor; no pegarla en chat, capturas, consultas SQL, URL ni correo.
3. En **Supabase → Edge Functions → Secrets → Add secret**, nombre exacto **SALUD_MONITOR_SECRET**. En Value pegar la entrada del gestor y guardar. Si el nombre existe, actualizarlo; no crear duplicados ni espacios.
4. Conservar la entrada del gestor: se pegará la misma clave en la cabecera del monitor. **No copiar CONCILIACION_JOB_SECRET, service_role ni anon**. Esta clave no va a Vault: el monitor consulta la función directamente. No capturar la pantalla con valores visibles.

## 3. Elegir Free y el destinatario del correo

1. Abrir [Better Stack Uptime](https://betterstack.com/uptime) y crear/iniciar sesión en una cuenta controlada por el responsable. Elegir **Free**, no una prueba de pago. Confirmar el correo que recibirá avisos.
2. Antes de pegar la clave, comprobar en ese plan que están disponibles **monitor HTTP**, **cabecera personalizada** y **avisos por correo**. Si el panel exige pago para cualquiera de los tres, detenerse y pedir al responsable otro monitor gratuito compatible; no hacer pública la función ni poner el secreto en la URL para evitar el límite.
3. En **Settings/Account → Notifications**, o en alertas del monitor, habilitar **Email**. Si pide persona/responder, seleccionar a Valen y confirmar su correo verificado. Habilitar también aviso de recuperación.
4. No ingresar tarjeta ni habilitar SMS, llamadas o WhatsApp para esta guía. Anotar solo que Free y correo están habilitados, sin capturar datos sensibles.

Referencias oficiales: [sitio y planes de Uptime](https://betterstack.com/uptime) y [documentación](https://betterstack.com/docs/uptime/). El proxy de este entorno devolvió CONNECT 403 al consultar al proveedor; no se pudo comprobar aquí su oferta vigente ni recorrer su panel. El bloqueo no demuestra caída del proveedor. La comprobación visible del plan evita dar por gratis una opción que el panel no ofrezca.

## 4. Crear el monitor HTTP

1. Abrir **Uptime → Monitors → Create monitor**. Nombre: **Falta Uno · conciliación y retención · proyecto correspondiente**. Elegir disponibilidad **HTTP/URL**, no ping del dominio ni monitor de la web.
2. Pegar la URL de estado-salud. Método **GET**, HTTPS con validación del certificado. Si hay opción de seguir redirecciones, desactivarla: debe consultar esa función, no aceptar otra página como sana.
3. Abrir **Advanced settings → Request headers / Custom headers → Add header** y completar:

| Campo | Valor |
|---|---|
| Header name | `X-Salud-Key` |
| Header value | Pegar la entrada privada de SALUD_MONITOR_SECRET desde el gestor |

4. No añadir Authorization, apikey ni cookies. No guardar la clave en descripción o nombre. Limitar acceso a esa cuenta: quien puede editar el monitor puede ver o reemplazar su clave.
5. Configurar éxito **solo HTTP 200**. HTTP 401 y 503 deben ser fallo; no ampliar los códigos aceptados para volverlo verde. Si permite condición adicional de cuerpo, se puede exigir `"ok":true`, pero no es necesaria: el handler responde 503 ante alarma o error de consulta.
6. Elegir el intervalo más corto incluido en Free, **3 minutos si está disponible**, y aviso tras el primer fallo comprobado o el mínimo gratuito. No elegir tolerancia de horas. El intervalo se suma a la ventana interna de 3 minutos de conciliación y a la confirmación/correo del proveedor; no se promete aviso instantáneo ni demora garantizada.
7. Seleccionar aviso a Valen por correo y guardar/activar. Revisar que no haya mantenimiento abierto ni notificaciones desactivadas. Borrar copia del portapapeles y entradas sensibles de Win+V; conservar la clave en el gestor.

## 5. Comprobar el monitor y la entrega

Abrir **Latest checks / Response details**. No compartir ni capturar request headers. Ver solo cuerpo y código:

| Respuesta | Significado y acción |
|---|---|
| 200, `{"ok":true}` | Pasó la consulta actual. Esperar nuevos checks y confirmar que avanza su hora. No prueba pagos ni devoluciones reales. |
| 503, `{"ok":false}` | Alarma de conciliación, retención sin éxito reciente o consulta/configuración fallida. Seguir paso 6; no desactivar avisos. |
| 401, `{"ok":false}` | Clave ausente, vacía, incorrecta o configuración de autenticación inválida. Revisar X-Salud-Key y copiar la misma clave del gestor a ambos lugares; no quitar autenticación. |
| 404, conexión fallida, timeout u otro cuerpo/código | Revisar URL, despliegue, gateway y disponibilidad con el responsable. No aceptar el código como sano. |

Un 401 del gateway podría tener otro cuerpo; comprobar Verify JWT de estado-salud con el responsable. La respuesta mínima indicada corresponde al handler desplegado y configurado.

1. Esperar **dos comprobaciones automáticas** y verificar que son nuevas. “Monitor creado” no demuestra que consulte. Si retención espera su primer ciclo, anotar el motivo sin ignorar la incidencia.
2. Si existe **Send test notification**, usarlo y confirmar recepción en correo/Spam. Anotar hora Bogotá y recibido/no recibido. Prueba el canal, no la detección del fallo.
3. Para probar todo, usar **un proyecto de ensayo autorizado** y monitor aparte. Cambiar temporalmente la cabecera del monitor de ensayo por texto incorrecto, guardar y esperar check 401 y correo de incidencia. Restaurar desde el gestor la clave correcta y comprobar recuperación y correo. No cambia pagos ni purgas. **No simular caída ni modificar jobs en producción.** Sin proyecto de ensayo, dejar pendiente esta prueba completa; no declararla pasada por probar el botón de correo.

Guardar solo ambiente, versión, intervalo, horas y recepción de incidencia/recuperación. Nunca request headers, secretos ni datos de usuarios. No mandar la clave a otros agentes para revisión.

## 6. Cuando llega el aviso

1. Abrir el panel del proveedor desde el navegador, confirmar proyecto/monitor y hora Bogotá. Anotar 401, 503, timeout u otro fallo; no exportar la petición ni responder con claves.
2. Para 401, revisar en privado X-Salud-Key y SALUD_MONITOR_SECRET: corregir copiando la entrada del gestor al lugar incorrecto. No usar la clave de conciliación. Para 404/conexión fallida, comprobar URL y despliegue con el responsable.
3. Para 503, abrir **Supabase → SQL Editor** y ejecutar el bloque completo del [paso 8 de PASOS-FASE-7.md](PASOS-FASE-7.md#8-comprobar-los-primeros-tres-ciclos). Es solo lectura y muestra el motivo en el panel autorizado: alarma/ultimo_ok, fallos recientes, jobs activos y última retención. No leer Vault, secretos ni cron.command.
4. Si retención aún espera su primer ciclo, confirmar job activo y próxima hora. No forzar purga. Si el último éxito supera 26 horas, falta historial o está inactivo, avisar al responsable para revisar Cron, permisos y logs. El estado succeeded de cron no sustituye la fila de purga exitosa.
5. Si hay atraso, sin respuesta, fallo o devolución vieja/en revisión, seguir [COMPROBAR-CONCILIACION.md](COMPROBAR-CONCILIACION.md). **Mantener RAPYD_REEMBOLSOS_ACTIVOS false**. No habilitar pagos ni marcar deudas reembolsadas para quitar alarma; conservar registros y asignar revisión humana.
6. Si hay riesgo de cambios incorrectos, pausar los dos horarios desde **SQL Editor → New query → Run**:

```sql
SELECT cron.alter_job(job_id := jobid, active := false) FROM cron.job WHERE jobname IN ('faltauno-conciliacion','faltauno-retencion');
```

La pausa no cancela ejecuciones iniciadas/peticiones encoladas ni restaura purgas; **no arregla la salud**. Mantener el monitor activo para observar el problema. No borrar jobs ni historial. Reactivar solo con el responsable después de resolver la causa.

7. Cuando vuelve 200 y ok:true, confirmar también recuperación de las ejecuciones en Supabase. Anotar causa, acción, responsable y horas. El correo “resuelto” no certifica pagos online, capacidad, backups ni aprobación de tiendas.

## 7. Rotar o revocar la clave

Si la clave se expuso o el servicio externo deja de usarse, generar otra en el gestor y cambiar **SALUD_MONITOR_SECRET** en Supabase. Revoca la anterior para esta función. Si se conserva el monitor, actualizar su cabecera y comprobar recuperación; habrá 401 durante el cambio. No rotar CONCILIACION_JOB_SECRET ni Vault por este monitor. Si se abandona el proveedor, eliminar allí el monitor y revisar accesos después de revocar.

## Registro que completa Valen

| Comprobación | Resultado |
|---|---|
| Migración 20 aplicada y función desplegada | Proyecto, versión, hora Bogotá: ______ |
| Free, cabecera y correo habilitados | Confirmado / bloqueo: ______ |
| Monitor activo, intervalo y dos checks nuevos | Resultado y horas: ______ |
| Primer éxito de retención tras instalar | Hora / pendiente concreto: ______ |
| Correo de prueba recibido | Hora / no probado: ______ |
| Incidencia y recuperación completas en ensayo | Resultado / pendiente sin ensayo: ______ |
| Persona que atiende avisos | Responsable: ______ |

Las pruebas del repositorio comprueban el handler y PostgreSQL aislado. No rellenan estas casillas: no prueban el gateway, la interfaz vigente del proveedor ni la entrega real de correo.
