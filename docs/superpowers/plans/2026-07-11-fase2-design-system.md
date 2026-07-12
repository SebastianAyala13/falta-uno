# Fase 2 - Reforzar el design system - Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir en fundación compartida (tokens + primitivas + theming reactivo) los patrones hoy copy-pasteados y divergentes, sin cambiar el look&feel.

**Architecture:** Refactor interno drop-in sobre Expo/React Native + NativeWind. Se crean 4 módulos de tokens/util (`constants/motion.ts`, `lib/haptics.ts`, reconciliación `danger`/`warning`, `urgencyLabel()`) y 4 primitivas (`ErrorBanner`, `StatCard`, `BackButton`+`ScreenHeader`, `UrgencyPill`), y se migran sus call-sites. Aparte, se migran los componentes/pantallas del proxy estático `Colors` al hook reactivo `useTheme()`.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, NativeWind 4 (Tailwind 3.4), react-native-reanimated ~4.5, expo-haptics, zustand, Ionicons.

**Spec:** `docs/superpowers/specs/2026-07-11-fase2-design-system-design.md`. **Estándar:** `docs/DESIGN.md`.

## Global Constraints

- **Gestor de paquetes:** `pnpm` (NO npm). Node >= 22. Comandos vía `pnpm ...`.
- **No hay test suite.** La verificación de CADA task es: `pnpm lint` (sin errores ni imports sin uso) + para tasks de tokens/theming también `pnpm exec expo export --platform web` (build OK) + **prueba manual de temas** (alternar los 7 temas en `apariencia.tsx`, incluido "Blanco").
- **Invariante 1:1 (motion + haptics):** cada token/verbo mapea byte-idéntico al valor/llamada actual. NO normalizar `GameCard.select()` a `tap()`. Mantener `Duration.fast` (120) y `Duration.fastCard` (130) separados.
- **Tokens, no hex:** colores vía clases NativeWind o `useTheme()`. En componentes usar `useTheme()`, NUNCA el proxy estático `Colors` (salvo `lib/store.ts` y `constants/colors.ts`, que NO se tocan).
- **Radios:** los componentes nuevos usan la escala `rounded-sm/md/lg/full`. (El barrido de radios por pantalla es Fase 3, fuera de alcance.)
- **Copy sin em-dash** (`—`) en texto visible de la app; guion normal `-`.
- **Único cambio visual intencional de la fase:** el back button de `apariencia.tsx` pasa de `rounded-sm` a `rounded-full`. Todo lo demás debe verse idéntico en el tema esmeralda.
- **Web gotcha:** nunca `import 'react-native-maps'` en `app/`; usar `@/components/CanchaMap`. Migrar SIEMPRE ambas variantes de los platform-split (`CanchaMap` + `.web`, `UbicacionPicker` + `.web`).
- **Commits:** mensaje con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **No push** hasta que el dueño lo pida.
- **Método de extracción (primitivas):** para garantizar el 1:1, construir cada componente **levantando el JSX/clases exactas de la instancia de referencia** citada, y luego parametrizar las variaciones. No re-inventar el markup.

---

### Task 1: Motion tokens - `constants/motion.ts`

**Files:**
- Create: `constants/motion.ts`
- Modify: `components/FadeIn.tsx:26`, `components/GlowButton.tsx:50-51`, `components/GameCard.tsx:32-33`, `components/Skeleton.tsx:12`, `app/index.tsx:29-30`, `app/checkout/[id].tsx:173`

**Interfaces:**
- Produces: `Duration` (`{ instant:90, fast:120, fastCard:130, base:460, slow:600, shimmer:800, spin:900, grand:1100 }`) y `MotionEasing` (`{ entrance, pulse, linear }`).

- [ ] **Step 1: Crear `constants/motion.ts`** (valores byte-idénticos a los actuales)

```ts
/**
 * Tokens de motion. Los valores son EXACTAMENTE los que hoy están inline en cada
 * call-site (ver docs/DESIGN.md §5). Migrar a estos tokens no cambia el feel.
 * El proyecto no usa withSpring; solo withTiming/withRepeat/withDelay.
 */
import { Easing } from 'react-native-reanimated';

export const Duration = {
  instant: 90,   // press-in tap (GlowButton, GameCard)
  fast: 120,     // press-out GlowButton
  fastCard: 130, // press-out GameCard (distinto de fast a propósito: preserva el feel)
  base: 460,     // entrada de contenido (FadeIn)
  slow: 600,     // fade del splash
  shimmer: 800,  // medio ciclo del shimmer (Skeleton)
  spin: 900,     // una vuelta del spinner (checkout)
  grand: 1100,   // escala del splash (mantener el setTimeout(1150) en sync)
} as const;

export const MotionEasing = {
  entrance: Easing.out(Easing.cubic),  // entrada desacelerada
  pulse: Easing.inOut(Easing.quad),    // ping-pong del shimmer
  linear: Easing.linear,               // rotación constante
} as const;
```

