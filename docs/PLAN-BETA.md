# Plan de acción hasta la beta

**Para Sebastián, Claude y Codex.** Escrito el 6 de octubre de 2026, sobre
`main` en `c160f4d` y `codex/fiabilidad` en `92b9116`.

## Qué significa "beta" acá

Gente real de Pereira armando pichangas y reservando canchas, **por web**, pagando
**en efectivo**, con un canal de soporte atendido por una persona. En paralelo,
pruebas cerradas de Android con un grupo invitado.

Lo que la beta **no** incluye, a propósito:

- **Pagos online.** No hay cuenta de comercio Rapyd y la pasarela no está validada
  en sandbox. Se lanza con efectivo y los pagos online desactivados por bandera.
  No se promete una función que no existe.
- **iOS.** Requiere Xcode, certificados y TestFlight. Después de Android.
- **Staging.** La organización ya tiene el tope de dos proyectos gratuitos de
  Supabase y el segundo es un proyecto compartido en uso. Ver la desviación abajo.
- **Capacidad certificada.** Se van a medir escalones en el Postgres aislado de
  Codex. Eso no es un número de usuarios soportados ni un compromiso de servicio.

## La desviación de staging, y por qué es defendible

El plan de continuidad y la entrega de Codex piden ensayar en un Supabase de
staging antes de aplicar las ocho migraciones. No lo tenemos y no vale la pena
pausar un proyecto ajeno para conseguirlo. En su lugar:

1. **El preflight ya corrió contra producción** el 6 de octubre de 2026, en solo
   lectura: **cero conflictos** en los cuatro controles (reservas solapadas,
   referencias duplicadas, intervalos inválidos, disponibilidad inválida).
2. **La base tiene unas 75 filas**, todas del seed de demostración, que está
   versionado en `supabase/seed-demo.sql` con su `unseed-demo.sql`. Es
   reconstruible con un comando.
3. **La cadena completa de migraciones ya se ensaya** en el PostgreSQL 17 aislado
   de Codex, con 17 grupos de pruebas SQL.
4. Antes de aplicar se toma un volcado lógico de la base, porque el plan gratuito
   de Supabase no trae respaldos automáticos.

O sea: el riesgo que el staging cubriría —una migración que falla a mitad sobre
datos reales e irrecuperables— hoy no existe. **Y crece el día que entren canchas
y jugadores de verdad.** De ahí el orden: migrar antes de cargar contenido real,
no después.

Cuando haya gente usando la app, staging deja de ser opcional. Ahí las opciones
son Pro, o un proyecto gratuito a nombre de otra persona del equipo.

## Reparto

| Quién | Territorio |
|---|---|
| **Claude** | `app/**`, `components/**`, `lib/**`, `constants/**`, `types/**`, `Dockerfile`, `app.json`, `eas.json`, `.github/**`. La fusión, el despliegue a producción y las operaciones de Supabase. |
| **Codex** | `supabase/**`, `tests/**`, `scripts/**` de base de datos, `docs/auditoria/**`. Nada de producción. |
| **Sebastián** | Paneles (Supabase, Dokploy, Google Play, Gmail), credenciales, contenido real, soporte y moderación humana. |

---

# Fase A — Integración (Claude)

Ocho migraciones, dos Edge Functions nuevas y 129 archivos esperando en
`codex/fiabilidad`. La rama salió de `86a5ae8` y no tiene los seis commits que
`main` ganó después: **28 archivos colisionan**, 21 de código.

Las decisiones archivo por archivo están resueltas en
[integracion-claude-codex-2026-10-06.md](integracion-claude-codex-2026-10-06.md).
Lo crítico, repetido acá porque es lo que se pierde en un merge apurado:

- **`lib/auth.tsx`:** la rama todavía tiene `redirectTo: 'faltauno://reset'`.
  Tomarla a ciegas vuelve a romper la recuperación de contraseña en web. Hay que
  portar `destinoReset()` encima.
- **Diálogos:** gana `lib/alert.ts` de la rama, no `lib/dialogo.ts` de `main`.
  Borrar los de `main`. Cambiar una línea para que enrute siempre al modal propio.
- **`lib/store.ts`:** gana la rama entera; convergimos en `errorCarga`.

Después de fusionar, los cuatro bloques de adaptación que Codex dejó anotados con
archivo y línea:

1. **Caducidad y conciliación.** `types/database.ts` con los campos `caduca_at` y
   `estado_pago`; `app/checkout/[id].tsx` muestra el vencimiento, permite nueva
   referencia al reintentar y **no celebra un pago en `reembolso_pendiente`**;
   `app/mis-pagos.tsx` y `app/mis-reservas.tsx` representan devolución y
   caducidad; `lib/payments.ts` interpreta esos estados leyendo del servidor, sin
   confirmación del cliente.
2. **Operaciones transaccionales.** `lib/canchas.ts:351` → RPC
   `crear_establecimiento`; `lib/canchas.ts:186` → `reservar_con_partido`, sin el
   INSERT viejo (el campo `partido_id` ya no tiene permiso de cliente);
   `app/cancha/[id]/reservar.tsx:97` pide reserva e intención de partido en una
   sola llamada; `app/cancha/registrar.tsx:192` conserva la referencia al
   reintentar para no duplicar el alta.
3. **Historiales paginados.** `lib/admin.ts` y `lib/canchas.ts` consumen
   `historial_paginado`; `lib/store.ts` deja de recorrer todas las páginas
   privadas al iniciar y carga la primera bajo demanda; `app/admin/**`,
   `app/mis-pagos.tsx`, `app/mis-reservas.tsx`, `app/cancha/finanzas.tsx` y
   `app/cancha/agenda.tsx` ganan controles de paginación, estados de carga y
   reintento, y cursor por filtro.
   **Trampa:** el historial ordena por `created_at`, que no es el orden por fecha
   de juego que tenían las reservas. La agenda debe filtrar con `p_fecha` y
   ordenar su página visible por hora, sin tomar una página por toda la agenda.
4. **Moderación.** `lib/admin.ts` → `resolverReporte` invoca
   `moderar-contenido`, valida `error` y `data.ok`, y muestra el fallo en vez de
   dar éxito ficticio.

Y el defecto de la rama a corregir: en `app/partido/[id].tsx`, ante un fallo de
red la pantalla muestra el aviso de red **y además** "este partido ya no existe".
Un corte de internet no puede decirle al usuario que le cancelaron la pichanga.
Revisar igual `app/post/[id].tsx`.

**Cierre de fase:** rama integrada sin cambios perdidos, CI verde (tipos, lint, 52
pruebas unitarias, 17 grupos SQL), y un pull request revisable a `main`.

# Fase B — Producción (Claude, con una decisión de Sebastián)

Orden estricto. Cada paso verifica antes de pasar al siguiente.

1. **Volcado lógico** de la base actual, guardado fuera del repo. El plan gratuito
   no trae respaldos.
2. **Merge del pull request** a `main`, con CI verde.
3. **Migraciones a mano:** Actions → *Migraciones de base de datos (prod)* →
   Run workflow, con `solo_ensayo` **activado**. Leer el plan que imprime. Recién
   después, repetir con `solo_ensayo` desactivado. El preflight corre solo dentro
   del workflow y corta si aparece un conflicto.
4. **Edge Functions:** desplegar `moderar-contenido` (manteniendo
   `verify_jwt=true`, nunca `--no-verify-jwt`) y `conciliar-pagos` con su
   programación. Las de Rapyd quedan como están, sin activar.
5. **Publicar el cliente** y verificar en el navegador antes de tocar nada más.
6. **Pruebas negativas reales contra producción**, por HTTP, no por unidad: que un
   jugador no pueda confirmarse una reserva online, ni cambiarle el precio, ni
   ascenderse a admin, ni aprobarse un pago o un retiro, ni leer reservas ajenas.
   Codex ya las probó en su base aislada; esto las confirma donde importa.

**Cierre de fase:** migraciones aplicadas, funciones activas, cliente publicado,
pruebas negativas pasando contra producción.

# Fase C — Verificación funcional con roles reales (Claude y Sebastián)

El guion completo, con tres cuentas desechables: jugador, dueño de cancha y
admin. Sobre producción, antes de invitar a nadie.

- Alta de establecimiento con dos canchas y sus horarios. Un fallo intermedio no
  deja datos a medias.
- Reserva en efectivo, con y sin publicar partido. El comprobante sobrevive si
  falla el paso social.
- Inscripción al último cupo desde dos sesiones a la vez: una sola entra.
- Cancelación, agenda del dueño, finanzas, solicitud de retiro.
- Muro: publicar, comentar, dar like, reportar, bloquear. Que bloquear oculte el
  contenido en todas las pantallas, no solo en el feed.
- Chat del partido, con red lenta y desconexión a mitad de un envío: no puede
  mostrar éxito sin confirmación, y el borrador se conserva.
