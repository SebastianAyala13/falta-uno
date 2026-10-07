# Retención y cierre de cuentas · mecanismo propuesto e implementado

El borrado anterior eliminaba contabilidad del dueño por cascada, conservaba snapshots personales en reportes ajenos y no registraba por qué una solicitud debía esperar. Consecuencia: podían desaparecer pruebas de transacciones de terceros y quedar contenido personal sin plazo.

## Decisiones explícitas

- Solicitud siempre disponible: página pública/correo sin sesión, y Edge para el usuario autenticado, incluso si suspendido. La solicitud válida queda guardada **antes** de limpiar Storage/Auth. Si faltan permisos/configuración, se informa fallo, nunca aceptación ficticia.
- Bloqueo temporal, no renuncia al borrado: se conservan cuenta y dinero mientras haya reservas futuras no canceladas del jugador o sus canchas, partidos futuros que organiza o integra, pagos online pendientes/reembolso pendiente, reservas online no liquidadas, saldo de cancha positivo **o negativo**, retiros solicitados/procesando y devoluciones relacionadas no completadas (incluye revisión manual). Los códigos no filtran datos de terceros. Una obligación no resuelta no se elimina por antigüedad.
- Solicitudes pendientes impiden nuevos partidos, inscripciones, canchas, reservas, pagos y fotos relacionados con el usuario/dueño/organizador. No se marca suspendido ni se bloquea automáticamente el acceso necesario para resolver lo existente. Cancelaciones y operaciones de liquidación siguen sujetas a permisos/validaciones previos. Se permiten solicitudes de retiro y movimientos de liquidación; nadie debe borrar saldo ni aprobar pago sin evidencia para lograr un cierre.
- Cierre final revalida las obligaciones en trigger de profiles, tanto por cascada Auth como por SQL directo. Las escrituras financieras toman locks del mismo perfil; petición y cierre no pueden pasar mientras una escritura relacionada está en curso. Transacciones que colisionen pueden esperar o abortar por deadlock; reintentar no autoriza eliminar obligación.
- Antes de borrar perfil, se copian pagos, reservas, movimientos y retiros afectados a archivo_contable: importes, comisión, medio, estados, fechas, IDs de operación y referencias. **No** nombre, email, celular, documento, banco/cuenta, descripción libre, foto ni UUID del usuario eliminado. La contraparte que sigue teniendo cuenta conserva su UUID y acceso a sus comprobantes; al borrarla ese vínculo se pone NULL. Estos registros son mínimos/pseudónimos, **no** se promete anonimato irreversible: referencias pueden vincularse con datos del PSP.
- Archivo: **10 años desde su archivo al cerrar una cuenta**. Política conservadora propuesta para trazabilidad comercial/contable; el responsable debe validar adecuación jurídica y contable antes del despliegue (no se presenta como dictamen de plazo obligatorio para cada dato). Un mismo origen se guarda una vez, sin sobrescribirlo al cerrar la contraparte. El plazo no se reinicia por lectura ni ejecución del purgador.
- Reportes: al borrar autor, texto/foto y ID del contenido se eliminan inmediatamente; quedan tipo, motivo, estado, fecha y el denunciante mientras mantenga cuenta. Todos los reportes se purgan a **90 días desde creación**, resueltos o no. Moderación debe actuar antes del plazo. No se guardan evidencias privadas durante 10 años bajo el pretexto de contabilidad.
- Recibo de solicitud completada: pierde UUID del usuario y motivos; queda hasta **90 días desde cierre**. Solicitud pendiente mantiene UUID/códigos/fecha hasta resolverse, no se purga mientras dinero requiera atención.
- Cola de devoluciones: terminal reembolsado se purga a **10 años desde última actualización**; pendiente/procesando/proveedor_pendiente/revisión_manual nunca por este purgador. La cola preexistente puede contener referencia de operación sin vínculo a perfil: sigue existiendo y debe revisarse por responsable; no se inventa su titular ni se purga porque no tenga FK.
- Datos activos no contables: sin un TTL global nuevo; el borrado de cuenta y relaciones elimina el contenido propio. Archivos de Storage se borran por API antes de Auth, nunca borrando storage.objects a mano. Una falla de Auth tras limpieza puede dejar cuenta con fotos ya quitadas, informando error y conservando registros monetarios. No es una transacción distribuida ni un borrado de backups/CDN/PSP/correo.