- [ ] **Step 2: Migrar los 9 call-sites** (reemplazo de números por tokens; el press-feedback queda SIN easing)

- `components/FadeIn.tsx:26` → `withDelay(delay, withTiming(1, { duration: Duration.base, easing: MotionEasing.entrance }))`.
- `components/GlowButton.tsx:50` → `withTiming(0.96, { duration: Duration.instant })` (sin easing).
- `components/GlowButton.tsx:51` → `withTiming(1, { duration: Duration.fast })` (sin easing).
- `components/GameCard.tsx:32` → `withTiming(0.975, { duration: Duration.instant })` (sin easing).
- `components/GameCard.tsx:33` → `withTiming(1, { duration: Duration.fastCard })` (sin easing; NO usar `fast`).
- `components/Skeleton.tsx:12` → `withRepeat(withTiming(1, { duration: Duration.shimmer, easing: MotionEasing.pulse }), -1, true)`.
- `app/index.tsx:29` → `withTiming(1, { duration: Duration.slow, easing: MotionEasing.entrance })`.
- `app/index.tsx:30` → `withTiming(1, { duration: Duration.grand, easing: MotionEasing.entrance })`. Dejar el `setTimeout(..., 1150)` de la línea 31 como está (o comentarlo como `Duration.grand + 50`).
- `app/checkout/[id].tsx:173` → `withRepeat(withTiming(1, { duration: Duration.spin, easing: MotionEasing.linear }), -1)`.

En cada archivo: agregar `import { Duration, MotionEasing } from '@/constants/motion';`. Quitar el `import { Easing } from 'react-native-reanimated'` si queda sin uso (FadeIn, Skeleton, index, checkout).

- [ ] **Step 3: Verificar** — `pnpm lint` (sin errores, sin `Easing` sin uso). Luego correr la app (o `expo export`) y confirmar en dispositivo/emulador que press de botón/card, splash, shimmer y spinner se sienten idénticos.

- [ ] **Step 4: Commit**

```bash
git add constants/motion.ts components/FadeIn.tsx components/GlowButton.tsx components/GameCard.tsx components/Skeleton.tsx app/index.tsx "app/checkout/[id].tsx"
git commit -m "refactor(motion): centralizar timings/easing en constants/motion.ts"
```

---

### Task 2: Haptics vocabulary - `lib/haptics.ts`

**Files:**
- Create: `lib/haptics.ts`
- Modify: `components/GlowButton.tsx:53`, `app/post/[id].tsx:64`, `components/PostCard.tsx:39`, `app/apariencia.tsx:19`, `components/StarRating.tsx:24`, `components/GameCard.tsx:35`, `app/(tabs)/crear.tsx:84`, `app/checkout/[id].tsx:76`, `app/crear-post.tsx:50`, `app/calificar/[id].tsx:41`

**Interfaces:**
- Produces: `haptics` con `{ tap, light, select, success, warn, error }` (cada uno `() => void`).

- [ ] **Step 1: Crear `lib/haptics.ts`** (mapea 1:1 a las llamadas actuales)

```ts
/**
 * Vocabulario háptico. Cada verbo envuelve exactamente una llamada de expo-haptics
 * (ver docs/DESIGN.md §6). Fire-and-forget con .catch no-op: en web expo-haptics es
 * no-op y así no genera unhandled rejections.
 */
import * as Haptics from 'expo-haptics';

const run = (p: Promise<unknown>) => {
  p.catch(() => {});
};

export const haptics = {
  tap: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),   // CTA primario
  light: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),  // like/toggle sutil
  select: () => run(Haptics.selectionAsync()),                               // cambio de valor / tick
  success: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),  // reservado, sin cablear
  error: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),   // reservado, sin cablear
};
```

- [ ] **Step 2: Migrar los 10 call-sites.** En cada archivo, reemplazar la llamada y cambiar `import * as Haptics from 'expo-haptics'` por `import { haptics } from '@/lib/haptics'`.

