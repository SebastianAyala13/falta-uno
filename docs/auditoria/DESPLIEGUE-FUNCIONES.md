# Ficha de despliegue de las cinco Edge Functions

Para el operador. Ningún comando de este documento se ejecutó contra producción. Primero staging con cuentas/datos sintéticos y pagos online apagados. Estado de producción aportado por responsable: rapyd-crear-checkout, rapyd-webhook y delete-user v1; conciliar-pagos y moderar-contenido faltan. Versión v1 no identifica por sí sola el commit desplegado: confirmar versión/código en panel antes de sustituirlo.

**Freno de segunda tanda:** no fusionar política nueva a main (Dokploy redepliega con push) ni desplegar **delete-user nuevo de esta rama** hasta aplicar 20261006200000_retencion_eliminacion.sql en una tanda separada, con ensayo y autorización manual. Plazos 10 años/90 días siguen pendientes de aprobación; no fueron cambiados ni aprobados por esta ficha.

## Elegir función y requisitos

Supabase inyecta normalmente SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY. Verificar presencia según fila; jamás imprimir valores, cabeceras Authorization, claves Rapyd, JWT, firmas, cuerpo con datos reales ni archivos de credenciales. BASE_URL, WEBHOOK_URL, COMPLETE_URL, CANCEL_URL y flags son configuración, no contraseñas; también se enumeran solo por nombre aquí.

| Función | Dependencia efectiva del código preparado | verify_jwt y motivo | Nombres necesarios |
|---|---|---|---|
| rapyd-crear-checkout | Primera tanda completa; consulta caduca_at/estado_pago incorporados en **20261006160000_caducidad_conciliacion.sql**, pagos/reservas protegidos en 20261005200000 y 20261006150000. Reservar con cliente adaptado depende además de 20261006170000 | **true**: llamada de usuario. Dentro verifica auth.getUser, propiedad y precio de DB; JWT gateway no sustituye estas validaciones | SUPABASE_URL, SUPABASE_ANON_KEY; RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY; opcionales RAPYD_BASE_URL, RAPYD_COMPLETE_URL, RAPYD_CANCEL_URL |
| rapyd-webhook | **20261006160000**: confirmar_pago_online(text,integer,text,text), expiración tardía/cola de devolución; primera tanda completa como base | **false**: Rapyd no envía JWT Supabase. Se exige firma HMAC de cuerpo crudo, salt y timestamp, con URL exacta; no es un endpoint de aprobación sin autenticación | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY, RAPYD_WEBHOOK_URL |
| conciliar-pagos | **20261006160000**: caducar_pagos_pendientes, tomar_reembolso, registrar_reembolso. Para automatizar y observar: instalador separado scripts/db/programar_conciliacion.sql y cron/net/Vault; desplegar Edge no instala cron | **false**: usa clave exclusiva CONCILIACION_JOB_SECRET, no JWT de usuario. Rechaza si falta/es vacía o Bearer no coincide; comparación de longitud y timingSafeEqual | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CONCILIACION_JOB_SECRET; RAPYD_REEMBOLSOS_ACTIVOS (mantener false). Solo si se autoriza devolución: RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY, opcional RAPYD_BASE_URL. Vault para job: faltauno_conciliacion_url y faltauno_conciliacion_secret, no valores |
| moderar-contenido | **20261006130000_moderacion_contenido_completo.sql**: admin_resolver_reporte y snapshot; **20261006140000_archivos_moderacion.sql**: archivos_reporte; is_admin/suspensión de migraciones previas | **true**: usuario autenticado y **admin**. Verifica getUser e is_admin; service_role solo para inventario y borrado de blobs, la RPC final conserva identidad del admin | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY |
| delete-user **nuevo** | **NOVENA 20261006200000_retencion_eliminacion.sql**, solicitar_eliminacion y guard de cierre; archivos_usuario de **20261006120000_media_y_eliminacion.sql**. No basta tener primera tanda | **true**: solo borra el usuario de getUser, no ID elegido del body. Guarda solicitud; bloqueo 409 conserva cuenta/dinero. Limpia blobs antes de Auth y último guard revalida obligaciones | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY |

Las funciones admin conceden EXECUTE a authenticated porque el admin también usa ese rol; is_admin decide dentro. No convertir todos los dueños en admin ni publicar service_role en cliente.

## Qué debe responder POST sin credenciales

Enviar body `{}` de prueba **sin Authorization, apikey ni firmas**. No probar una firma inventada contra datos reales ni un webhook válido durante esta comprobación.

