# Fase 2 — Reforzar el design system — Diseño

**Fecha:** 2026-07-11
**Estado:** Aprobado por el dueño (10 decisiones resueltas). No-breaking, refactor interno.
**Objetivo:** Convertir en fundación compartida los patrones que hoy están copy-pasteados
y divergentes (motion, haptics, danger/warning, banner de error, stat card, botón de
volver, píldora de urgencia, theming reactivo), sin cambiar el look&feel. Cada migración
es drop-in: un token o componente que reproduce el valor/markup actual 1:1.

Este spec ejecuta la **Fase 2** del roadmap de `docs/DESIGN.md` §13 ("Deuda conocida"). El
estándar de diseño (`docs/DESIGN.md`) es la Fase 1 y sigue siendo la fuente de verdad de
tokens, tipografía, motion y haptics; acá solo se **centraliza y adopta** lo que ese
documento ya declaró como deuda (§5 motion, §6 haptics, §7 error banner, §12 drift de
píldora/stat/back-button). La **taste skill es web-only** (genera referencias de UI para
web), así que esta app RN/Expo la usa como criterio de gusto, no como generador: las
decisiones visuales acá se toman a mano contra el design system existente.

Nota de alcance vs §13: la lista original de Fase 2 en `DESIGN.md` incluía "migrar radios y
hex al estándar" y sugería tipografía; en este spec **eso se difiere a Fase 3 / mini-fase
aparte** (ver "Fuera de alcance"). Fase 2 se acota a fundación + migraciones drop-in.

---

## 1. Contexto y objetivo

El problema no es *slop* (código feo o mal hecho): las piezas actuales están bien
resueltas. El problema es **drift**: la misma decisión de diseño se reimplementó a mano N
veces y con el tiempo las copias divergieron (10ms de más en un press-out, un rojo más
claro en un banner, un `rounded-sm` suelto, un mapa de colores que congela el tema por
defecto). Cada copia es un lugar donde el look puede cambiar sin querer y donde el theming
en vivo no llega.

Fase 2 entrega:

- **Tokens sin dependencias:** `constants/motion.ts` (duraciones + easings), `lib/haptics.ts`
  (vocabulario háptico), y la reconciliación de `danger`/`warning` a una sola fuente por-tema
  (CSS vars).
- **Primitivas nuevas adoptadas:** `ErrorBanner`, `StatCard`, `BackButton` (+ `ScreenHeader`),
  `UrgencyPill`.
- **Theming reactivo:** migrar los componentes/pantallas que leen el proxy estático `Colors`
  a `useTheme()`, para que respondan al cambio de tema en vivo.

**Invariante duro (motion + haptics):** la migración NO debe cambiar el feel. Cada token de
duración/easing y cada verbo de haptics mapea **1:1 al valor/llamada actual (byte-idéntico)**.
Dos trampas marcadas por la verificación:

- `GameCard` usa `selectionAsync()` en un tap de **navegación** → mapea a `haptics.select()`,
  **NO** se "normaliza" a `tap()` aunque parezca inconsistente (cambiaría el tick).
- Press-out de `GlowButton` (120ms) vs `GameCard` (130ms) → se mantienen **tokens distintos**
  (`fast` vs `fastCard`). Mergearlos es una decisión opcional aparte, no un efecto colateral.

---

## 2. Motion — `constants/motion.ts`

**Qué existe hoy:** 9 call-sites de timing (Reanimated `withTiming`/`withRepeat`/`withDelay`)
en 5 archivos, con **8 duraciones distintas** (90/120/130/460/600/800/900/1100 ms) y 4
easings (`Easing.out(Easing.cubic)` x3, `Easing.inOut(Easing.quad)` x1, `Easing.linear` x1,
y default/sin-easing en los 4 press-feedback). Todo inline como magic numbers. No hay
`withSpring` ni animaciones de layout/entering en el proyecto. La stagger `delay` de `FadeIn`
(~40 pantallas) es un concern aparte y **no** se toca acá.

**API propuesta:** archivo nuevo `constants/motion.ts` (hermano de `constants/colors.ts` /
`constants/themes.ts`), que exporta dos objetos cuyos valores son **exactamente** los actuales.

| Token | Tipo / valor | Propósito |
| --- | --- | --- |
| `Duration.instant` | `90` | Press-in tap (GlowButton:50, GameCard:32) |
| `Duration.fast` | `120` | Press-out GlowButton:51 |
| `Duration.fastCard` | `130` | Press-out GameCard:33 (distinto de `fast` para preservar feel) |
| `Duration.base` | `460` | Entrada de contenido FadeIn:26 |
| `Duration.slow` | `600` | Fade del splash index:29 |
| `Duration.shimmer` | `800` | Medio ciclo del shimmer Skeleton:12 |
| `Duration.spin` | `900` | Una vuelta del spinner checkout:173 |
| `Duration.grand` | `1100` | Escala del splash index:30 (mantener el `setTimeout(1150)` en sync) |
| `MotionEasing.entrance` | `Easing.out(Easing.cubic)` | Entrada desacelerada (FadeIn:26, index:29, index:30) |
| `MotionEasing.pulse` | `Easing.inOut(Easing.quad)` | Ping-pong simétrico del shimmer (Skeleton:12) |
| `MotionEasing.linear` | `Easing.linear` | Rotación a velocidad constante (checkout:173) |

```ts
// constants/motion.ts
import { Easing } from 'react-native-reanimated';
export const Duration = { instant: 90, fast: 120, fastCard: 130, base: 460, slow: 600, shimmer: 800, spin: 900, grand: 1100 } as const;
export const MotionEasing = { entrance: Easing.out(Easing.cubic), pulse: Easing.inOut(Easing.quad), linear: Easing.linear } as const;

// FadeIn.tsx
progress.value = withDelay(delay, withTiming(1, { duration: Duration.base, easing: MotionEasing.entrance }));
// GlowButton / GameCard: el press-feedback NO lleva easing (queda default-linear)
onPressIn={() => (scale.value = withTiming(0.96, { duration: Duration.instant }))}
```

**Sitios de migración (9):**

- `components/FadeIn.tsx:26` → `{ duration: Duration.base, easing: MotionEasing.entrance }`.
- `components/GlowButton.tsx:50` → `{ duration: Duration.instant }` (SIN easing).
- `components/GlowButton.tsx:51` → `{ duration: Duration.fast }` (SIN easing).
- `components/GameCard.tsx:32` → `{ duration: Duration.instant }` (SIN easing).
- `components/GameCard.tsx:33` → `{ duration: Duration.fastCard }` (SIN easing; no cambiar a `fast`).
- `components/Skeleton.tsx:12` → `{ duration: Duration.shimmer, easing: MotionEasing.pulse }`.
- `app/index.tsx:29` → `{ duration: Duration.slow, easing: MotionEasing.entrance }`.
- `app/index.tsx:30` → `{ duration: Duration.grand, easing: MotionEasing.entrance }`; **revisar** el
  `setTimeout(..., 1150)` acoplado en `app/index.tsx:31` (dejarlo o expresarlo como `Duration.grand + 50`).