- `components/GlowButton.tsx:53` → `if (haptic) haptics.tap();` (conservar el gate `if (haptic)`).
- `app/post/[id].tsx:64` → `haptics.light()`.
- `components/PostCard.tsx:39` → `haptics.light()`.
- `app/apariencia.tsx:19` → `haptics.select()`.
- `components/StarRating.tsx:24` → `haptics.select()`.
- `components/GameCard.tsx:35` → `haptics.select()` (NO subir a `tap()`).
- `app/(tabs)/crear.tsx:84` → `haptics.success()`.
- `app/checkout/[id].tsx:76` → `haptics.success()`. (NO cablear `warn()` en el catch: diferido.)
- `app/crear-post.tsx:50` → `haptics.success()`.
- `app/calificar/[id].tsx:41` → `haptics.success()`.

- [ ] **Step 3: Verificar** — `pnpm lint` (sin `import * as Haptics` sin uso en los 10 archivos). Probar en dispositivo que los hápticos se sienten igual.

- [ ] **Step 4: Commit**

```bash
git add lib/haptics.ts components/GlowButton.tsx "app/post/[id].tsx" components/PostCard.tsx app/apariencia.tsx components/StarRating.tsx components/GameCard.tsx "app/(tabs)/crear.tsx" "app/checkout/[id].tsx" app/crear-post.tsx "app/calificar/[id].tsx"
git commit -m "refactor(haptics): vocabulario centralizado en lib/haptics.ts"
```

---

### Task 3: Reconciliar danger/warning a una sola fuente por-tema

**Files:**
- Modify: `constants/themes.ts` (`buildVars`, ~línea 152), `global.css` (`:root`, ~línea 18), `tailwind.config.js:29-30`
- Modify (clases crudas → token): `components/Badge.tsx:14`, `app/(tabs)/perfil.tsx:217`, `app/calificar/[id].tsx:86`, y los banners de `login`/`register`/`recuperar`/`reset`/`(tabs)/crear`/`editar-perfil`/`cancha/registrar`/`cancha/editar` (ver Task 4 para reemplazarlos por `ErrorBanner`).

**Interfaces:**
- Produces: variables CSS `--c-danger` / `--c-warning` (por-tema) y las clases Tailwind `danger`/`warning` ahora reactivas.

- [ ] **Step 1: Emitir las CSS vars en `buildVars`** (`constants/themes.ts`, dentro del objeto que retorna `buildVars(p)`)

```ts
    '--c-danger': hexToRgbTriplet(p.danger),
    '--c-warning': hexToRgbTriplet(p.warning),
```

- [ ] **Step 2: Defaults en `global.css`** (`:root`, junto a las demás `--c-*`)

```css
  --c-danger: 238 68 68;   /* #EF4444 */
  --c-warning: 245 158 11; /* #F59E0B */
```

- [ ] **Step 3: Clases Tailwind leen las vars** (`tailwind.config.js`, reemplazar los hex hardcodeados)

```js
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
```

- [ ] **Step 4: Verificar el token antes de migrar clases** — `pnpm lint` + `pnpm exec expo export --platform web` (build OK). Arrancar la app y confirmar que `text-danger`/`bg-danger` resuelven (no transparente).

- [ ] **Step 5: Migrar clases crudas → token** (decisión tomada: se acepta el leve oscurecimiento, `text-red-300/400 → text-danger`):
- `components/Badge.tsx:14` (tono `danger`) → `bg-danger/15 border border-danger/40 text-danger` (reemplaza `red-500`/`red-400`).
- `app/(tabs)/perfil.tsx:217` (`tone==='danger'`) → `text-red-400 → text-danger`.
- `app/calificar/[id].tsx:86` → `bg-red-500/15 → bg-danger/15`.
- (Los banners `red-*` de los 8 formularios se tokenizan al extraerse a `ErrorBanner` en Task 4.)

- [ ] **Step 6: Verificar** — `pnpm lint`. Prueba manual: en `apariencia.tsx` cambiar a "Blanco" y confirmar que Badge/perfil danger se ven bien (pasan a `#DC2626`).

- [ ] **Step 7: Commit**

```bash
git add constants/themes.ts global.css tailwind.config.js components/Badge.tsx "app/(tabs)/perfil.tsx" "app/calificar/[id].tsx"
git commit -m "refactor(theme): reconciliar danger/warning a una sola fuente via CSS vars"
```

---

### Task 4: ErrorBanner - `components/ErrorBanner.tsx` + adoptar en 8 formularios

