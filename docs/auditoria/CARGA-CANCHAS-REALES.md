# Cargar canchas reales para la beta

Preparado el 6 de octubre de 2026, hora de Colombia. Esta guía se contrastó con el cliente de `main` en `795cd59` y las 18 migraciones. No se cargaron canchas ni se retiraron datos en producción. El estado de producción indicado por el responsable no se verificó desde este entorno.

Valen: empezá con un dueño real y una cancha física. El dueño debe crear su propia cuenta y dar de alta la cancha desde la app. Tener canchas disponibles **no crea partidos en Inicio**: después hace falta que alguien organice partidos reales para fechas futuras. No cambies las fechas de los partidos demo de julio para presentarlos como partidos nuevos.

## Formulario para pedirle al dueño

Completá una ficha por establecimiento y repetí el bloque de cancha por cada cancha física. El precio es por el alquiler de la cancha completa durante un turno, en pesos colombianos; el precio de un cupo de partido es otro dato.

```text
ESTABLECIMIENTO
Nombre comercial del establecimiento:
Ciudad:
Barrio / zona:
Dirección completa y referencia para llegar:
Enlace al punto correcto en el mapa:
Teléfono o WhatsApp que puede mostrarse a los jugadores:
Cantidad de canchas físicas:
Servicios: baños / duchas / iluminación / parqueadero / cubierta / tienda /
           cafetería / gradas / alquiler de implementos / WiFi / árbitro
Quién confirmó estos datos y fecha:

DUEÑO O PERSONA AUTORIZADA
Nombre:
Correo que usará para crear su cuenta:
Teléfono de coordinación:
¿Es el dueño o tiene autorización del dueño?:
¿Aceptará personalmente los términos y el mandato de recaudo en la app?:
No pedir contraseña, código de acceso, número de tarjeta ni datos bancarios.

CANCHA FÍSICA — repetir por cada una
Nombre que verá el jugador (por ejemplo, «La Bombonera — Cancha 1»):
Formato: 5 contra 5 / 7 contra 7 / 11 contra 11
Duración de cada turno: 60 o 90 minutos
Precio de cada turno, en COP, sin puntos ni comas:
¿Cambia el precio según el día o la hora? Detallar:
Fotos propias de la cancha y autorización para publicarlas:
Foto principal elegida:
Breve descripción y reglas que necesita conocer el jugador:

HORARIOS DEL ESTABLECIMIENTO — hora de Colombia, formato 24 horas
Lunes:     cerrado / abre __:__ / cierra __:__
Martes:    cerrado / abre __:__ / cierra __:__
Miércoles: cerrado / abre __:__ / cierra __:__
Jueves:    cerrado / abre __:__ / cierra __:__
Viernes:   cerrado / abre __:__ / cierra __:__
Sábado:    cerrado / abre __:__ / cierra __:__
Domingo:   cerrado / abre __:__ / cierra __:__
¿Hay pausa a mediodía, horarios distintos por cancha o cierre después de medianoche?:

TURNOS YA COMPROMETIDOS POR FUERA DE LA APP
Cancha / fecha / hora de inicio / hora de fin, sin datos personales del cliente:
¿Cuáles deben quedar fuera de la venta en la app?:
Política de cancelación que el dueño comunica a sus clientes:
Fecha desde la que el dueño se compromete a revisar la agenda de la app:
```

Pedí fotos del terreno, acceso e instalaciones. Evitá caras identificables, documentos, matrículas y conversaciones de terceros. El dueño conserva el control de su cuenta; Valen puede acompañarlo mientras llena el formulario, sin pedirle sus credenciales.

## Alta desde la app

**Revisar la tabla de límites antes de confirmar el alta.** La RPC crea las canchas con estado `activa`, no como borrador. Si tiene turnos vendidos fuera de la app o un horario/precio que hoy no se puede representar, no completar el alta todavía; resolver ese bloqueo antes de ofrecer disponibilidad. Pausar después no cancela reservas que alguien haya alcanzado a hacer.

