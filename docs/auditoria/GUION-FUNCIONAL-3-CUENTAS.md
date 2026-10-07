# Ensayo funcional con tres cuentas

Estado: **guion preparado, no ejecutado en teléfonos ni contra Supabase por Codex**. No acredita pagos, capacidad, aprobación de tiendas ni producción. Ejecutarlo solamente en proyecto de ensayo con datos ficticios; nunca hacer estas eliminaciones o ajustes en producción. Fecha de preparación: 6 de octubre, noche.

## Preparación entre dos personas

Persona 1 usa jugador A en teléfono 1 y dueño D en navegador; persona 2 usa jugador B en teléfono 2. Registrar sistema operativo, versión del cliente y hora de ambos dispositivos. Las tres cuentas pertenecen a quienes ensayan; no compartir contraseñas, sesiones ni tokens. Usar nombres y contenido ficticios, sin documentos ni cuentas bancarias reales.

Para revisar moderación con solo tres cuentas, el responsable debe habilitar **D como administrador exclusivamente en ensayo**, además de dueño. No es un privilegio normal de dueños. A y B deben seguir sin admin. Si no está autorizado, marcar los pasos administrativos BLOQUEADOS; no intentar ascenderse. D conserva su sesión administrativa hasta finalizar.

Comprobar primera tanda completa (17 migraciones) con verificar_produccion_tanda1.sql en ensayo. Desplegar allí moderar-contenido según DESPLIEGUE-FUNCIONES.md. Los pasos de borrado requieren además la novena y delete-user nuevo, con cliente compatible. **No probar borrado con dinero pendiente usando delete-user v1.** Los plazos de 10 años/90 días siguen pendientes de aprobación; este ensayo no los aprueba ni autoriza desplegar política o backend en producción.

Pagos online apagados: `EXPO_PUBLIC_PAGOS_ONLINE` debe estar **ausente o vacía** en el build; el código comprueba si hay texto, por lo que el texto `false` también los habilita. Verificar visualmente que solo aparece efectivo. Reembolsos externos apagados; no abrir checkout Rapyd ni marcar transferencias reales como realizadas. Un pago en efectivo pendiente no es saldo depositado en la plataforma.

Elegir cancha ficticia de D, precio ficticio y dos franjas futuras dentro de su horario, con al menos un día de margen. Anotar alias de cancha, partido y franjas para que ambos prueben exactamente los mismos. No usar fechas pasadas. Registrar cada paso como PASÓ, FALLÓ, BLOQUEADO o NO EJECUTADO. Si falta un requisito, detener ese bloque; no borrar datos ni cambiar permisos para producir un resultado favorable.

## Partidos, reservas y privacidad

En la última columna, “registro” significa: ID del paso, actor, hora con zona, pantalla, acción, mensaje exacto redactado y resultado después de actualizar. Una captura debe ocultar correo, teléfono, identificadores de sesión y datos personales. No exportar logs con credenciales.

| Paso | Quién y pantalla / acción | Resultado esperado | Si falla, anotar además del registro |
|---|---|---|---|
| 01 | A/B/D: registro, login y Perfil | Cada uno ve su propio perfil; sesión estable al cerrar y abrir la app. Sin acceso a perfiles privados ajenos. | Dispositivo, si fue registro o regreso, momento del cierre. |
| 02 | D: Perfil → panel de cancha → registrar/editar cancha | Cancha ficticia visible, horario y precio coherentes al volver a abrir. | Campo que cambia, valor antes/después, duplicación al repetir toque. |
| 03 | A: Buscar → Crear partido, fecha futura | Partido aparece una vez en búsqueda, detalle y Mis partidos con A como organizador. | Filtros usados y diferencia entre las tres pantallas. |
| 04 | B: detalle del partido de A, antes de inscribirse → intentar chat | No puede leer/enviar conversación privada sin pertenecer; rechazo o acceso cerrado sin datos ajenos. | Si vio mensajes o pudo enviar; ausencia de botón no prueba defensa del servidor. |
| 05 | B: detalle → inscribirse en efectivo; repetir toque/reabrir | Una inscripción, un lugar ocupado, sin checkout online ni duplicación. A ve el mismo conteo. | Conteo en ambos teléfonos y recibos duplicados. |
| 06 | A/B: chat del partido → mensajes ficticios en ambos sentidos | Cada mensaje aparece una vez, llega al otro miembro y sigue tras reabrir. | Texto ficticio, retraso observado, orden y duplicados; no inferir garantía de Realtime. |
| 07 | B: cortar conexión, intentar enviar, restaurar y actualizar | No anuncia envío confirmado si no se guardó; error o estado pendiente claro. Al volver no duplica. | Mensaje antes/después y si el otro teléfono lo recibió. |
| 08 | A/B: Canchas → misma cancha → Reservar misma franja, efectivo, confirmar simultáneamente | Solo una reserva activa ocupa la franja. El otro recibe rechazo comprensible; al refrescar ve ocupación. | Hora de cada confirmación, mensajes, reservas activas de ambos y agenda D. |
| 09 | Ganador: Mis reservas; D: Agenda | Hora, importe, estado y cancha coinciden. Efectivo no produce ingreso online ni retiro disponible por sí solo. | Pantallas que discrepan; nunca aprobar un pago online para arreglarlo. |
| 10 | Perdedor: intentar reservar esa franja de nuevo | Sigue rechazado; no genera segundo partido/reserva, cobro ni falsa confirmación. | Cambios de conteo tras actualizar. |
| 11 | Ganador: cancelar su reserva; perdedor: actualizar y reservar franja liberada | Cancelación queda en historial, franja liberada y nueva reserva válida distinta; no se borra el historial para liberar. | Tiempo hasta refrescar, estados y duplicaciones. |
| 12 | A/B: Perfil / rutas administrativas y finanzas de cancha ajena | No acceden a admin, saldo, retiros o pagos privados de otro. D ve solo lo autorizado para su rol. | Ruta intentada y cualquier dato expuesto. No introducir tokens ni usar SQL desde teléfono. |
| 13 | A: partido propio → intentar salida que deje partido sin organizador | Rechazo o flujo explícito de cancelación; nunca desaparece organizador con partido activo. B puede salir según reglas y conteo se actualiza. | Estado del partido, conteo en ambos y mensaje. |