**Files:**
- Create: `components/ErrorBanner.tsx`
- Reference (levantar markup exacto): `app/(auth)/login.tsx:80-85`
- Modify (adoptar): `app/(auth)/login.tsx:80`, `app/(auth)/register.tsx:155`, `app/(auth)/recuperar.tsx:89`, `app/reset.tsx:104`, `app/editar-perfil.tsx:95`, `app/(tabs)/crear.tsx:215`, `app/cancha/editar.tsx:422`, `app/cancha/registrar.tsx:554`

**Interfaces:**
- Consumes: token `danger` (Task 3).
- Produces: `ErrorBanner({ message, className?, icon?, onDismiss?, action? })`. `message` falsy → `null`.

- [ ] **Step 1: Crear `components/ErrorBanner.tsx`** levantando el markup exacto de `login.tsx:80-85` y tokenizando el color. El contenedor actual usa `rounded-xl` (12px) = idéntico a `rounded-sm` (12px, token del sistema): usar `rounded-sm`. Borde/fondo → token `danger`; texto → `text-danger` (decisión §4). Icono `alert-circle` con `useTheme().danger`.

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Props = {
  message?: string | null;
  className?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onDismiss?: () => void; // reservado, sin uso hoy
  action?: { label: string; onPress: () => void }; // reservado, sin uso hoy
};