1. El dueño abre la versión conectada a Supabase, crea su cuenta, confirma el correo si se solicita e inicia sesión. No usar «invitado» ni modo demo.
2. En **Perfil → Registrá tu cancha**, completa los ocho pasos: ubicación, cantidad de canchas, nombre/formato/precio/duración de cada una, fotos, turnos previos, servicios, horarios, contacto y aceptación legal.
3. Carga una cancha física por fila. Si un establecimiento tiene dos canchas que se alquilan al mismo tiempo, son dos canchas distintas; no dos formatos de una única cancha.
4. Comprueba los horarios antes de **Crear cancha / Crear canchas**. El alta usa un precio y una duración por cancha y los mismos horarios del establecimiento para todas. La primera foto se usa como portada. Si ocurre un error, reintenta desde esa misma pantalla y revisa el panel antes de volver a empezar el alta desde cero.
5. Valen entra con su propia cuenta de jugador a **Reservar una cancha** y comprueba nombre, dirección, punto del mapa, formato, fotos, precio y turnos. El dueño revisa **Panel de mi cancha → Agenda**. Anoten cualquier diferencia antes de anunciar disponibilidad a los jugadores.
6. El dueño o un organizador acuerda una fecha futura real y crea un partido con los datos correctos. Comprueben que aparece en Inicio con la ciudad/zona seleccionadas. Una reserva que ofrece crear un partido debe hacerse con una fecha y hora que el dueño pueda cumplir; no reservar horarios de prueba en producción para llenar el feed.

La RPC `crear_establecimiento(text,jsonb)` toma el dueño de su sesión, guarda canchas y disponibilidad en una sola transacción, agrega el rol `cancha` y conserva una referencia para reintentos. Una falla no debe dejar medio establecimiento creado. El cliente de `main` conserva esa referencia mientras permanece en la pantalla. Crear desde SQL Editor no reproduce automáticamente esa sesión, la referencia de reintento, la subida de fotos ni la aceptación personal del dueño. Por eso SQL no es la ruta normal de alta ni una forma de asignarle el negocio a una cuenta demo.

Antes de empezar, el responsable del despliegue debe confirmar que los pagos online siguen apagados en la build publicada. En el código actual, `EXPO_PUBLIC_PAGOS_ONLINE` activa online si contiene **cualquier texto**, incluso `false` o `0`; para apagarlo debe estar ausente o vacío al generar la build. Esto lo cambia el responsable, no el dueño. El efectivo se acuerda y paga en cancha: Falta Uno no recibe ese dinero ni debe mostrarlo como un pago online aprobado o como saldo liquidable de la plataforma.

### Límites que hay que resolver antes de publicar disponibilidad

| Caso del formulario | Qué permite hoy el código revisado | Qué hacer |
| --- | --- | --- |
| Precio distinto por día o por hora | El alta asigna el mismo precio de esa cancha a todos sus días. El editor posterior permite un precio por día, no varias tarifas dentro de un mismo día. | Confirmar el resultado en «Mi cancha» y en el listado de turnos. Si la tarifa no se puede representar, dejar la cancha pausada hasta resolverlo. |
| Editar horarios de una cancha con turnos de 90 minutos | El editor revisado vuelve a guardar la disponibilidad con duración de 60 minutos. | No guardar esos horarios desde ese editor hasta corregirlo; verificar la duración real de cada turno. |
| Horarios diferentes por cancha, dos franjas en un día, apertura nocturna | El alta comparte una franja por día entre las canchas. No representa una franja que cruza medianoche. | No abrir para reservas con un horario ficticio. Pedir al responsable una carga revisada de disponibilidad o una mejora del editor, con ensayo previo. |
| Turnos ya vendidos por fuera de la app | Elegir «Sí» en el alta lleva a Agenda, pero la Agenda revisada solo muestra turnos y reservas: no tiene una acción para cargar esos compromisos. | No asumir que quedaron bloqueados. Mantener pausada la cancha hasta tener un procedimiento de bloqueo validado; no inventar reservas ni usuarios para simularlo. |
| Tipo de acceso y política de cancelación | El formulario muestra estas opciones, pero no las envía al guardar el establecimiento. | Registrar lo acordado en la ficha y pedir la corrección; no prometer que la app almacenó o aplica esa política. |
| Varias canchas del mismo dueño | El alta las crea, pero varias pantallas del dueño toman la primera de la lista. | Comprobar que puede gestionar cada cancha y su agenda antes de abrir las demás. Si no puede elegirlas, mantenerlas pausadas y reportar el límite. |
| Zona o ciudad ausente en las opciones | El alta ofrece listas cerradas. | No elegir un barrio o una ciudad falsa para poder avanzar. Pedir la ampliación al responsable del cliente. |

Un administrador autorizado puede pausar una cancha desde **Plataforma Madre → Canchas**. Pausar impide nuevas reservas, pero no cancela las existentes ni resuelve pagos. No usar ajustes de saldo, aprobaciones de retiro o cambios de estado financiero para hacer que la carga «pase».

## Qué borra realmente `unseed-demo.sql`

El archivo tiene una única sentencia ejecutable:

```text
DELETE FROM auth.users WHERE email LIKE '%@demo.faltauno.app';
```