No se comprueba capacidad máxima de un partido de diez jugadores con solo tres cuentas. La prueba de dos reservas concurrentes comprueba esa franja, no una cifra de usuarios soportados. Ascenderse a admin, aprobar un pago o modificar precio protegido sin botón disponible requiere pruebas de permisos de base: usar el SQL del punto 1 en ensayo; no marcarlo pasado solo porque la interfaz oculta la opción.

## Muro, reportes y suspensión

| Paso | Quién y pantalla / acción | Resultado esperado | Si falla, anotar además del registro |
|---|---|---|---|
| 14 | B: Muro → crear publicación `[ENSAYO] contenido ficticio para reportar`; imagen sintética opcional | Una publicación, sin datos personales. A puede verla; volver no la duplica. | Si texto/imagen aparece en un cliente pero no en otro. |
| 15 | A: menú de publicación de B → Reportar contenido | Motivo enviado con confirmación; reporte refiere a B y contenido correcto. | Motivo, respuesta y repetición accidental; no compartir el cuerpo de denuncias reales. |
| 16 | A: mismo menú → Bloquear a B; actualizar Muro | Contenido de B se filtra para A según bloqueo, sin borrar contenido global ni cuenta de B. | Lugar donde sigue apareciendo; verificar desde D antes de confundir filtrado con eliminación. |
| 17 | D/admin: Plataforma Madre → Reportes | Ve reporte de ensayo con autor/tipo correctos; A/B no acceden a esta lista. | Si falta reporte, autor equivocado o datos de otra cuenta expuestos. |
| 18 | D/admin: reporte → moderar/retirar contenido | Contenido deja de estar disponible públicamente al refrescar; reporte conserva resolución. Sin borrar reservas/pagos asociados de terceros. | Resultado del moderador, persistencia del contenido y cambios ajenos. |
| 19 | D/admin: suspender autor B; B conserva sesión y prueba publicar/inscribirse/reservar/enviar mensaje | Operaciones restringidas se rechazan, sin éxito aparente ni registros nuevos. La sesión antigua no permite eludir suspensión. | Acción concreta permitida indebidamente y visibilidad desde A/D. Si cliente bloquea antes, registrar que no prueba llamada de servidor. |
| 20 | B: acceso a privacidad / solicitud de eliminación con suspensión | Puede conocer cómo pedir borrado aun suspendido. Un enlace que abre correo es canal de solicitud, no prueba de registro automático. No enviar mensajes a direcciones de soporte reales en ensayo. | Enlace inaccesible, instrucción ausente o bloqueo total de solicitud. |
| 21 | D/admin: Usuarios → levantar suspensión B | Tras actualizar, B recupera acciones permitidas; no adquiere rol admin. | Estado anterior/posterior, necesidad de relogin y privilegios inesperados. |

Si no hay función de moderación desplegada, no sustituir retirar contenido por borrarlo manualmente: marcar BLOQUEADO. La prueba con archivo sintético no acredita todos los formatos, limpieza real de Storage ni moderación de contenido real.

