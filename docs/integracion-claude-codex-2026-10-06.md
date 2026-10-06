# Integración de `codex/fiabilidad` con `main`

**Para quien haga la fusión.** Decisiones ya tomadas, archivo por archivo, para que
el merge sea mecánico y no un ejercicio de memoria. Verificado el 6 de octubre de
2026 contra `origin/codex/fiabilidad` en `2765bcc`.

## Situación

La rama salió de `86a5ae8` y **no contiene** los cinco commits que `main` ganó
después: `c29f30e`, `c8ebb9e`, `537a5a0`, `74d584c`, `7da4eaf` y `c79c981`. Es una
fusión de tres vías real: 34 archivos tocados en `main`, 127 en la rama, **28 en
colisión** (21 de código, 7 de documentación).

Los 7 de documentación colisionan porque la rama trae su propia copia de los
informes que ya se publicaron en `main` en `5d8a3a5`. Se resuelven tomando la
versión de la rama, que es la original.

## Cambios que se perderían si se toma la rama a ciegas

### `lib/auth.tsx` — **el importante**

La rama **todavía tiene `redirectTo: 'faltauno://reset'`**. Ese es un enlace
nativo que ningún navegador sabe abrir: con él, pedir "olvidé mi contraseña" en la
web manda un correo cuyo enlace no hace nada. `main` lo arregló en `7da4eaf` con
`destinoReset()`, que usa `window.location.origin` en web y el deep link en
celular. Está verificado funcionando contra producción, incluida la lista blanca
de Supabase.

**Resolución:** base la de la rama (trae mejoras de sesión y de cambio de cuenta),
y portar encima de `main`:

1. La función `destinoReset()` completa, con su comentario.
2. `redirectTo: destinoReset()` en `resetPassword`.
3. El aviso de cuenta suspendida, que en `main` pasó de `Alert.alert` a diálogo
   propio. Con la decisión de diálogos de abajo, queda como `Alert.alert` del
   módulo `@/lib/alert` — o sea que acá gana la rama, pero hay que comprobar que
   el aviso siga existiendo y no se pierda en el conflicto.

### `components/ModeracionBoton.tsx`

`main` le agregó `haptics.tap()` en `86a5ae8`..`main`; la rama le cambió el menú de
Android para conservar todos los motivos de denuncia. Los dos cambios son
compatibles: base la de la rama, reponer la llamada háptica.

## Colisiones donde gana la rama, sin reservas

### `lib/store.ts`

Convergimos por separado: la rama añadió un `errorCarga: string | null` con el
mismo nombre y la misma semántica que `74d584c` (se fija en el catch, se limpia al
tener éxito), y además trae paginación, `PAGE_SIZE`, versionado de sesión y caché
de 30 s. **Gana la rama entera.** `components/ErrorCarga.tsx` de `main` sigue
funcionando sin tocarlo, porque el nombre del campo coincide.

### Los 14 archivos del cambio de `Alert.alert` a diálogo propio

`main` los migró a `dialogo.mostrar(...)` en `c8ebb9e`; la rama mantiene
`Alert.alert(...)` apuntando a su propio módulo `@/lib/alert`. **Gana la rama** en
todos: su módulo es un reemplazo directo, así que las llamadas no cambian.

### `app/partido/[id].tsx` y `app/post/[id].tsx`

La rama trae `lib/usePartido.ts`, que lee por ID en vez de depender de que el
elemento esté en la página cargada del feed. Eso es estrictamente mejor que los
`errorCarga` que `main` les puso en `537a5a0` y `74d584c`: arregla el caso de un
enlace compartido abierto por alguien sin sesión, que hoy ve "no existe". **Gana
la rama**, y los parches de `main` se descartan — pero ver el defecto de abajo.

## Decisión de diálogos: gana `lib/alert.ts`, con un cambio

`main` tiene `lib/dialogo.ts` + `components/Dialogo.tsx`; la rama tiene
`lib/alert.ts` + `components/AlertProvider.tsx` + `tests/alert.test.cjs`.