**Ese bloque es una explicación, no un paso para ejecutar.** Selecciona todas las cuentas cuyo correo termina en ese dominio; no usa una lista cerrada de los seis UUID del seed y no comprueba si alguien real se relacionó con ellas. Su comentario «No toca datos reales» no es una garantía válida después de abrir la beta.

Si la eliminación llega a completarse, estas son las consecuencias de las relaciones y triggers actuales:

| Relación con la cuenta demo eliminada | Consecuencia posible sobre personas reales |
| --- | --- |
| Perfil de la cuenta | Se elimina por la relación desde Auth. También se eliminan sus datos de desembolso y operaciones idempotentes. |
| Canchas cuyo dueño es demo | Se eliminan canchas, disponibilidad, membresías, movimientos contables y retiros. Las reservas hechas por **jugadores reales en esas canchas** también están en la cascada. |
| Partidos organizados por demo | Se eliminan partidos, inscripciones, pagos, mensajes de chat y calificaciones relacionados, incluso los escritos o pagados por usuarios reales. Una reserva que los enlazaba queda con `partido_id = NULL`, si no se elimina por otra relación. |
| Reservas hechas por un jugador demo | Se eliminan esas reservas, aunque la cancha tenga un dueño real. Los movimientos que sobrevivan pierden su `reserva_id` por `ON DELETE SET NULL`. |
| Posts escritos por demo | Se eliminan posts y sus comentarios y likes, también los de usuarios reales. Un post real que enlazaba un partido demo conserva el post, pero pierde ese enlace. |
| Comentarios, likes, mensajes, calificaciones e inscripciones escritos por demo | Se eliminan los que dependen de ese autor/jugador, aunque el contenido principal sea real. |
| Bloqueos que involucren la cuenta demo | Se eliminan, incluidos bloqueos creados por usuarios reales contra esa cuenta. |
| Reportes | Los enviados por demo se eliminan. Los enviados por otros contra un autor demo sobreviven; la novena elimina de ellos texto, foto y referencia identificable al cerrar el perfil. |

La **novena migración** agrega otra condición: el trigger previo al borrado del perfil comprueba obligaciones y rechaza el cierre si hay reservas o partidos futuros, pagos online/devoluciones pendientes, saldo distinto de cero o retiros en curso. El seed contiene saldo y retiros ficticios, por lo que el borrado puede fallar. No quitar el trigger ni borrar esas obligaciones para forzarlo. Si la sentencia falla, PostgreSQL revierte esa sentencia completa; el rechazo no demuestra que una limpieza futura sea segura.

Cuando el cierre está permitido, el trigger conserva en `archivo_contable` datos mínimos de pagos, reservas, movimientos y retiros antes de la cascada. Eso no conserva la agenda, el chat, las inscripciones ni la experiencia del usuario real y no convierte `unseed-demo.sql` en un procedimiento seguro. Los plazos de 10 años / 90 días siguen sujetos a la decisión del responsable; esta guía no los cambia ni los da por aprobados.

`conciliaciones_pago` enlaza por una referencia de texto, sin clave foránea: no desaparece necesariamente al borrar el usuario. Las solicitudes de eliminación completadas y los registros de ejecución también tienen vida propia. El SQL de unseed **no llama a la API de Storage** ni al nuevo `delete-user`, no registra por sí solo una solicitud de borrado y no limpia archivos como lo hace la función. En Supabase, la existencia de archivos propios puede además impedir la eliminación de Auth. Las fotos del seed son URLs externas, no archivos del proyecto; una foto real añadida después tiene otro tratamiento. No borrar filas de `storage.objects` a mano.

⚠️ Volver a ejecutar **`seed-demo.sql` tampoco es una solución**: comienza con el mismo borrado por dominio y después vuelve a insertar cuentas, canchas, reservas, saldos y retiros ficticios. Aunque las fechas del script sean relativas a `current_date`, la fecha de las filas ya cargadas no cambia sola.

## Retirar la demo sin perjudicar la beta