- Moderación: reportar una imagen, resolverla con borrado, comprobar que el
  archivo queda inaccesible. Un jugador recibe 403.
- **Eliminación de cuenta**, que es requisito de tienda: borra los archivos
  propios, no deja obligaciones pendientes huérfanas, y no da éxito ficticio.
- Recuperación de contraseña de punta a punta, mirando el destino final del
  enlace, no su texto.
- Siete temas, contraste, lector de pantalla, teclado en web, fuente grande.

**Cierre de fase:** guion ejecutado por los tres roles sin errores críticos ni
pérdida de datos.

# Fase D — Contenido y gente (Sebastián)

Nada de esto lo puede hacer un agente.

1. **Dos o tres canchas reales en Pereira**, con horarios, precios y fotos de
   verdad. Hablado con los dueños, no inventado.
2. **Diez a quince jugadores** invitados por WhatsApp, con una pichanga concreta
   ya armada para que entren a algo vivo, no a una app vacía.
3. **Canal de soporte público**, con responsable, plazo de respuesta y
   escalamiento. Un correo o un WhatsApp atendido de verdad.
4. **Moderación humana**: quién revisa un reporte y en cuánto tiempo. La lista de
   palabras del código no es moderación.
5. **Rotar lo que se compartió por chat**: contraseña de la cuenta, contraseña de
   aplicación de Gmail (generar la nueva, ponerla en Supabase, y recién después
   borrar la vieja) y las llaves de producción de Wompi en
   `.supabase-deploy.env`, que son de una pasarela que ya no se usa.

# Fase E — Android en pruebas cerradas (Claude y Sebastián)

1. **Clave de Maps para Android**, restringida al nombre del paquete y a la huella
   SHA-1 de firma de Google Play. La de ejemplo no sirve en un build de
   producción.
2. **EAS**: vincular el proyecto y definir las variables por entorno. Ninguna
   clave de servidor en `EXPO_PUBLIC_*`: eso queda dentro del bundle y lo lee
   cualquiera.
3. **Generar el AAB firmado.** El export de Hermes y el prebuild no sustituyen
   compilar y probar un binario.
4. **Instalar por pruebas internas** y validar en teléfonos reales: mapas, fotos,
   notificaciones, teclado, enlaces profundos, recuperación, reserva, denuncia
   —con todos los motivos visibles, que es por lo que ganó `lib/alert.ts`— y
   borrado de cuenta.
5. **Consola de Play**: clasificación de edad, Data Safety coherente con lo que
   el código recoge de verdad, política de privacidad accesible sin login,
   cuentas de revisión para jugador y dueño, y una cuenta desechable para que el
   revisor pruebe el borrado.
6. Contrastar los requisitos vigentes de target SDK y bibliotecas de 16 KB contra
   lo que muestre la consola ese día, no contra lo que recordemos.

**Cierre de fase:** binario firmado probado en dispositivos reales y ficha de Play
completa. La aprobación la decide Google.

# Fase F — Medición y criterios de parada (Claude)

1. Errores y latencia instrumentados, sin datos personales.
2. Consultas y bytes por acción, conexiones de Realtime, egress de Storage, y
   costo mensual estimado.
3. Objetivos iniciales propuestos, a ajustar con mediciones: errores inesperados
   por debajo del 1 %, p95 de lectura bajo 1 s y de escritura propia bajo 2 s.
   Cero corrupción financiera, cero sobrecupos, cero reservas duplicadas.
4. **Umbrales de parada** escritos antes de abrir: con qué se apagan los pagos o
   las reservas nuevas sin destruir historiales, quién decide y cómo se avisa.

---

## Riesgos abiertos, sin adornos

- **Rapyd sin validar.** La beta va en efectivo. Activar pagos online exige cuenta
  de comercio, sandbox probado de punta a punta, firma de webhook verificada y un
  flujo de devolución que hoy está deliberadamente desactivado.
- **Devoluciones.** Codex implementó la cola de `reembolso_pendiente`, pero la
  ejecución real queda apagada. Una cancelación con dinero ya cobrado necesita
  intervención humana hasta que se valide la pasarela.
- **Sin respaldos automáticos** en el plan gratuito. El volcado de la Fase B es
  manual y hay que repetirlo cuando entren datos reales.
- **Gmail como remitente.** Techo de unos 500 correos al día y es una cuenta
  personal. Al crecer, dominio propio con proveedor transaccional.
- **Sin staging.** Ver la desviación arriba. Deja de ser aceptable el día que haya
  gente adentro.