**Gana la de la rama.** Es mejor en cuatro cosas medibles: respeta
`useReducedMotion`, trae roles de accesibilidad para lector de pantalla
(`alert`, `header`, `button`, `accessibilityViewIsModal`), encola los avisos para
que uno no pise al otro, y captura los errores de los manejadores de botón en vez
de dejar una promesa sin atrapar. Además es un reemplazo directo de `Alert.alert`,
así que no hay que tocar ninguna llamada, y viene con prueba.

Y resuelve algo que `main` no contemplaba y que es requisito de tienda: **el
diálogo nativo de Android trunca los menús de más de tres botones**, y el menú de
denuncias tiene más motivos que eso. Apple y Google exigen que reportar contenido
sea accesible.

**El único cambio:** su `Alert.alert` enruta al diálogo del sistema en iOS y en
Android con tres botones o menos. El diseño acordado es modal propio en todas las
plataformas, así que la condición de `lib/alert.ts` debe enrutar siempre al modal
propio. Es una línea.

**Al cerrar:** borrar `lib/dialogo.ts` y `components/Dialogo.tsx`, y quitar
`<Dialogo />` de `app/_layout.tsx` en favor de `AlertProvider`.

## Defecto encontrado en la rama, a corregir después de fusionar

En `app/partido/[id].tsx` de la rama, cuando `error` tiene valor la pantalla
muestra el `ErrorBanner` **y además** el `EmptyState` titulado "Este partido ya no
existe", con el texto "puede que lo hayan cancelado o que el cupo ya se haya
cerrado". O sea que un fallo de red le dice al usuario que le cancelaron la
pichanga.

El hook `usePartido` separa bien los estados; la pantalla no usa esa separación
para el título ni para el texto. Es justo lo que el plan de continuidad prohíbe:
*"el texto de inexistencia no debe aparecer junto a un error de red"*. Revisar
igual `app/post/[id].tsx`. Son archivos de cliente, así que los corrige Claude
después de la fusión, no en la rama.

## Lo que queda para el cliente tras fusionar

El punto 5 de la rama entrega la capa de servidor de los historiales
(`historial_paginado`) y deja anotado que la app **no queda integrada** hasta
adaptar: `lib/admin.ts`, `lib/canchas.ts`, `lib/store.ts` (que `hidratar` no
recorra todas las páginas privadas al iniciar), `types/database.ts`, y las
pantallas `app/admin/**`, `app/mis-pagos.tsx`, `app/mis-reservas.tsx`,
`app/cancha/finanzas.tsx` y `app/cancha/agenda.tsx`, con controles de paginación,
estados de carga y reintento, y cursor por filtro.

Ojo con la agenda: el historial ordena por `created_at`, que no es el orden por
fecha de juego que tenían las reservas. Si la agenda filtra por día, usar
`p_fecha` y ordenar la página visible por hora, sin interpretar una página como
toda la agenda.

## Orden de la operación

El preflight corrió contra producción el 6 de octubre de 2026 con **cero
conflictos** en los cuatro controles, y la base tiene unas 75 filas, todas del
seed de demostración versionado en `supabase/seed-demo.sql`. O sea que el riesgo
de que una migración falle a mitad sobre datos reales hoy es casi nulo, y crece en
cuanto entren canchas y jugadores de verdad.

1. Fusionar la rama en una rama de integración, resolviendo con este documento.
2. CI verde (tipos, lint, pruebas unitarias y SQL).
3. Corregir el defecto del estado vacío y adaptar los historiales.
4. Merge a `main` por pull request.
5. Aplicar migraciones a mano: Actions → *Migraciones de base de datos (prod)*,
   primero con `solo_ensayo` activado. El preflight corre solo dentro del
   workflow.
6. Desplegar las Edge Functions nuevas: `moderar-contenido` y `conciliar-pagos`.
7. Publicar el cliente y verificar.