## Pedido de borrado: sin dinero y con obligaciones pendientes

Ejecutar solamente con novena + delete-user nuevo y cliente preparado para mostrar la solicitud pendiente. Un error genérico donde debería explicar el estado es **fallo de experiencia**, aunque el servidor haya protegido los registros. No interpretar 409 como cuenta borrada.

| Paso | Quién y pantalla / acción | Resultado esperado | Si falla, anotar además del registro |
|---|---|---|---|
| 22 | B: Mis reservas/Mis partidos → cancelar reservas futuras y salir de partidos donde es participante | No queda obligación futura de B, ni saldo/devolución/retiro pendiente de la plataforma. Historial permanece. El responsable verifica condición en ensayo si la UI no basta. | Cualquier obligación que impida borrar; no eliminar registros para ocultarla. |
| 23 | B: Perfil → Eliminar cuenta → cancelar confirmación | Sigue autenticado y cuenta intacta. | Cambio de sesión o eliminación antes de confirmar. |
| 24 | B: mismo flujo → confirmar, ya sin obligaciones | Eliminación finalizada sin falso éxito; sesión termina. Reintentar login de esa cuenta falla. Datos personales y media se retiran según política, referencias retenidas se desidentifican. | Respuesta, sesión residual, login todavía posible, contenido personal visible. Comprobación de Auth/Storage real corresponde al responsable y se registra aparte. |
| 25 | A/D: actualizar chat/muro/reportes/historial relacionados con B | No se rompen pantallas; no aparece perfil personal eliminado. Reportes ajenos/referencias contables que deban conservarse no desaparecen. | Pantalla rota, identidad retenida inesperadamente o registros de terceros perdidos. |
| 26 | D/admin: Canchas → ajuste de saldo **ficticio solo en ensayo** con motivo `ENSAYO SIN DESEMBOLSO REAL`; D: Finanzas → solicitar retiro de parte del saldo | Ledger y retiro pendiente visibles, con importes coherentes. Registrar saldo inicial, ajuste y saldo/retiro antes del borrado. Si no hay entorno autorizado para saldo ficticio, BLOQUEADO. | Duplicación, saldo incorrecto o retiro mayor que disponible aceptado. Nunca transferir dinero ni marcar pago real. |
| 27 | D: Perfil → Eliminar cuenta con ese saldo/retiro pendiente | Solicitud se puede presentar; queda pendiente, con explicación de obligación. No desaparecen Auth, ledger, retiro, pagos ni referencias de terceros. No promete fecha de retención aprobada. | Texto exacto, si se perdió acceso, saldos y estado tras actualizar. |
| 28 | D: repetir solicitud y actualizar Finanzas / admin Retiros | Solicitud no se duplica; el saldo/retiro sigue. No se crea un segundo retiro ni se “liquida” automáticamente por pedir borrado. | Cantidades antes/después y pérdida de historial. |
| 29 | A: intentar nueva reserva en cancha de D tras solicitud pendiente | Se impiden obligaciones nuevas incompatibles con eliminación; mensaje claro, sin reserva creada ni cobro. Cancelar obligaciones existentes sigue teniendo un camino. | Si se creó reserva, mensaje genérico o no se permite cancelar. |

**Terminar dejando D pendiente**: no destruir el único administrador de ensayo, no marcar retiros pagados sin desembolso y no ajustar a cero solo para hacer pasar el borrado. La finalización tras liquidar requiere otro ensayo controlado con respaldo, administrador disponible y obligaciones realmente resueltas; queda pendiente y no se declara pasada aquí. Cash no permite ejercitar devoluciones Rapyd: ese caso queda fuera y exige certificación propia.

## Cierre entre las dos personas

Guardar una tabla con IDs 01–29 y estado de cada uno, versión, dispositivo, hora y evidencia redactada. Separar fallo del servidor, fallo de mensaje/interfaz y requisito ausente. Listar por separado lo no ejecutado: gateway, Auth/Storage reales si no comprobados, devoluciones online, liquidación final del dueño y comportamiento en sistemas operativos no usados. No sustituir estas pruebas por las 61 unitarias locales ni declarar que una app pasa tiendas por completar el guion.

Pendientes de cliente para coordinar, sin edits de Codex: main `lib/auth.tsx:302` debe interpretar solicitud pendiente/409; `constants/config.ts:32` debe coordinar consentimiento con backend/política, y `constants/config.ts:71` requiere variable ausente/vacía para apagar online. Los nombres de pantallas se cotejaron con rutas del repositorio; si el build ensayado difiere, registrar versión y pantalla real, no dar por pasado el paso.