1. **Separar el alta real del retiro de demo.** Crear negocios con cuentas reales y UUID nuevos. No renombrar una cancha demo para convertirla en el negocio real ni transferirle una cuenta de ejemplo al dueño.
2. **Frenar nuevas relaciones con demo.** Un administrador pausa las cuatro canchas del seed desde Canchas. Revisa que el buscador ya no permita reservarlas. Para partidos demo visibles, el responsable prepara su ocultamiento administrativo sin borrarlos ni generar reportes falsos. Los partidos vencidos ya quedan fuera del feed de próximas fechas; no se necesita borrar historial para que Inicio se llene de actividad real.
3. **Hacer un respaldo antes de cualquier retiro destructivo.** La persona técnica sigue el apartado «Respaldo y restauración» de [cola-operativa-2026-10-06.md](cola-operativa-2026-10-06.md), comprueba su restauración aislada y recuerda que el volcado lógico no es un respaldo de Auth ni de Storage. Conservar la evidencia del respaldo sin publicarlo en chats o en el repositorio.
4. **Inventariar, en solo lectura, por UUID y por relación.** La persona técnica debe identificar cuentas demo, canchas, partidos, posts y reservas; contar usuarios no demo relacionados; revisar pagos, devoluciones, saldo y retiros; y listar los archivos mediante las herramientas/API de Storage autorizadas. No basarse solo en el correo o en el nombre comercial. Diferenciar expresamente movimientos ficticios del seed de transacciones reales; si no se puede demostrar el origen, conservarlos y frenar.
5. **Si hubo interacción real, conservar historial y resolver compromisos.** Confirmar con los afectados qué pasa con cada reserva o partido; atender pagos/devoluciones sin modificar importes para eliminar cuentas. Mantener oculta/pausada la demo mientras se resuelve. No ejecutar unseed. Pedir una intervención específica, por registros revisados, con respaldo y ensayo sobre una copia aislada, que proteja las relaciones reales y deje evidencia.
6. **Si se demuestra que todo es ficticio y está aislado, preparar una limpieza específica.** La persona técnica entrega antes un listado cerrado de UUID, conteos esperados por tabla, resultado del ensayo con las 18 migraciones y tratamiento de Auth/Storage y archivo contable. El responsable decide y autoriza esa limpieza concreta. Este documento no autoriza ejecutar unseed ni contiene un SQL destructivo para producción. El guard de obligaciones permanece activo; si bloquea, se analiza el caso y se conserva la demo.
7. **Comparar después, sin exportar datos personales.** Conteos de canchas reales, reservas e historiales de usuarios reales deben coincidir con lo esperado. Verificar desde la app que se pueden ver las nuevas canchas, sus horarios y partidos futuros. Registrar quién hizo cada paso, fecha, evidencia y pendientes.

Que Inicio no muestre partidos viejos es el comportamiento esperado del filtro de fechas, no una razón para borrar cuentas ni contabilidad. Para una beta útil, priorizar acuerdos reales con dueños, disponibilidad que puedan cumplir y partidos futuros organizados por personas reales.

## Evidencia y pendientes para los agentes

Revisión estática realizada; **no** se ensayó la carga con una cuenta real, una reserva de producción ni una eliminación de demo. No se afirma que haya o no interacciones reales en producción. El inventario y el ensayo de cualquier limpieza son pendientes concretos de la persona responsable.

| Fuente revisada | Qué sustenta |
| --- | --- |
| `supabase/unseed-demo.sql:4`; `supabase/seed-demo.sql:7,32,50,58,74,85` | Selección por dominio; conjunto demo de cuatro canchas, cinco partidos, seis reservas; movimientos y retiros ficticios. |
| `supabase/migrations/20260711225940_baseline.sql:705–850` | Cascadas y referencias que se ponen a NULL. |
| `supabase/migrations/20261006170000_operaciones_transaccionales.sql:10,35` | Alta atómica/idempotente ligada a la sesión; rol del dueño actualizado por RPC. |
| `supabase/migrations/20261006200000_retencion_eliminacion.sql:37,136,144,158` | Motivos de bloqueo, guard previo a borrado, archivo contable y desidentificación de reportes. |
| `supabase/functions/delete-user/index.ts:27,33,52` | Solicitud, limpieza por API de Storage y eliminación de Auth; unseed no sigue ese recorrido. |
| `lib/store.ts:222` | El feed carga partidos desde la fecha actual en Colombia. |
| Cliente `main 795cd59`: `app/cancha/registrar.tsx:178,198,217` y `lib/canchas.ts:393` | Conservación de referencia de alta, llamada RPC y relectura del rol. El cliente antiguo que permanece en esta rama no es la referencia del despliegue. |

Cambios de cliente que requieren el otro agente, **sin modificar esos archivos aquí**: guardar o retirar las opciones de tipo de acceso/cancelación (`main`, `app/cancha/registrar.tsx:198,457,520`); ofrecer bloqueo de turnos externos antes de prometerlo (`main`, `app/cancha/registrar.tsx:410`, `app/cancha/agenda.tsx:150`); selección explícita de cancha en panel/editor/agenda/finanzas (`app/cancha/panel.tsx:59`, `app/cancha/editar.tsx:95`, revisar el equivalente desplegado); conservar los turnos de 90 minutos al editar (`main`, `app/cancha/editar.tsx:190`); y lectura explícita de la bandera de pagos (`constants/config.ts:71`). Estos pendientes no se resuelven con inserciones manuales desde SQL Editor.