- `app/checkout/[id].tsx:173` → `{ duration: Duration.spin, easing: MotionEasing.linear }`.

**Nota de la verificación (26 "missed"):** son líneas de `import` de `Easing` y declaraciones de
hooks (`useSharedValue`/`useAnimatedStyle`) en esos mismos 5 archivos; **no son nuevos
call-sites de timing**. Solo importan para la limpieza de imports: tras migrar, `FadeIn`,
`app/index.tsx`, `Skeleton.tsx` y `checkout/[id].tsx` pueden quedar con `Easing` sin usar
(lint) y hay que quitarlo.

**Riesgos:**

- Añadir `MotionEasing.entrance` a los press-feedback cambia el feel (de linear a eased). Los
  tokens deben documentar que el press-feedback va **sin easing**.
- `fast` (120) vs `fastCard` (130): se mantienen **separados** (decisión tomada), garantizando cero
  cambio de feel; no se unifican.
- `Duration.grand` y el `setTimeout(1150)` del splash están acoplados: cambiar uno sin el otro
  trunca o alarga el splash.
- `constants/motion.ts` importa solo `Easing` (puro) de Reanimated y números; no meter
  Animated components para no ampliar la superficie de import del bundle web.

---

## 3. Haptics — `lib/haptics.ts`

**Qué existe hoy:** 10 call-sites directos a `expo-haptics` con 5 formas de API: `impactAsync(Medium)`
x1 (GlowButton, gated por prop `haptic`), `impactAsync(Light)` x2 (likes), `selectionAsync()` x3
(tema, estrella, tap de card), `notificationAsync(Success)` x4 (crear/checkout/crear-post/calificar).
**No se usan** Heavy / Warning / Error. Todos fire-and-forget (sin `await`, sin `.catch`).

**API propuesta:** módulo nuevo `lib/haptics.ts` (hermano de `lib/theme.ts`, `lib/store.ts`) que
envuelve `expo-haptics` 1:1. Cada verbo = exactamente una llamada actual; fire-and-forget con
`.catch(()=>{})` (silencia el rechazo en web, donde `expo-haptics` es no-op). Se incluyen `warn` y
`error` (hoy sin uso) para tener a dónde enganchar los `catch`/Alert en el futuro.

| Verbo | Mapea a | Propósito |
| --- | --- | --- |
| `tap()` | `impactAsync(ImpactFeedbackStyle.Medium)` | CTA primario (GlowButton:53) |
| `light()` | `impactAsync(ImpactFeedbackStyle.Light)` | Like/toggle sutil (post, PostCard) |
| `select()` | `selectionAsync()` | Cambio de valor / tick (apariencia, StarRating, GameCard) |
| `success()` | `notificationAsync(NotificationFeedbackType.Success)` | Éxito de acción (4 sitios) |
| `warn()` | `notificationAsync(NotificationFeedbackType.Warning)` | Reservado (validación/soft-fail). Sin cablear |
| `error()` | `notificationAsync(NotificationFeedbackType.Error)` | Reservado (hard-fail). Sin cablear |

```ts
// lib/haptics.ts
import * as Haptics from 'expo-haptics';
const run = (p: Promise<unknown>) => { p.catch(() => {}); };
export const haptics = {
  tap: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  light: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(Haptics.selectionAsync()),
  success: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
// GlowButton: if (haptic) haptics.tap();
```

**Sitios de migración (10):** en cada uno, además de reemplazar la llamada, cambiar el
`import * as Haptics from 'expo-haptics'` (línea 2 de los 10 archivos) por `import { haptics } from '@/lib/haptics'`.

- `components/GlowButton.tsx:53` → `haptics.tap()` (conservar el gate `if (haptic)`).
- `app/post/[id].tsx:64` → `haptics.light()`.
- `components/PostCard.tsx:39` → `haptics.light()`.
- `app/apariencia.tsx:19` → `haptics.select()`.
- `components/StarRating.tsx:24` → `haptics.select()`.
- `components/GameCard.tsx:35` → `haptics.select()` (**NO** subir a `tap()`).
- `app/(tabs)/crear.tsx:84` → `haptics.success()`.
- `app/checkout/[id].tsx:76` → `haptics.success()` (opcional: `haptics.warn()` en el catch ~línea 78, **adición nueva**, no parte de la migración pura).
- `app/crear-post.tsx:50` → `haptics.success()`.
- `app/calificar/[id].tsx:41` → `haptics.success()`.

La verificación confirmó los 10 call-sites correctos; los 10 "missed" son justamente esas líneas de
`import` a intercambiar (ya contempladas arriba). No hay call-sites fuera de estos 10 archivos.

**Riesgos:**

- No dejar que el refactor "normalice" `GameCard.select()` a `tap()`.
- Preservar el gate `if (haptic)` de GlowButton (es el CTA de toda la app).
- El `.catch(()=>{})` del wrapper es un cambio de comportamiento sutil (silencia rechazos hoy no
  manejados): mejora segura, pero consciente.
- Los verbos `warn()`/`error()` **se crean pero NO se cablean** en Fase 2 (decisión tomada): cablearlos
  en los catch es feature addition y queda fuera de esta migración behavior-preserving.
- Quitar el `import * as Haptics` de los 10 archivos para no dejar imports sin uso (lint).

---

## 4. Danger / Warning — reconciliar a una sola fuente por-tema

**Qué existe hoy:** dos fuentes de verdad que divergen en el tema claro "Blanco". `tailwind.config.js`
hardcodea `danger: '#EF4444'` / `warning: '#F59E0B'`; `Colors.danger`/`Colors.warning` (proxy JS) leen
el palette del tema activo (en "Blanco": `#DC2626` / `#D97706`). `buildVars` NO emite `--c-danger` ni
`--c-warning`, así que la clase Tailwind no puede seguir al tema. En la práctica **ninguna pantalla usa
las clases `text-danger`/`bg-danger`**: el UI usa clases crudas `red-300/400/500` (banners de error) y
`warning` solo existe vía `Colors.warning` en JS (cero `amber-*`/`yellow-*`). ~45 usos JS de `Colors.*`
son correctos y per-tema.

**API propuesta:** cerrar el bucle igual que los demás tokens de marca (que ya usan `rgb(var(--c-x) / <alpha-value>)`).