export default function ErrorBanner({ message, className = 'mb-4', icon = 'alert-circle' }: Props) {
  const c = useTheme();
  if (!message) return null;
  return (
    <View className={`flex-row items-center gap-2 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2.5 ${className}`}>
      <Ionicons name={icon} size={18} color={c.danger} />
      <Text className="flex-1 font-body text-sm text-danger">{message}</Text>
    </View>
  );
}
```

> Nota: verificar contra `login.tsx:80-85` que `gap`, `px`/`py`, tamaño de icono y clases de texto coinciden; ajustar el componente para que sea pixel-idéntico en esmeralda. Si algún banner usaba `text-[13px]` u otra variante, respetarla.

- [ ] **Step 2: Adoptar (6 canónicos)** — reemplazar el bloque `{error ? (<View ...>...</View>) : null}` por `<ErrorBanner message={error} />` en: `login:80`, `register:155`, `recuperar:89`, `reset:104`, `editar-perfil:95`, `(tabs)/crear:215`.

- [ ] **Step 3: Adoptar (2 con `mt-2`)** — `cancha/editar:422` y `cancha/registrar:554` → `<ErrorBanner message={error} className="mt-2" />`.

- [ ] **Step 4: Verificar** — `pnpm lint` (quitar imports sin uso, p.ej. `Ionicons`/`View` que quedaban solo por el banner en `reset.tsx`/`recuperar.tsx`). Diff visual de un formulario con error en esmeralda (idéntico) y en "Blanco" (borde/fondo/ícono ahora siguen el tema).

- [ ] **Step 5: Commit**

```bash
git add components/ErrorBanner.tsx "app/(auth)/login.tsx" "app/(auth)/register.tsx" "app/(auth)/recuperar.tsx" app/reset.tsx app/editar-perfil.tsx "app/(tabs)/crear.tsx" app/cancha/editar.tsx app/cancha/registrar.tsx
git commit -m "refactor(ui): extraer ErrorBanner y adoptarlo en los 8 formularios"
```

---

### Task 5: StatCard - `components/StatCard.tsx` + adoptar en 6 sitios

**Files:**
- Create: `components/StatCard.tsx`
- Reference (levantar markup): `app/(tabs)/perfil.tsx:201` (`Stat`) y `app/partido/[id].tsx:291` (`InfoCard`)
- Modify (adoptar): `app/(tabs)/perfil.tsx` (borrar `Stat`, call-sites `:103/:104/:105`), `app/partido/[id].tsx` (borrar `InfoCard`, `:136/:137`), `app/cancha/panel.tsx:170` (+`:176`), `app/admin/index.tsx:110`, `app/admin/pagos.tsx:125` (+`:129`), `app/admin/canchas.tsx:379`

**Interfaces:**
- Consumes: `useTheme()`.
- Produces: `StatCard` con props `value, label, icon?, iconStyle?('plain'|'badge'|'inline'), tint?, valueColor?, size?('sm'|'md'), variant?('stat'|'info'), align?('left'|'center'), labelPosition?('top'|'bottom'), labelTracking?('wide'|'wider'), highlight?({color}), fitValue?, onPress?, className?`.

- [ ] **Step 1: Crear `components/StatCard.tsx`** levantando el JSX de `perfil.tsx:201` (`Stat`) como base y parametrizando los ejes de variación. Usar `useTheme()` para `tint`/`valueColor` defaults (`c.primary`/`c.cream`). **Hornear el fix de clipping de la fuente display por tamaño**: `size='sm'` → `text-2xl` con `{ lineHeight: 30, paddingTop: 2 }`; `size='md'` → `text-3xl` con `{ lineHeight: 38, paddingTop: 2 }`. `variant='info'` → valor en `font-body-semibold text-sm` (info tile de partido). El color del valor SIEMPRE vía `style={{ color: valueColor ?? c.cream }}` (string crudo), nunca clase. `highlight` → borde + `backgroundColor: color+'14'` + recolor del valor. `StatCard` NO lleva márgenes/flex externos ni `FadeIn` (van en el padre vía `className`).

> Construcción exacta: comparar contra `perfil.tsx:201` (variante centrada, label abajo), `panel.tsx:170` (sin icono, valor coloreado, label arriba), `admin/index.tsx:110` (icono badge, highlight, fitValue) y `partido/[id].tsx:291` (info tile). El componente debe reproducir cada uno pixel-idéntico en esmeralda. Mapear `labelTracking` a `tracking-wide`/`tracking-wider` y `label` `text-xs`/`text-[10px]` según la instancia.

- [ ] **Step 2: Adoptar perfil** — borrar el `Stat` local (`:201`), migrar `:103/:104/:105`. El `tone==='danger'` (hoy `text-red-400`) → `valueColor={Colors.danger}` (decisión §6; o `c.danger` si el sitio ya tiene `useTheme`).

- [ ] **Step 3: Adoptar partido** — borrar `InfoCard` local (`:291`), migrar `:136/:137` a `<StatCard variant="info" ... />`.

- [ ] **Step 4: Adoptar los 4 restantes** — `panel:170`(+`:176`), `admin/index:110` (conservar `FadeIn`+`flexBasis` en el padre), `admin/pagos:125`(+`:129`), `admin/canchas:379` (`valueColor` condicional por signo).

> Los 2 "hero saldo" (`cancha/panel.tsx:150`, `cancha/finanzas.tsx:219`) NO se tocan: quedan como composición a medida (decisión §5).

- [ ] **Step 5: Verificar** — `pnpm lint`. Diff visual pantalla por pantalla (perfil, partido, panel, admin index/pagos/canchas) en esmeralda: idéntico. Cambiar de tema: los valores/iconos siguen el tema.

- [ ] **Step 6: Commit**

```bash
git add components/StatCard.tsx "app/(tabs)/perfil.tsx" "app/partido/[id].tsx" app/cancha/panel.tsx app/admin/index.tsx app/admin/pagos.tsx app/admin/canchas.tsx
git commit -m "refactor(ui): extraer StatCard y adoptarlo en stats + info tile"
```

---

### Task 6: BackButton + ScreenHeader - `components/BackButton.tsx` + adoptar en ~28 sitios

**Files:**
- Create: `components/BackButton.tsx` (exporta `BackButton` y `ScreenHeader`)
- Reference (levantar markup): `app/canchas.tsx:50` (header estándar) y `app/partido/[id].tsx:106` (overlay)
- Modify (adoptar): los ~28 sitios listados en el spec §7.

**Interfaces:**
- Consumes: `useTheme()`, `expo-router` `useRouter`.
- Produces:
  - `BackButton({ onPress?, icon?('chevron-back'|'chevron-down'|'close'), variant?('card'|'overlay'), color?, size?, className?, hitSlop? })` - default `onPress=router.back()`, `icon='chevron-back'`, `variant='card'`, siempre `rounded-full`, `color` default reactivo `useTheme().cream`.
  - `ScreenHeader({ title?, titleSize?('xl'|'2xl'|'3xl'), titleAlign?, right?, children?, borderBottom?, backIcon?, backVariant?, onBack?, showBack?, backClassName? })`.

- [ ] **Step 1: Crear `BackButton`** levantando el Pressable circular de `canchas.tsx:50` (`h-10 w-10 items-center justify-center rounded-full bg-card`, icono `chevron-back` `size 22`), con `useTheme()` para el color por default. `variant='overlay'` → `bg-black/30` (para `partido`). Sin prop `radius` (siempre `rounded-full`; el outlier de apariencia se unifica).

- [ ] **Step 2: Crear `ScreenHeader`** = fila con `BackButton` + título `font-display uppercase` con el fix de clipping por `titleSize` (`xl`→`text-xl`, `2xl`→`text-2xl` `{lineHeight:? ,paddingTop:2}`, `3xl`→`text-3xl` `{lineHeight:40,paddingTop:2}` — copiar los valores exactos de los headers actuales). `right` activa `justify-between`; `children` reemplaza el título (headers compuestos); `borderBottom` agrega `border-b border-border`; `showBack=false` renderiza el placeholder `h-10 w-10` para no mover el título.

- [ ] **Step 3: Adoptar estándar (~18)** → `<ScreenHeader title="...">`: `canchas:50`, `mis-reservas:77`, `mis-pagos:22`, `mis-partidos:22`, `editar-perfil:55`, `calificar:50`, `(auth)/register:80`, `cancha/editar:234`, `cancha/agenda:83`, `cancha/finanzas:189`, `cancha/[id]/reservar:152`, `admin/index:79`, `admin/canchas:221`, `admin/reportes:83`, `admin/reservas:68`, `admin/pagos:71`, `admin/retiros:189`, `admin/usuarios:75`. Usar el título literal actual de cada pantalla.

- [ ] **Step 4: Adoptar variaciones**:
- `cancha/[id]/index:38` → `<ScreenHeader title="Cancha" titleSize="2xl" />`.
- `(auth)/recuperar:42`, `(auth)/login:39` → `<BackButton />` (solo botón).
- `cancha/registrar:227` → `<BackButton onPress={() => (paso > 1 ? atras() : router.back())} />` (conservar barra de progreso).
- `apariencia:27` → `<BackButton className="mr-3" />` (**unificado**: `rounded-full` + color reactivo por default; se abandona `rounded-sm`/`theme.cream`).
- `checkout/[id]:91` → `<ScreenHeader title={paso==='listo'?'Comprobante':'Pagar cupo'} titleSize="2xl" backIcon="chevron-down" showBack={paso==='metodo'} />`.
- `crear-post:62` → `<ScreenHeader title="Nuevo post" titleSize="xl" backIcon="close" titleAlign="center" />`.
- `partido/[id]:106` → `<BackButton variant="overlay" />` dentro de la fila `justify-between` (share como está, o pasar por `right`).
- `chat/[id]:54` → `<BackButton className="mr-2" />` dentro del header compuesto (NO forzar `ScreenHeader`).
- `post/[id]:72` → `<ScreenHeader title="Publicación" titleSize="xl" borderBottom backClassName="mr-2" />`; en el estado de carga (`:39`) `<BackButton />`.

- [ ] **Step 5: Verificar** — `pnpm lint`. Diff visual de una muestra (canchas, admin, cancha detalle, checkout, partido overlay, chat, post, apariencia). `apariencia` es el único con cambio esperado (`rounded-sm → rounded-full`). Confirmar títulos sin clipping de Anton.

- [ ] **Step 6: Commit**

```bash
git add components/BackButton.tsx app/
git commit -m "refactor(ui): extraer BackButton + ScreenHeader y unificar los ~28 headers"
```

> Nota: si el `git add app/` arrastra cambios no relacionados, agregar los archivos de header uno por uno.

---

### Task 7: UrgencyPill - `components/UrgencyPill.tsx` + `urgencyLabel()` + adoptar en 3 + espejos

**Files:**
- Create: `components/UrgencyPill.tsx` (exporta `UrgencyPill` y la función pura `urgencyLabel`)
- Reference (levantar markup): `components/GameCard.tsx:60-80` (solid/strip), `app/partido/[id].tsx:146-151` (tint/pill)
- Modify (adoptar pill): `components/GameCard.tsx:60`, `app/(tabs)/index.tsx:162`, `app/partido/[id].tsx:146`
- Modify (espejos de copy): `app/apariencia.tsx:41`, `app/partido/[id].tsx:69`, `lib/mockData.ts` (`cuposFaltantes()`)

**Interfaces:**
- Consumes: `useTheme()`.
- Produces:
  - `urgencyLabel(faltan: number, opts?: { urgentLabel?: string; fullLabel?: string }): string` - pura. `faltan<=0`→`fullLabel` (default `'Cupo lleno'`); `faltan===1`→`urgentLabel` (default `'¡Falta 1!'`); si no, `\`Faltan ${faltan}\``.
  - `UrgencyPill({ faltan, tone?('solid'|'tint'), shape?('strip'|'pill'), size?('sm'|'md'), urgentLabel?, fullLabel?, showFull?, trailing?, fill?, className? })`.