## Despliegue y operación (no ejecutados en producción)

Nueva migración aditiva `20261006200000_retencion_eliminacion.sql`, **después** de las ocho migraciones anteriores, seguida por Edge delete-user. No lleva DELETE de datos en su instalación. Nuevos triggers requieren ensayo en Supabase staging real, especialmente schema Storage/Auth administrados. El dato cuenta bancaria sigue en datos_desembolso hasta cierre; no se copia al archivo contable.

`aplicar_retencion(1000)` es service_role-only: limpia hasta 1000 por categoría, además de desidentificar como máximo 1000 snapshots huérfanos. Registro agregado de última ejecución/conteos en ejecuciones_retencion (90 días). Terminalidad/plazo se verifican de nuevo en DELETE para no purgar una fila que cambió mientras esperaba lock. Error revierte todo y no genera un éxito falso.

Programación preparada, **no instalada**: scripts/db/programar_retencion.sql, cron diario 08:15 UTC = 03:15 Bogotá, si cron usa UTC. Confirmar timezone en staging. Hasta instalar el job y comprobar ejecución, **no se cumple un plazo automático de purga**; publicar política y activar mecanismos coordinadamente. El primer ciclo también minimiza snapshots huérfanos heredados. Si backlog supera lote diario, repetir el procedimiento controlado/ajustar frecuencia con métricas, sin modificar fechas reales para forzar purga.

Consultas seguras del operador (sesión de base autorizada; no copiar credenciales):

```sql
select ejecutada_at, conteos from public.ejecuciones_retencion order by ejecutada_at desc limit 5;
select jobname, schedule, active from cron.job where jobname='faltauno-retencion';
select r.status,r.start_time,r.end_time from cron.job_run_details r join cron.job j using(jobid)
 where j.jobname='faltauno-retencion' order by start_time desc limit 5;
select count(*) as vencidos from public.archivo_contable where conservar_hasta<=now();
select count(*) as pendientes, min(solicitada_at) as mas_antigua from public.solicitudes_eliminacion where estado='pendiente';
```

Monitor externo/responsable: avisar si no hay éxito en 26 horas, cron inactivo/fallido o registros vencidos que no bajan entre ciclos. Atención humana de solicitudes pendientes: contactar por canal de soporte, resolver reservas/partidos, comprobar pagos PSP/retirar saldo con evidencia, volver a invocar flujo de eliminación. No ejecutar DELETE manual de obligaciones ni ajustes sin fundamento. No hay worker automático que liquide dinero ni que elimine Auth sin nueva petición.

## Cliente a cargo de Claude

- `lib/auth.tsx:302` en origin/main 795cd59 (:292 en esta rama) invoca Edge y hoy oculta el mensaje contextual con un error genérico en :304 de main (:294 aquí). Leer el JSON 409 del invoke/context y mostrar solicitud_recibida, motivos traducidos y contacto: «Recibimos tu solicitud; falta liquidar ...; tu dinero no se pierde». **Backend ya entrega ese mensaje; UI todavía no**, por propiedad.
- `app/(tabs)/perfil.tsx:41`: estado de solicitud/CTA soporte y reintento tras liquidación; siempre ofrecer el enlace público aun suspendido. No interpretar recepción como cuenta eliminada.
- `lib/canchas.ts:214` (reservas) y `lib/store.ts:226` (pagos): presentar comprobantes de archivo_contable cuando ya no existe la cancha/partido original. RLS permite a la contraparte leer sus comprobantes; acceso de admin únicamente a los demás. No devolver nombres del usuario borrado.
- `constants/config.ts:32`, `lib/auth.tsx:241`: versión 2026-10-06.1 y reaceptación si corresponde. No se editaron.

Pendientes concretos: validación jurídica/contable de plazos propuestos; publicación coordinada; staging Auth/Storage/PSP real y carrera con webhooks externos; monitoreo/operador de purga y atención de solicitudes; visualización contextual del cliente. Ninguno se declara ya probado por una prueba PostgreSQL aislada.