| Pieza | Valor | Propósito |
| --- | --- | --- |
| `--c-danger` | triplete RGB (ej. `238 68 68`) | Emitido por `buildVars(p)` vía `hexToRgbTriplet(p.danger)`. Fuente única por-tema |
| `--c-warning` | triplete RGB (ej. `245 158 11`) | Emitido por `buildVars(p)` vía `hexToRgbTriplet(p.warning)` |
| `danger` (Tailwind) | `rgb(var(--c-danger) / <alpha-value>)` | Reemplaza `#EF4444`. Habilita `text-danger`, `bg-danger/10`, `border-danger/30`, etc. |
| `warning` (Tailwind) | `rgb(var(--c-warning) / <alpha-value>)` | Reemplaza `#F59E0B` |
| `Colors.danger` / `Colors.warning` | hex (proxy, sin cambios) | Siguen igual; ahora comparten valor exacto con las clases en todos los temas |

```
// constants/themes.ts buildVars(p):
'--c-danger': hexToRgbTriplet(p.danger),
'--c-warning': hexToRgbTriplet(p.warning),
// global.css :root:
--c-danger: 238 68 68;
--c-warning: 245 158 11;
// tailwind.config.js:
danger: 'rgb(var(--c-danger) / <alpha-value>)',
warning: 'rgb(var(--c-warning) / <alpha-value>)',
```

**Sitios de migración (config primero, luego clases; ~23):**

Config (4):
- `tailwind.config.js:29` → `danger: 'rgb(var(--c-danger) / <alpha-value>)'`.
- `tailwind.config.js:30` → `warning: 'rgb(var(--c-warning) / <alpha-value>)'`.
- `constants/themes.ts:152` (en `buildVars`) → agregar `--c-danger` y `--c-warning`.
- `global.css:18` (en `:root`) → agregar `--c-danger: 238 68 68;` y `--c-warning: 245 158 11;`.

Clases crudas → token (19):
- `components/Badge.tsx:14` → `bg-danger/15 border border-danger/40`, texto `text-danger`.
- Banners de error (borde+fondo y texto): `login:81`+`:83`, `register:156`+`:158`, `recuperar:90`+`:92`,
  `reset:105`+`:107`, `(tabs)/crear:216`+`:218`, `editar-perfil:96`+`:98`, `cancha/registrar:555`+`:557`,
  `cancha/editar:423`+`:425` → `border-danger/30 bg-danger/10` y `text-red-300 → text-danger` (decidido: se acepta el leve oscurecimiento).
- `app/(tabs)/perfil.tsx:217` → `text-red-400 → text-danger` (rama `tone==='danger'`).
- `app/calificar/[id].tsx:86` → `bg-red-500/15 → bg-danger/15`.

**Nota de la verificación (33 "missed"):** son todos usos JS de `Colors.danger`/`Colors.warning`
(iconos de banner `color={Colors.danger}`, mapas estado→color en admin/cancha/finanzas, shadowColor,
etc.). **No son sitios de migración de este concern**: ya son per-tema y correctos. Los mapas de estado
(`ESTADO_COLOR`, `TIPO`, `RETIRO_ESTADO`) se migran en el concern **reactive-theming** (§9), no acá.

**Riesgos:**