- [ ] **Step 1: Escribir `urgencyLabel()`** (función pura, la fuente única del copy)

```ts
export function urgencyLabel(
  faltan: number,
  { urgentLabel = '¡Falta 1!', fullLabel = 'Cupo lleno' }: { urgentLabel?: string; fullLabel?: string } = {},
): string {
  if (faltan <= 0) return fullLabel;
  if (faltan === 1) return urgentLabel;
  return `Faltan ${faltan}`;
}
```

> Verificar contra el copy actual de cada sitio (GameCard: `¡Falta 1, parce!`; los otros `¡Falta 1!`; lleno: revisar el texto exacto de GameCard/partido). Ajustar defaults/params para reproducir el wording literal de hoy.

- [ ] **Step 2: Crear `UrgencyPill`** levantando el markup de `GameCard.tsx:60-80` (tone `solid`: bg color pleno, texto `ink`) y `partido/[id].tsx:146-151` (tone `tint`: bg `color+'22'`, texto color pleno). Derivar estado con `urgencyLabel`. Colores vía `useTheme()` (`urgente ? c.accent : c.primary`; lleno usa su color actual). `shape='strip'`+`fill` → franja `justify-between` sin radio propio; `shape='pill'` → `rounded-full` self-sized. `trailing` comparte el fondo (el `partido.formato` de GameCard, con su color `ink`/`muted`).

