# Navegación: volver e inicio en toda la app

Fecha: 5 de octubre de 2026
Estado: diseño aprobado, pendiente de plan de implementación

## Problema

Toda la app cuelga de un **Stack único** (`app/_layout.tsx`): las pestañas son una
pantalla más y el resto se apila encima. Al entrar a cualquier pantalla de detalle
desaparece la barra de pestañas, así que la única salida es retroceder paso a paso.
Desde el fondo de un flujo largo (cancha → reservar → checkout) eso son tres o cuatro
toques para volver al principio.

Además, dos pantallas se quedaron sin ningún botón de salida:

- `app/cancha/panel.tsx` — el panel "Mi Cancha". Arma su título con un `<Text>` suelto.
- `app/reset.tsx`

Las otras 28 pantallas de detalle ya usan `ScreenHeader`/`BackButton`
(`components/BackButton.tsx`), que resuelve el botón de volver con háptico y tema.
Lo que no existe en ninguna parte es un botón de "ir al principal".

## Objetivo

Que desde cualquier pantalla se pueda volver atrás **y** saltar a la raíz en un toque,
sin que el botón sorprenda nunca.

## Diseño

### A. `HomeButton`: un botón de inicio contextual

Componente nuevo, hermano de `BackButton` y con el mismo círculo. Resuelve el destino
leyendo la ruta actual con `usePathname()`:

| Ruta actual | Destino | Ícono |
| --- | --- | --- |
| `/admin/*` | `/admin` (resumen Plataforma Madre) | escudo |
| `/cancha/panel`, `/cancha/agenda`, `/cancha/finanzas`, `/cancha/editar`, `/cancha/registrar` | `/cancha/panel` | cancha |
| Todo lo demás | `/(tabs)` (Inicio, con la barra de pestañas de vuelta) | casa |

Dos decisiones que conviene dejar escritas:

1. **`/cancha/[id]/*` NO es zona de dueño.** Es la ficha pública que ve un jugador
   buscando dónde jugar, así que su inicio es Inicio, no el panel de otra cancha.
2. **En la raíz de una sección el botón lleva a Inicio.** Estando ya en `/admin` o en
   `/cancha/panel`, un botón que apunte a sí mismo sería un botón muerto.

El háptico se dispara igual que en `BackButton` (`haptics.tap()`), por coherencia con el
resto de controles de navegación.

### B. `ScreenHeader` lo monta solo

`ScreenHeader` gana la prop `home`, **encendida por defecto**. Así las 28 pantallas que
ya lo usan heredan el botón sin editarlas una por una: menos diff, y ninguna se queda
olvidada. Las que ya pasan `right` con acciones propias reciben el inicio a la izquierda
de ese contenido, en la misma fila.

### C. Las dos pantallas huérfanas

`cancha/panel.tsx` y `reset.tsx` pasan a usar `ScreenHeader`, con lo que ganan volver e
inicio de una vez. En `panel.tsx` eso implica reemplazar el `<Text>` del título por el
header, respetando el `lineHeight`/`paddingTop` anti-clipping que ya usa.

### D. Filtros al volver (a verificar antes de tocar nada)

`(tabs)/buscar.tsx` y `canchas.tsx` guardan sus filtros en `useState` local. En teoría el
Stack mantiene viva la pantalla de atrás y los filtros sobreviven solos. **Primero se
comprueba**; solo si de verdad se pierden se suben a `lib/store.ts` (zustand, ya
persistente). No se toca nada que no esté roto.

## Riesgo conocido

`ScreenHeader` con `titleAlign="center"` centra el título con un espaciador de `w-10` a la
derecha que iguala al botón de volver. Al meter un segundo botón hay que recalcular ese
ancho o los títulos centrados quedan corridos. Revisar en concreto las pantallas que usan
`titleAlign="center"` y las que pasan `right`.

## Verificación

El proyecto no tiene pruebas automáticas. Se verifica con:

1. `node_modules/.bin/tsc --noEmit` en verde.
2. `pnpm lint` en verde.
3. Recorrido manual en la web desplegada:
   - Entrar a un checkout y comprobar que un toque devuelve a Inicio con las pestañas.
   - Desde Finanzas, comprobar que el inicio lleva al panel Mi Cancha y no a Inicio.
   - Desde `/admin/usuarios`, comprobar que lleva al resumen de admin.
   - Comprobar que ningún título centrado quedó descuadrado.

## Fuera de alcance

Los otros tres frentes acordados van en especificaciones aparte: háptico parejo en toda
la app, completar vacíos/esqueletos/errores, y las notificaciones (que además tocan
servidor y obligan a decidir celular contra web).