| Función | Handler sin credenciales | Observación de gateway/configuración |
|---|---|---|
| rapyd-crear-checkout | **401**, No autorizado; ninguna consulta/petición de pago | Con verify_jwt=true puede ser 401 del gateway antes del handler. No certifica validación interna por sí solo |
| rapyd-webhook | **401**, Firma inválida, si claves/URL están configuradas | Sin configuración: **500**, Webhook no configurado. Ambas rechazan sin RPC; 500 exige completar configuración, no es aceptación |
| conciliar-pagos | **401**, No autorizado | También 401 si CONCILIACION_JOB_SECRET falta/es vacío, incluso frente a `Bearer undefined`. No encola ni caduca nada |
| moderar-contenido | **401**, No autorizado; ninguna moderación | Con JWT de jugador no admin: **403** en handler. Probar ese caso solo con cuenta staging y credencial privada sin logs |
| delete-user nuevo | **401**, No autorizado; sin solicitud/Storage/Auth | Nunca usar la cuenta real del operador para comprobar borrado. Después de JWT válido puede ser 409 recibido-pendiente; eso no es cuenta eliminada |

OPTIONS en checkout/moderar/delete-user es preflight CORS, no operación autorizada (handler responde ok). GET es 405 en handlers; gateway con verify_jwt=true puede rechazar antes con 401. No confundir CORS/405/401 con una transacción exitosa ni cambiar autenticación para obtener 200.

## Cómo comprobar sin datos reales

1. Confirmar proyecto staging, migraciones y función/version en panel. Para primera tanda usar verificar_produccion_tanda1.sql sobre staging; para novena usar preflight de segunda tanda y su propio ensayo. El verificador de 17 no debe declarar 18 como primera tanda correcta.
2. Configurar nombres por interfaz segura. El secreto exclusivo de conciliar debe coincidir con Vault; no guardarlo en SQL versionado o EXPO_PUBLIC. No usar claves de producción para staging. Conciliar se puede desplegar con secreto ausente y debe cerrar el acceso con 401; no es listo para operar hasta configurarlo correctamente.
3. Desplegar de forma **individual** desde commit revisado, nunca `supabase functions deploy` sin nombre desde esta rama: eso incluiría delete-user prematuramente. Seleccionar verify_jwt según tabla; revisar bandera/ajuste efectivo después, no asumirlo por el nombre del comando. Si CLI: funciones webhook/conciliar con `--no-verify-jwt`; las otras con verificación habilitada (confirmar config efectiva). Proyecto/ref en sesión segura, no pegar credenciales en comandos/documentos.
4. Usar un cliente HTTP sin credenciales y guardar **solo código HTTP**. Ejemplo para staging autorizado (reemplazar el host público, no un secreto):

```bash
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
  --request POST --header 'Content-Type: application/json' --data '{}' \
  'https://PROYECTO-STAGING.supabase.co/functions/v1/conciliar-pagos'
```

Repetir cambiando solo nombre de función. No usar `-v`, volcar headers, body ni variables de entorno. Si una función que debía rechazar devuelve 200, parar y revisar configuración/código; no ejecutar datos reales para “ver si sirve”.

5. En staging verificar también jugador no admin contra moderar (403), usuario contra checkout ajeno (403/404 según existencia y RLS), Auth inválido contra delete (401), ausencia de clave job (401), firma webhook ausente (401 con configuración presente). No crear pagos reales; no guardar tokens en evidencias. Lo probado aquí es handler con dobles, no gateway ni SDK real.
6. Para cron/primera ejecución seguir [COMPROBAR-CONCILIACION.md](COMPROBAR-CONCILIACION.md). No activar RAPYD_REEMBOLSOS_ACTIVOS por ver un 200: la devolución está apagada deliberadamente. No pasar a dinero real sin sandbox certificado y autorización.
7. Segunda tanda: aprobación de plazos → ensayo/preflight/backups coordinados → novena aplicada → delete-user nuevo → cliente mensaje/consentimiento/historial → publicación política. Operador registra versión y resultados. Si falla una condición, no empujar main para forzar redeploy; revertir un commit no revierte una migración.

## Evidencia local y pendientes

conciliar-pagos ya tenía `if (!secret || ...) return 401`; **no aceptaba secreto ausente**, por eso no se modificó su handler. Prueba añadida en tests/reconciliation.test.cjs: ausente, vacío y Bearer undefined/test-job/vacío → 401, sin llamadas a DB/proveedor. Suite de handlers y prueba de primera tanda ejecutadas localmente; resultados de esta cola en ESTADO-CODEX.md. No se afirma que las cinco banderas, secretos, versiones o respuestas HTTP estén verificados en producción.

Cambios de cliente requeridos antes del flujo nuevo: lib/auth.tsx:302–304 en main 795cd59 debe mostrar body 409 (hoy error genérico), constants/config.ts:32 consentimiento nuevo cuando se autorice/publique coordinadamente. Dashboard opcional lib/admin.ts:45. No se modifican esos archivos. Falta ensayo de SDK/gateway, Auth/Storage reales, cron y Rapyd sandbox; responsable completa esas comprobaciones con freno manual.