- **Tono del texto (decidido):** `red-300` (#FCA5A5) y `red-400` (#F87171) son más **claros** que `danger`
  base (#EF4444), así que `text-red-300/400 → text-danger` oscurece levemente el texto sobre fondos
  oscuros. Se **acepta** ese leve oscurecimiento y se usa `text-danger` en todos los casos (banners, Badge,
  perfil). NO se introduce token `--c-danger-soft`.
- **Orden:** aplicar los 4 sitios de config **antes** de migrar clases; si no, el token resolvería a
  indefinido/transparente.
- **"Blanco" es el único tema** donde cambia el pixel de las clases (a `#DC2626`/`#D97706`): es el
  objetivo (converger con `Colors.*`), pero revisar banners/badges en modo claro.
- Los ~45 usos JS de `Colors.*` **no se tocan**. `warning` como clase no tiene sitios de migración aún
  (cero `amber/yellow`); solo se habilita el token para el futuro.

---

## 5. ErrorBanner — `components/ErrorBanner.tsx`

**Qué existe hoy:** el banner inline de error está duplicado **byte-idéntico en 8 pantallas** de
formulario. La única diferencia real de markup: 2 pantallas de cancha agregan `mt-2`. El texto usa
`red-500`/`red-300` hardcodeado (no sigue al tema); solo el icono usa `Colors.danger`. Ninguna variante
tiene dismiss, retry, título ni tamaño distinto. Hay un **falso positivo** (`calificar/[id].tsx:86`, el
chip del toggle "no-show") que NO se migra.

**API propuesta:** `components/ErrorBanner.tsx`. Reproduce el look actual; usa el token `danger` para
borde/fondo (en vez de `red-500`) **y para el texto** (`text-danger` en vez de `text-red-300`, decisión
tomada), y conserva el icono `Colors.danger`. `onDismiss`/`action`/`icon` son props a futuro, sin uso hoy.

| Prop | Tipo | Propósito |
| --- | --- | --- |
| `message` | `string \| null \| undefined` | Texto de error. Falsy → renderiza `null` (absorbe el `{error ? ... : null}`) |
| `className` | `string` (opcional) | Clases extra sobre el View externo (default `mb-4`); `mt-2` para las 2 canchas |
| `icon` | `keyof typeof Ionicons.glyphMap` (opcional, default `alert-circle`) | Icono líder |
| `onDismiss` | `(() => void)` (opcional) | Futuro: botón de cerrar. Sin uso hoy |
| `action` | `{ label: string; onPress: () => void }` (opcional) | Futuro: retry inline. Sin uso hoy |

```tsx
// Canónico (6 sitios):
<ErrorBanner message={error} />
// Las 2 pantallas de cancha (margen superior extra):
<ErrorBanner message={error} className="mt-2" />
```

**Sitios de migración (8):** reemplazar el bloque `{error ? (<View ...>...</View>) : null}`.

- `app/(auth)/login.tsx:80` (bloque 80-85) → `<ErrorBanner message={error} />`.
- `app/(auth)/register.tsx:155` → `<ErrorBanner message={error} />`.
- `app/(auth)/recuperar.tsx:89` → `<ErrorBanner message={error} />`.
- `app/reset.tsx:104` → `<ErrorBanner message={error} />`.
- `app/editar-perfil.tsx:95` → `<ErrorBanner message={error} />`.
- `app/(tabs)/crear.tsx:215` → `<ErrorBanner message={error} />`.
- `app/cancha/editar.tsx:422` → `<ErrorBanner message={error} className="mt-2" />`.
- `app/cancha/registrar.tsx:554` → `<ErrorBanner message={error} className="mt-2" />`.

La verificación dio 0 sitios omitidos (el catálogo es exhaustivo en banners reales) pero marcó
`calificar/[id].tsx:86` como **falso positivo a eliminar** del catálogo (no es banner de error).

**Riesgos:**

- Tokenizar el contenedor (`bg-danger/10 border-danger/30`) es pixel-idéntico en el tema por defecto,
  pero ahora **sí sigue al theme switcher** (en "Blanco" el borde/fondo pasa a `#DC2626`). Es
  consistente con el icono (que ya lo hace), pero es un cambio visible en temas no-default: confirmar.
- El texto pasa a `text-danger` (decisión tomada): se acepta el leve oscurecimiento respecto de
  `text-red-300`; no queda rojo hardcodeado ni se agrega token `--c-danger-soft`. Consistente con §4.
- No plegar el falso positivo de `calificar` ni otros usos de `Colors.danger` dentro de ErrorBanner.
- Revisar imports sin uso tras migrar (`reset.tsx`, `recuperar.tsx` en particular).

---

## 6. StatCard — `components/StatCard.tsx`

**Qué existe hoy:** una tarjeta métrica bordeada hand-rolled **al menos 9 veces** (perfil, panel/finanzas
de cancha, detalle de partido, 3 pantallas admin), con **5 formas visuales** y varios ejes de variación:
tratamiento del icono (ninguno / plano arriba / badge circular / inline con label), alineación
(centrado vs izquierda), posición del label, tipografía/tamaño del valor (text-2xl/3xl/4xl vs texto
chico), hack anti-clipping de la fuente display (`{lineHeight, paddingTop:2}` por tamaño), color del
valor (clase vs `style` dinámico), estado destacado, y slot de CTA/footer (heros de saldo). No hay
componente compartido; `Stat` e `InfoCard` son locales de archivo.

**API propuesta:** `components/StatCard.tsx`, con props suficientes para reproducir cada variante sin
rediseñar. El layout externo (flex-1, márgenes, gap) queda en el padre vía `className`.

| Prop | Tipo | Propósito |
| --- | --- | --- |
| `value` | `string` | Valor primario (número grande o texto de info tile). Requerido |
| `label` | `string` | Label muted. Requerido |
| `icon` | `keyof typeof Ionicons.glyphMap \| undefined` | Icono opcional (omitir en variante sin icono) |
| `iconStyle` | `'plain' \| 'badge' \| 'inline' \| undefined` | `plain`=arriba en su línea; `badge`=disco circular h-9 w-9; `inline`=en la fila del label |
| `tint` | `string \| undefined` | Color del icono. Default `Colors.primary` |
| `valueColor` | `string \| undefined` | Color del valor como string crudo (soporta condicional por signo/destacada). Default `Colors.cream` |
| `size` | `'sm' \| 'md' \| undefined` | Escala del valor: sm=2xl, md=3xl. Aplica el fix lineHeight/paddingTop correcto por tamaño |
| `variant` | `'stat' \| 'info' \| undefined` | `stat`=font-display grande; `info`=font-body-semibold text-sm (info tile de partido) |
| `align` | `'left' \| 'center' \| undefined` | `center` reproduce perfil; default `left` |
| `labelPosition` | `'top' \| 'bottom' \| undefined` | Label arriba o abajo del valor |
| `labelTracking` | `'wide' \| 'wider' \| undefined` | Los dos anchos de tracking en uso |
| `highlight` | `{ color: string } \| undefined` | Estado destacado: borde + tinte de fondo (color+'14') + recolor del valor (admin/index `destacada`) |
| `fitValue` | `boolean \| undefined` | `numberOfLines={1}` + `adjustsFontSizeToFit` (currency largo de admin/index) |
| `onPress` | `(() => void) \| undefined` | Card entera tappable (ningún sitio actual lo usa) |
| `className` | `string \| undefined` | Passthrough de layout del padre (flex-1, mr-3, mt-4) |

```tsx
// Variante A (perfil, centrada):
<StatCard className="flex-1" align="center" labelPosition="bottom" icon="football" value={String(jugados)} label="Partidos" />
// Variante B (panel, sin icono, valor coloreado):
<StatCard className="flex-1 mr-3" size="md" valueColor={Colors.primary} value={String(reservasHoy.length)} label="Reservas de hoy" />
// Variante C (admin, con highlight):
<StatCard icon={t.icon} iconStyle="badge" tint={t.color} value={t.valor} label={t.label} fitValue highlight={t.destacada ? { color: Colors.warning } : undefined} />
// Variante E (info tile de partido):
<StatCard className="flex-1" variant="info" icon="calendar" value={fechaLarga(partido.fecha)} label="Fecha" />
```

**Sitios de migración (6 code-sites; incluyen sus call-sites hermanos):**

- `app/(tabs)/perfil.tsx:201` (borrar `Stat` local) + call-sites `:103`, **`:104`, `:105`**. El
  `tone==='danger'` (hoy `text-red-400`) pasa a `valueColor={Colors.danger}` (decisión tomada, consistente con §4/§5).
- `app/partido/[id].tsx:291` (borrar `InfoCard` local) + call-sites **`:136`, `:137`**.
- `app/cancha/panel.tsx:170` (par Reservas/Ocupación, incluye el hermano **`:176`**).
- `app/admin/index.tsx:110` (card dentro del `tarjetas.map`; conservar FadeIn + flexBasis fuera).
- `app/admin/pagos.tsx:125` (par Mostrados/Aprobado, incluye el hermano **`:129`**).
- `app/admin/canchas.tsx:379` (saldo del modal; `valueColor` condicional por signo).

Los 2 "hero saldo" (`app/cancha/panel.tsx:150` y `app/cancha/finanzas.tsx:219`) **NO se migran a StatCard**
(decisión tomada): llevan CTA + footer + icono inline y quedan como **composición a medida**. StatCard se
acota a stats (A/B/C) + info tile (E).

Los 6 "missed" de la verificación (`pagos:129`, `panel:176`, `perfil:104`, `perfil:105`, `partido:136`,
`partido:137`) son **call-sites/usos hermanos** dentro de esas mismas pantallas ya listadas: se
absorben en el mismo trabajo, no son pantallas nuevas.

**Riesgos:**

- **Sobre-abstracción (resuelto):** los 2 "hero saldo" (panel, finanzas) llevan CTA + footer + icono
  inline y son los menos "card"; por eso quedan **fuera de StatCard** (composición a medida). StatCard se
  acota a stats A/B/C + info tile E, sin props `action`/`footer`/`emphasis='hero'`.
- **Fix de clipping:** los valores `{lineHeight, paddingTop:2}` difieren por tamaño (30@2xl, 38@3xl)
  y son load-bearing; `StatCard` debe hornear el mapeo exacto por `size` (`sm`/`md`).
- `valueColor` debe aceptar **string crudo** (los admin pasan `Colors.*` computado en runtime), no un
  enum de tokens. Estandarizar el color del valor vía `style`, no clase.
- `tone==='danger'` en perfil hoy es `text-red-400`, **no** `Colors.danger`: se migra a
  `valueColor={Colors.danger}` (decisión tomada). Cambio de color mínimo pero intencional, consistente con §4/§5.
- Parity fino del label (uppercase vs no, tracking-wide/wider, text-xs vs text-[10px], font-body vs
  font-body-semibold, arriba vs abajo): un default lossy mueve varias pantallas a la vez.
- `StatCard` **no** debe poseer márgenes/flex externos ni envolverse en `FadeIn` (rompería stagger y grid).
- Sin test suite: migrar **pantalla por pantalla** con diff visual manual, no en un barrido.

---

## 7. BackButton (+ ScreenHeader) — `components/BackButton.tsx`

**Qué existe hoy:** cada pantalla implementa su propio Pressable de "volver" (+ título inline).
Copy-pasteado en ~28 archivos con divergencias reales: radio (`rounded-full` vs `rounded-sm`), fondo
(`bg-card` vs `bg-black/30` sobre imagen), icono (`chevron-back` vs `chevron-down` vs `close`), color
(`Colors.cream` estático vs `theme.cream` runtime), margen (`mr-3`/`mr-2`/ninguno), tamaño de título
(3xl/2xl/xl/sin título), y slots extra (share a la derecha, avatar+subtítulo del chat). No hay
componente compartido. La verificación lo dio **`complete: true`, 0 sitios omitidos** (29 entradas
cubren todos los back-buttons de header; excluye correctamente los `router.back()` dentro de Alerts,
GlowButtons de cuerpo, estados vacíos y el `chevron-down` de dropdown de `DateTimeField`).

**API propuesta:** `BackButton` (el Pressable circular) + `ScreenHeader` opcional (BackButton + título
con anti-clipping por tamaño + slots `right`/`children` para headers compuestos).

| Prop | Tipo | Propósito |
| --- | --- | --- |
| `onPress` | `() => void` | Default `router.back()`. Override para el wizard de registrar |
| `icon` | `'chevron-back' \| 'chevron-down' \| 'close'` | Default `chevron-back` (checkout=down, crear-post=close) |
| `variant` | `'card' \| 'overlay'` | `card`=bg-card; `overlay`=bg-black/30 (hero de partido) |
| `color` | `string` (opcional) | Override del color del icono. Default reactivo `useTheme().cream` |
| `size` | `number` | Default 22 |
| `className` | `string` | Margen/posición (`mr-3`/`mr-2`/ninguno) |
| `hitSlop` | `number` | Default 12 |
| `(ScreenHeader) title` | `string` | Si se omite, header solo-botón |
| `(ScreenHeader) titleSize` | `'xl' \| '2xl' \| '3xl'` | Default `3xl`; aplica lineHeight/paddingTop correcto por tamaño |
| `(ScreenHeader) right` | `ReactNode` | Slot derecho (share de partido); activa justify-between |
| `(ScreenHeader) children` | `ReactNode` | Contenido custom (badge+título+subtítulo del chat) |
| `(ScreenHeader) borderBottom` | `boolean` | Añade `border-b border-border` (chat, post) |
| `(ScreenHeader) backIcon/backVariant/onBack/showBack` | passthrough | Reenvía a BackButton (checkout `chevron-down` condicional) |

```tsx
// Estándar (~18 sitios):
<ScreenHeader title="Finanzas" />
// Cancha detalle (título 2xl):
<ScreenHeader title="Cancha" titleSize="2xl" />
// Checkout (cerrar con chevron-down, condicional al paso):
<ScreenHeader title={paso === 'listo' ? 'Comprobante' : 'Pagar cupo'} titleSize="2xl" backIcon="chevron-down" showBack={paso === 'metodo'} />
// Partido sobre el hero (overlay + share): BackButton suelto en fila justify-between
<BackButton variant="overlay" />
// Wizard (onPress custom):
<BackButton onPress={() => (paso > 1 ? atras() : router.back())} />
// Apariencia (unificado al estándar: rounded-full + color reactivo por default):
<BackButton className="mr-3" />
```

**Sitios de migración (28):** estándar → `<ScreenHeader title="...">`:
`canchas:50`, `mis-reservas:77`, `mis-pagos:22`, `mis-partidos:22`, `editar-perfil:55`, `calificar:50`,
`(auth)/register:80`, `cancha/editar:234`, `cancha/agenda:83`, `cancha/finanzas:189`,
`cancha/[id]/reservar:152`, `admin/index:79`, `admin/canchas:221`, `admin/reportes:83`,
`admin/reservas:68`, `admin/pagos:71`, `admin/retiros:189`, `admin/usuarios:75`.
Con variación de título: `cancha/[id]/index:38` (`titleSize="2xl"`).
Solo-botón (sin título): `(auth)/recuperar:42`, `(auth)/login:39` → `<BackButton />`.
Casos especiales:
- `cancha/registrar:227` → `<BackButton onPress={() => (paso > 1 ? atras() : router.back())} />` (conservar barra de progreso).
- `apariencia:27` → `<BackButton className="mr-3" />` (**unificado al estándar**: `rounded-full` + color reactivo `c.cream` por default; se abandona el outlier `rounded-sm`/`theme.cream`). Único cambio visual intencional de la fase.
- `checkout/[id]:91` → `<ScreenHeader ... backIcon="chevron-down" showBack={paso==='metodo'} />` (manejar el placeholder `h-10 w-10` dentro).
- `crear-post:62` → `<ScreenHeader title="Nuevo post" titleSize="xl" backIcon="close" titleAlign="center" />`.
- `partido/[id]:106` → `<BackButton variant="overlay" />` dentro de la fila justify-between (share como está o vía prop `right`).
- `chat/[id]:54` → `<BackButton className="mr-2" />` dentro del header compuesto (NO ScreenHeader rígido).
- `post/[id]:72` → `<ScreenHeader title="Publicación" titleSize="xl" borderBottom backClassName="mr-2" />` y en el estado de carga (`:39`) `<BackButton />`.

**Riesgos:**

- `apariencia.tsx` era el único `rounded-sm` y usaba `theme.cream`: se **unifica al estándar** (decisión
  tomada) - `rounded-full` + color reactivo `c.cream` por default (BackButton llama `useTheme()`). Cambio
  visual chico e intencional (`rounded-sm → rounded-full`); es el único de la fase.
- `partido/[id]` requiere `overlay` (va sobre foto); forzar `bg-card` lo haría ilegible.
- El clipping de la fuente display se mitiga hoy con `{lineHeight:40,paddingTop:2}` **inconsistentemente**
  (unos títulos sí, otros no). `ScreenHeader` debe aplicar el valor correcto por `titleSize`.
- `checkout` renderiza el botón condicional con un placeholder `<View h-10 w-10>`: replicarlo cuando
  `showBack=false` o el título salta.
- Headers compuestos (chat, partido) necesitan `children`/`right`; no forzarlos a un layout rígido.
- `cancha/registrar` no siempre hace `router.back` (retrocede paso): el override de `onPress` es obligatorio.
- `close`/`chevron-down` codifican "cerrar modal" vs "volver": mantener la prop `icon`.

---

## 8. UrgencyPill — `components/UrgencyPill.tsx`

**Qué existe hoy:** la píldora/franja de urgencia de cupos ("¡Falta 1!" / "Faltan N" / "Cupo lleno")
duplicada en **3 sitios** con lógica idéntica (`faltan = totales - ocupados`; `lleno = faltan<=0`;
`urgente = faltan===1`; `color = urgente ? accent : primary`) pero 3 tratamientos visuales y copy
divergente: (a) relleno sólido con texto `ink` (GameCard, UrgentCard) vs tinte `color+'22'` con texto
del color pleno (partido); (b) franja full-width vs pill `rounded-full`; (c) copy "¡Falta 1, parce!"
(GameCard) vs "¡Falta 1!" (los otros); (d) estado lleno presente en GameCard/partido, ausente en
UrgentCard (pre-filtra faltan>0); (e) tamaños. GameCard y partido leen el proxy `Colors`; UrgentCard usa
`useTheme()`.

**API propuesta:** `components/UrgencyPill.tsx` que deriva el estado internamente y calcula colores vía
`useTheme()`, con props para las 3 variantes. Exportar además una función pura `urgencyLabel(faltan, {urgentLabel, fullLabel})`
reutilizable por Share/preview para no dejar copy inconsistente.

| Prop | Tipo | Propósito |
| --- | --- | --- |
| `faltan` | `number` | Cupos restantes. Deriva `lleno=faltan<=0`, `urgente=faltan===1` |
| `tone` | `'solid' \| 'tint'` | `solid`=bg color pleno, fg ink; `tint`=bg color+'22', fg color pleno. Default `solid` |
| `shape` | `'strip' \| 'pill'` | `strip`=sin radio propio (franja en card); `pill`=rounded-full self-sized. Default `pill` |
| `size` | `'sm' \| 'md'` | `md`=icono13/text-xs/tracking-wider/px-4 py-2; `sm`=icono12/px chico. Default `sm` |
| `urgentLabel` | `string` | Copy de faltan===1. Default `¡Falta 1!`; GameCard pasa `¡Falta 1, parce!` |
| `fullLabel` | `string` | Copy de lleno. Default `Cupo lleno` |
| `showFull` | `boolean` | Si false, no renderiza lleno (UrgentCard). Default true |
| `trailing` | `React.ReactNode` | Contenido a la derecha compartiendo el fondo (el `partido.formato` de GameCard) |
| `fill` | `boolean` | Estira a lo ancho con justify-between (franja). Default true cuando `shape==='strip'` |
| `className` | `string` | Passthrough de layout |

```tsx
// GameCard (franja sólida con formato a la derecha):
<UrgencyPill faltan={faltan} tone="solid" shape="strip" size="md" fill urgentLabel="¡Falta 1, parce!"
  trailing={<Text className="font-body-bold text-xs uppercase" style={{ color: lleno ? Colors.muted : Colors.ink }}>{partido.formato}</Text>} />
// UrgentCard (mini franja sólida, sin lleno):
<UrgencyPill faltan={faltan} tone="solid" shape="strip" size="sm" fill showFull={false} />
// partido/[id] (pill tintada self-sized):
<UrgencyPill faltan={faltan} tone="tint" shape="pill" size="sm" />
```

**Sitios de migración (3):**

- `components/GameCard.tsx:60` (bloque L60-80) → `tone="solid" shape="strip" size="md" fill urgentLabel="¡Falta 1, parce!"` con `trailing` para `partido.formato` (el color del formato sigue la regla ink/muted; documentar que no cambia).
- `app/(tabs)/index.tsx:162` (UrgentCard, L162-167) → `tone="solid" shape="strip" size="sm" fill showFull={false}` (mantiene icono `flame` y copy `¡Falta 1!` por default).
- `app/partido/[id].tsx:146` (L146-151) → `tone="tint" shape="pill" size="sm"`. Conservar `lleno` (L47) para ProgressBar/CTA del resto de la pantalla.

**Copy compartido (en alcance, decisión tomada):** además de los 3 pill, se **extrae la función pura
`urgencyLabel(faltan, { urgentLabel, fullLabel })`** y se enrutan por ella los espejos de copy que hoy
duplican el wording, para que no se desincronicen:

- `app/apariencia.tsx:41` - texto estático de "Vista previa" que hardcodea `¡Falta 1, parce! 🔥`.
- `app/partido/[id].tsx:69` - el Share del partido.
- `lib/mockData.ts cuposFaltantes()` - hoy emite `Lleno`/`Falta 1` (sin signos); se alinea vía `urgencyLabel()`.

**Riesgos:**

- Divergencia de copy: GameCard **debe** pasar `urgentLabel="¡Falta 1, parce!"` o se cambia el texto visible.
- El slot `trailing`+`fill` de GameCard (formato compartiendo el fondo de la franja, incluido su color
  ink/muted) es lo más delicado de reproducir 1:1.
- Dos tratamientos de color opuestos (solid=texto ink vs tint=texto color pleno) y el estado lleno con
  bg distinto por variante: un mapeo mal unificado altera sutilmente alguno de los 3.
- Unificar en `useTheme()` añade re-render al cambiar de tema (mejora, pero cambio de comportamiento a validar).
- Regresión visual silenciosa en las 3 pantallas más visibles (home feed, strip "Cierran ya", detalle):
  sin snapshots, la verificación es visual + lint + export.

---

## 9. Theming reactivo — migrar `Colors` estático a `useTheme()`

**Qué existe hoy:** `Colors` (`constants/colors.ts`) es un **Proxy estático**: lee el palette del tema
activo en el momento de la lectura pero **no está suscrito a zustand**, así que un componente que lo usa
NO se re-renderiza al cambiar de tema (solo se sincroniza tras un re-render provocado por otra cosa). Las
clases NativeWind (`bg-primary`, `text-cream`) **sí** son reactivas (CSS vars). El problema es solo el
color en JS: `color=` de Ionicons/ActivityIndicator, estilos inline (`backgroundColor`/`borderColor`/`shadowColor`),
`colors=` de LinearGradient, `tintColor`/`colors` de RefreshControl, `placeholderTextColor`,
`thumbColor`/`trackColor` de Switch. Alcance: ~50 archivos, ~200 sitios.

Tres patrones + dos casos especiales:

- **Cat A** - uso directo en el render (mayoría, mecánico). Fix: `const c = useTheme()` al tope, `Colors.X → c.X`.
- **Cat B** - mapa/objeto const a **nivel de módulo** que lee `Colors.X` (`ROL_CHIP`, `TIPO`,
  `ESTADO_COLOR`, `RETIRO_ESTADO`). Se evalúa **una vez al importar** y **congela el tema por defecto
  (esmeralda)**: además de no-reactivo, es un **bug** (chips/estados muestran siempre emerald aunque el
  tema sea azul/rojo). Fix: factory `(c: Palette) => ({...})` invocada dentro del componente.
- **Cat C** - función helper de módulo (`estadoColor()`, `color()`) que lee `Colors` en su cuerpo. No
  congela, pero no es reactiva ni puede llamar hooks. Fix: firma `(valor, c: Palette)`.
- **Cat D** - default param que usa `Colors` como fallback (`ModeracionBoton color=Colors.muted`, `Stat tint=Colors.primary`).
  Fix: quitar el default y resolver en el cuerpo (`color ?? c.muted`).
- **Cat E (NO migrar):** `lib/store.ts` (llama `setActiveColors`, maneja el proxy fuera de React) y
  `constants/colors.ts` (definición del proxy). Se mantienen.

**API propuesta:** no hay API nueva. `useTheme()` (`lib/theme.ts`) ya devuelve la `Palette` suscrita a
`s.temaId`; devuelve exactamente lo mismo que resuelve el proxy, solo que **suscribe** al componente. El
refactor estandariza `const c = useTheme()` + patrón factory para Cat B/C. Referencia del patrón correcto
ya en uso: `GlowButton.tsx`, `EmptyState.tsx`, `Screen.tsx`, `Skeleton.tsx`, `(tabs)/index.tsx`,
`(tabs)/_layout.tsx`, `apariencia.tsx`.

```ts
// Cat B: import type { Palette } from '@/constants/themes';
const ESTADO_COLOR = (c: Palette) => ({ pendiente: c.warning, confirmada: c.primary, completada: c.accent, cancelada: c.danger });
function Agenda() { const c = useTheme(); const map = ESTADO_COLOR(c); return <View style={{ backgroundColor: map[estado] }} />; }
// Cat C: function estadoColor(estado: string, c: Palette) { if (estado === 'confirmada') return c.primary; ... }
// Cat D: function ModeracionBoton({ color }) { const c = useTheme(); const col = color ?? c.muted; ... }
```

**Sitios de migración (~48 archivos; ver el catálogo para la lista de líneas por archivo).** Batches sugeridos:

- **Componentes compartidos primero** (Cat A salvo nota): `Field.tsx`, `GameCard.tsx`, `PostCard.tsx`,
  `AmenidadPicker.tsx`, `DateTimeField.tsx`, `StarRating.tsx`, `ProgressBar.tsx`, `AdminGate.tsx`,
  `UbicacionPicker.tsx` **+ `.web`**, `CanchaMap.tsx` **+ `.web`**, `ModeracionBoton.tsx` (Cat D).
- **Pantallas Cat A:** `app/_layout.tsx`, `(auth)/_layout.tsx`, `(auth)/welcome/register/login/recuperar`,
  `reset.tsx`, `editar-perfil.tsx`, `crear-post.tsx`, `mis-pagos.tsx`, `canchas.tsx`, `post/[id].tsx`,
  `mis-partidos.tsx`, `chat/[id].tsx`, `admin/index.tsx`, `admin/canchas.tsx`, `(tabs)/buscar/crear/muro`,
  `checkout/[id].tsx`, `partido/[id].tsx`, `cancha/[id]/reservar`, `cancha/[id]/index`, `cancha/editar`,
  `cancha/registrar`.
- **Cat B (arreglan el tema congelado):** `admin/usuarios.tsx` (`ROL_CHIP`), `admin/reportes.tsx` (`TIPO`),
  `admin/retiros.tsx` (`ESTADO`), `cancha/agenda.tsx` / `cancha/panel.tsx` (`ESTADO_COLOR`),
  `cancha/finanzas.tsx` (`RETIRO_ESTADO`).
- **Cat C:** `mis-reservas.tsx`, `admin/pagos.tsx`, `admin/reservas.tsx`.
- **Cat D (además de Cat A):** `(tabs)/perfil.tsx` (`Stat tint`).
- **NO migrar:** `lib/store.ts`, `constants/colors.ts`.

**Missed de la verificación (8):** 7 son archivos que **ya usan** `useTheme()`/`useThemeMeta`
correctamente (`Skeleton`, `EmptyState`, `GlowButton`, `Screen`, `apariencia`, `(tabs)/_layout`,
`(tabs)/index`): son **referencia del patrón, no trabajo nuevo**. El octavo, `app/calificar/[id].tsx`, es
una **omisión real**: usa `Colors` estático (import L13; usos en L51/87/93/94) y debe migrarse (Cat A). El
catálogo lo saltó; **se incluye en este lote** (decisión tomada).

**Riesgos:**

- Reglas de hooks: `useTheme()` NO puede llamarse en mapas/funciones de módulo (Cat B/C); DEBEN pasar a
  factory/firma con palette. Olvidar uno deja el bug o rompe el orden de hooks.
- Los Cat B son bugs reales: al migrar, sus chips/badges **cambiarán** de color al cambiar de tema.
  Verificar que con el tema por defecto (esmeralda) el resultado sea idéntico al actual.
- Re-render adicional por suscripción a `s.temaId` (selector primitivo, impacto mínimo). En FlatLists
  grandes (GameCard/PostCard) verificar rendimiento y que no se pierda el scroll al cambiar de tema.
- Sub-componentes anidados (`chat` burbuja, `perfil` Stat, `checkout` Badge): agregar `useTheme` dentro
  del sub-componente o pasar `c` como prop.
- Variantes platform-split (`CanchaMap`, `UbicacionPicker`): migrar **ambas** (native + web).
- No tocar `lib/store.ts` ni `constants/colors.ts` (romperían consumidores no-React y el fallback).
- Web build: `useTheme` depende de zustand (`import.meta`, resuelto por babel-preset-expo en SDK 57);
  correr `expo export --platform web` tras la migración.
- Volumen: migrar por lotes para acotar el diff.

---

## 10. Orden de implementación sugerido

Agrupado en commits lógicos, de menor a mayor dependencia:

1. **Tokens sin dependencias** (aislados, no cambian UI):
   - Commit A: `constants/motion.ts` + migrar sus 9 call-sites + limpiar imports `Easing` sin uso.
   - Commit B: `lib/haptics.ts` + migrar los 10 call-sites + swap de imports.
   - Commit C: reconciliar `danger`/`warning` **config primero** (`tailwind.config.js`, `buildVars`,
     `global.css`), verificar, y luego migrar las clases `red-*` → token (Badge + banners + perfil + calificar).
2. **Primitivas nuevas** (crear + adoptar, pantalla por pantalla con diff visual):
   - Commit D: `ErrorBanner` + adoptar en los 8 formularios (idealmente junto/después del Commit C,
     porque el banner usa el token `danger`).
   - Commit E: `StatCard` + adoptar en los 6 code-sites (los 2 hero saldo quedan a medida).
   - Commit F: `BackButton` (+ `ScreenHeader`) + adoptar en los ~28 sitios.
   - Commit G: `UrgencyPill` (+ `urgencyLabel()`) + adoptar en los 3 sitios.
3. **Theming reactivo** (batches del §9): componentes compartidos → pantallas Cat A → Cat B/C/D. Se puede
   solapar con las primitivas nuevas (que ya nacen con `useTheme()`), pero conviene un batch dedicado para
   los ~48 archivos restantes.
4. **Cierre opcional:** guard de ESLint (ver "Fuera de alcance").

Motion, haptics y danger/warning (paso 1) no dependen de nada y se pueden hacer en paralelo. Las
primitivas (paso 2) idealmente nacen ya reactivas para no re-tocarlas en el paso 3.

---

## 11. Fuera de alcance (Fase 3 / mini-fases)

- **Barrido de radios** (`rounded-2xl/3xl` → `sm/md/lg`) y de **hex hardcodeados por pantalla** → **Fase 3
  (auditoría)**. Requiere recorrer las 40+ pantallas contra el checklist y rankear por impacto; no es
  drop-in.
- **Sistema tipográfico compartido** (`Text`/`Heading` + fix de ascendentes de Anton, hoy repetido como
  `{lineHeight, paddingTop}` inline) → **mini-fase propia post-auditoría**. `StatCard`/`ScreenHeader`
  encapsulan el fix *dentro* de esos componentes, pero un primitivo tipográfico transversal se difiere.
- **Cablear `haptics.warn()`/`error()`** en los catch de checkout/crear/crear-post → **feature addition**,
  no migración pura (decisión tomada: diferido). Los verbos se **crean** en Fase 2; el cableado se hace después.
- **Guard de ESLint** (prohibir `import { Colors }` en `app/`+`components/`, o clases `red-*` crudas) →
  **diferido** (decisión tomada): NO se hace en Fase 2. Queda como opcional para después; solo tiene sentido
  una vez migrados todos los call-sites, para no romper el lint en medio del refactor.
- Variantes evaluadas y **descartadas** (ver §13): merge de `Duration.fast`/`fastCard`, token
  `--c-danger-soft`, heros de saldo dentro de `StatCard`, y el outlier `rounded-sm` de apariencia.

---

## 12. Verificación

No hay test suite en el repo. **El único cambio visual intencional de toda la fase es el back button de
`apariencia.tsx` (`rounded-sm → rounded-full`); todo lo demás debe verse idéntico en el tema esmeralda.**
La verificación de Fase 2 es:

- **`pnpm lint`** (único check automatizado): sin errores, en particular sin imports sin uso tras los swaps
  (`Easing`, `expo-haptics`, `Colors`).
- **`pnpm exec expo export --platform web`**: build exitoso (el Dockerfile parse-checkea el bundle; motion,
  haptics y `useTheme`/zustand deben seguir bundleando).
- **Prueba manual de temas:** entrar a `apariencia.tsx` y **alternar los 7 temas (incluido "Blanco")**
  confirmando:
  - Que en el tema por defecto (esmeralda) **nada cambió** de look (motion, banners, stats, headers, píldoras),
    salvo el back button de `apariencia.tsx` (`rounded-sm → rounded-full`, único cambio intencional).
  - Que ahora el UI JS **responde en vivo** al cambio de tema (los Cat B ya no quedan congelados en emerald;
    banners/badges danger/warning siguen al tema; iconos/bordes/switches cambian sin re-navegar).
  - En "Blanco" específicamente: revisar banners de error y badges (es el único tema donde el pixel de las
    clases `danger`/`warning` cambia, a `#DC2626`/`#D97706`).
- **Diff visual pantalla por pantalla** en las adopciones de `StatCard`, `BackButton`/`ScreenHeader` y
  `UrgencyPill` (las 3 pantallas de píldora - home feed, strip "Cierran ya", detalle - son las más visibles).
- **Feel de motion/haptics:** verificar en dispositivo que press de botón/card, likes, splash, shimmer y
  spinner se sienten idénticos (invariante 1:1).

---

## 13. Decisiones tomadas

Las 10 decisiones del dueño, ya bakeadas en las secciones anteriores:

1. **Motion - `fast`/`fastCard`:** se mantienen **separados** (120 y 130 ms); no se unifican (cero cambio de feel).
2. **Haptics - `warn()`/`error()`:** se **crean** los verbos pero **NO se cablean** en los catch en Fase 2.
3-4. **Danger/warning + ErrorBanner:** se **acepta** el leve oscurecimiento; `text-red-300/400 → text-danger` en todo (banners, Badge, perfil). **Sin** token `--c-danger-soft`.
5. **StatCard - alcance:** se **acota** a stats A/B/C + info tile E. Los 2 "hero saldo" (`cancha/panel:150`, `cancha/finanzas:219`) quedan como **composición a medida** (sin props `action`/`footer`/`emphasis='hero'`).
6. **StatCard - `tone='danger'` de perfil:** se **unifica** a `valueColor={Colors.danger}` (consistente con 3-4).
7. **Headers:** se entrega `ScreenHeader` + `BackButton` y se **unifica** `apariencia.tsx` al estándar (`rounded-full` + color reactivo `c.cream`); se elimina la prop `radius`. Único cambio visual intencional de la fase.
8. **UrgencyPill - copy:** se **extrae** `urgencyLabel()` y se conectan los espejos (`apariencia:41`, Share `partido/[id]:69`, `mockData.cuposFaltantes()`). En alcance.
9. **Reactive-theming - `calificar`:** `app/calificar/[id].tsx` **se incluye** en el mismo lote (Cat A).
10. **Guard de ESLint:** **diferido** (no se hace en Fase 2; queda opcional para después).