- [ ] **Step 3: Adoptar los 3 pill**:
- `components/GameCard.tsx:60` → `<UrgencyPill faltan={faltan} tone="solid" shape="strip" size="md" fill urgentLabel="¡Falta 1, parce!" trailing={<Text className="font-body-bold text-xs uppercase" style={{ color: lleno ? c.muted : c.ink }}>{partido.formato}</Text>} />` (migrar GameCard a `useTheme()` acá o en Task 8; documentar que el color del formato no cambia).
- `app/(tabs)/index.tsx:162` → `<UrgencyPill faltan={faltan} tone="solid" shape="strip" size="sm" fill showFull={false} />` (icono `flame`, copy default).
- `app/partido/[id].tsx:146` → `<UrgencyPill faltan={faltan} tone="tint" shape="pill" size="sm" />`. Conservar la variable `lleno` (`:47`) para ProgressBar/CTA del resto de la pantalla.

- [ ] **Step 4: Enrutar los espejos de copy por `urgencyLabel()`**:
- `app/apariencia.tsx:41` (preview estático) → usar `urgencyLabel(1, { urgentLabel: '¡Falta 1, parce! 🔥' })` o el equivalente, para que el preview siga la fuente única.
- `app/partido/[id].tsx:69` (Share) → derivar el texto de cupos con `urgencyLabel(faltan)`.
- `lib/mockData.ts` `cuposFaltantes()` → devolver `urgencyLabel(...)` en vez de su propio `'Lleno'`/`'Falta 1'`.

- [ ] **Step 5: Verificar** — `pnpm lint`. Diff visual de las 3 pantallas más visibles (home feed, strip "Cierran ya", detalle) en esmeralda: idéntico. Confirmar el copy en el preview de apariencia y en el Share.

- [ ] **Step 6: Commit**

```bash
git add components/UrgencyPill.tsx components/GameCard.tsx "app/(tabs)/index.tsx" "app/partido/[id].tsx" app/apariencia.tsx lib/mockData.ts
git commit -m "refactor(ui): extraer UrgencyPill + urgencyLabel() y unificar el copy de cupos"
```

---

### Task 8: Theming reactivo - migrar el proxy `Colors` a `useTheme()`

Migrar los ~48 archivos que leen el proxy estático `Colors` para colores en JS. Ver el catálogo (spec §9) para la lista de líneas por archivo. Se hace en 3 sub-lotes; cada archivo: `const c = useTheme()` al tope y `Colors.X → c.X`, más el patrón específico por categoría. **NO tocar** `lib/store.ts` ni `constants/colors.ts`.

Patrones:
- **Cat A** (directo en render): `const c = useTheme()`; `Colors.X → c.X`.
- **Cat B** (mapa const a nivel de módulo que congela el tema - es un bug): convertir a factory `(c: Palette) => ({...})` e invocarla dentro del componente. `import type { Palette } from '@/constants/themes'`.
- **Cat C** (helper de módulo que lee `Colors`): agregar parámetro `(valor, c: Palette)` y pasarle `c` desde el componente.
- **Cat D** (default param `= Colors.X`): quitar el default y resolver en el cuerpo (`color ?? c.muted`).

- [ ] **Step 8a: Componentes compartidos** (migrar, `pnpm lint`, commit por lote): `Field.tsx`, `GameCard.tsx`, `PostCard.tsx`, `AmenidadPicker.tsx`, `DateTimeField.tsx`, `StarRating.tsx`, `ProgressBar.tsx`, `AdminGate.tsx`, `UbicacionPicker.tsx` **+ `.web`**, `CanchaMap.tsx` **+ `.web`**, `ModeracionBoton.tsx` (Cat D). Verificar cada uno: cambiar de tema recolorea en vivo.

```bash
git add components/
git commit -m "refactor(theme): migrar componentes compartidos a useTheme() (reactivo)"
```

- [ ] **Step 8b: Pantallas Cat A** (migrar en lotes, `pnpm lint`, commit): `app/_layout.tsx`, `(auth)/_layout.tsx`, `(auth)/welcome|register|login|recuperar`, `reset.tsx`, `editar-perfil.tsx`, `crear-post.tsx`, `mis-pagos.tsx`, `canchas.tsx`, `post/[id].tsx`, `mis-partidos.tsx`, `chat/[id].tsx`, `admin/index.tsx`, `admin/canchas.tsx`, `(tabs)/buscar|crear|muro`, `checkout/[id].tsx`, `partido/[id].tsx`, `cancha/[id]/reservar`, `cancha/[id]/index`, `cancha/editar`, `cancha/registrar`, **`app/calificar/[id].tsx`** (omisión del catálogo, incluida por decisión §9).

```bash
git add app/
git commit -m "refactor(theme): migrar pantallas Cat A a useTheme() (reactivo)"
```

- [ ] **Step 8c: Cat B/C/D (arreglan el tema congelado)** — factory/firma con `Palette`:
- Cat B: `admin/usuarios.tsx` (`ROL_CHIP`), `admin/reportes.tsx` (`TIPO`), `admin/retiros.tsx` (`ESTADO`), `cancha/agenda.tsx` / `cancha/panel.tsx` (`ESTADO_COLOR`), `cancha/finanzas.tsx` (`RETIRO_ESTADO`).
- Cat C: `mis-reservas.tsx`, `admin/pagos.tsx`, `admin/reservas.tsx`.
- Cat D: `(tabs)/perfil.tsx` (`Stat tint`, si no quedó cubierto en Task 5).

**Verificación clave (Cat B):** antes de migrar, sus chips/estados se ven emerald en TODOS los temas (bug). Después: cambian con el tema. Con esmeralda deben quedar idénticos al estado previo.

```bash
git add app/
git commit -m "fix(theme): mapas de color por-tema (Cat B/C/D) ya no congelan esmeralda"
```

- [ ] **Step 8d: Verificación final de la fase** — `pnpm lint` limpio; `pnpm exec expo export --platform web` OK; prueba manual de los 7 temas (incl. "Blanco") confirmando que (a) esmeralda se ve idéntico salvo el back de `apariencia`, y (b) el UI JS responde en vivo al cambio de tema (Cat B ya no congelados, banners/badges danger siguen el tema).

---

## Self-Review (cobertura del spec)

- Motion §2 → Task 1. Haptics §3 → Task 2. Danger/warning §4 → Task 3. ErrorBanner §5 → Task 4. StatCard §6 → Task 5. BackButton/ScreenHeader §7 → Task 6. UrgencyPill §8 → Task 7. Theming reactivo §9 → Task 8.
- Orden §10 respetado: 1,2,3 independientes; 4 tras 3 (usa token `danger`); 5,6,7 crean+adoptan; 8 al final (primitivas nuevas ya nacen reactivas).
- Fuera de alcance §11 (radios/hex por pantalla, tipografía, cablear warn/error, guard ESLint): NO hay tasks, correcto.
- Decisiones §13 bakeadas: `fast`/`fastCard` separados (T1), warn/error creados sin cablear (T2), `text-danger` en todo (T3/T4), StatCard acotado (T5), apariencia unificado (T6), `urgencyLabel` + espejos (T7), `calificar` incluido (T8b).

## Riesgo transversal

Sin snapshots/tests, la única red es `pnpm lint` + `expo export` + **diff visual manual pantalla por pantalla**. Ejecutar las adopciones (Tasks 4-7) y el theming (Task 8) **en lotes chicos con commit frecuente**, verificando el tema esmeralda tras cada uno, para que cualquier regresión visual quede aislada en un commit.
