# Estándar de diseño — Falta Uno

> **Documento vivo.** Es la fuente de verdad de cómo se ve y se mueve la UI de esta app.
> **Aplica a todos** — humanos y a cualquier Claude Code que toque `app/` o `components/`.
> Regla dura: **ningún trabajo de UI se da por terminado sin pasar el [Pre-flight](#12-pre-flight-checklist)**.

Este estándar nace de aplicar la **taste skill** a todo el proyecto. La taste skill está escrita
para **web** (React/Next.js, Tailwind puro, `motion/react`, GSAP) y en su Sección 13 lista
*native mobile* como **fuera de alcance**. Este documento es su **traducción a React Native /
Expo / NativeWind**: conserva sus principios y descarta su implementación web.

---

## 0. Qué transfiere de la taste skill (y qué no)

| ✅ Sí aplica (es lo valioso) | ❌ No aplica (es web-only) |
|---|---|
| Consistency locks: color, forma, tema | `motion/react` → acá es **Reanimated** |
| "Motion must be motivated" | GSAP / ScrollTrigger / scroll-hijack |
| Jerarquía tipográfica y de contraste (a11y) | `next/font`, RSC, `'use client'` |
| Densidad de contenido, copy limpio | variante `dark:` de Tailwind (usamos CSS vars) |
| Evitar los "AI tells" | `<div>`, `picsum`, logo-walls, bento web |
| Estados vacío / carga / error completos | breakpoints web, `min-h-[100dvh]` |

**El diagnóstico de esta app no es "slop" — es *drift*.** Ya existe un design system con criterio
(marca esmeralda + lima, tema oscuro, `Anton` display, componentes propios). El problema es que el
código **se salta el sistema**: radios ad-hoc, hex hardcodeados, patrones reimplementados 3 veces.
Por eso, para Falta Uno, **los locks de consistencia pesan más que las reglas anti-slop.**

---

## 1. Design read y diales

**Design read:** app social-deportiva de consumo (pichangas + marketplace de canchas) para jugadores
jóvenes en Pereira. Marca **dark-first, enérgica** (esmeralda + lima, `Anton`). Modo de trabajo:
**Redesign → Preserve** (evolucionar, no reinventar la marca).

**Diales (taste §1), adaptados a móvil:**
- `DESIGN_VARIANCE: 7` — enérgico, pero una pantalla de teléfono limita la asimetría.
- `MOTION_INTENSITY: 5–6` — entrada escalonada + feedback de press + haptics. **Siempre motivado.**
- `VISUAL_DENSITY: 4` — respira, pero no es una galería de arte.

---

## 2. Reglas duras — los locks

### 2.1 Tokens son ley — nunca hex hardcodeado

Toda la UI se colorea con **tokens** (clases NativeWind o el hook `useTheme()`), nunca con hex crudo.

Tokens de marca (definidos en `constants/themes.ts`, expuestos como clases en `tailwind.config.js`):

`primary` · `primary2` · `accent` · `secondary` · `background` · `card` · `cream` (texto) ·
`muted` · `border` · `borderStrong` · `ink` (texto/ícono sobre superficies de color) ·
`danger` · `warning`.

```tsx
// ❌ MAL — se rompe en el tema claro "Blanco", ignora el tema activo
<View style={{ backgroundColor: '#0B0F0D' }} />
<Text className="text-red-400">Error</Text>

// ✅ BIEN — respeta los 7 temas
<View className="bg-background" />
<Text className="text-danger">Error</Text>
```

> Excepción única: gradientes decorativos pueden mezclar un token con un hex si el hex es una
> variante *más oscura del mismo tono de marca* y aun así se ve bien en tema claro. Si dudás, no lo hagas.

### 2.2 Theming — `useTheme()` en componentes, no el proxy `Colors`

Para colores en **JS** (íconos, `LinearGradient`, props nativas) usá el hook reactivo:

```tsx
import { useTheme } from '@/lib/theme';
const c = useTheme();            // ✅ recolorea al instante al cambiar de tema
<Ionicons color={c.primary} />
```

El proxy `Colors` de `constants/colors.ts` **no se re-renderiza** al cambiar de tema (el propio
archivo lo advierte). Reservalo para código fuera de React (helpers, constantes). **En componentes,
`useTheme()`.**

### 2.3 Shape lock — la escala de radios `sm / md / lg`

`tailwind.config.js` define la escala del sistema. **Usá SOLO estas** para las superficies indicadas:

| clase | valor | uso |
|---|---|---|
| `rounded-sm` | 12px | inputs, chips, badges |
| `rounded-md` | 18px | tarjetas pequeñas, stat cards |
| `rounded-lg` | 24px | tarjetas grandes, hero, modales |
| `rounded-full` | — | pills, avatares, botones-ícono |

⚠️ **Trampa:** la config **redefine** `md`/`lg`/`sm`. Acá `rounded-lg` = **24px** (no el 8px de
Tailwind por defecto). **No uses `rounded-xl` / `rounded-2xl` / `rounded-3xl`** — son los defaults de
Tailwind y rompen el lock. (Hoy hay ~141 usos de defaults vs ~21 de la escala real: eso es el drift a corregir.)

### 2.4 Theme lock — funciona en los 7 temas

Hay 6 temas oscuros + 1 claro (`Blanco`). Toda pantalla debe verse bien **en los 7**, en especial en
`Blanco` (fondo claro, texto oscuro). Nada de fondos/gradientes oscuros fijos que asuman dark mode.
Un solo acento por pantalla, aplicado igual en toda la pantalla (taste **Color Consistency Lock**).

---

## 3. Tipografía

- **Display / titulares / números:** `font-display` (`Anton`), **siempre** con `uppercase`.
  Anton corta los ascendentes: cuando ajustes `lineHeight`, reservá con `paddingTop`/`pb-1`
  (ver el patrón repetido en varias pantallas — candidato a encapsular en Fase 2).
- **Cuerpo:** `font-body` (`Archivo`); pesos `font-body-semibold`, `font-body-bold`.
- `font-body-medium` (`Archivo-Medium`) está **cargada pero sin uso** — no la introduzcas sin razón,
  o la retiramos en la limpieza.
- **No hay** aún un componente `Text`/`Heading` compartido: la escala de tamaños es ad-hoc por
  pantalla. Mientras exista ese vacío, seguí las combinaciones ya usadas en pantallas hermanas en vez
  de inventar tamaños (`text-[25px]`, `text-[15px]`, etc. son señales de deuda, no de plantilla).

---

## 4. Espaciado

- Insets horizontales de pantalla: converger en `px-5` / `px-6`. El `px-[22px]` del home es una
  excepción histórica, no un patrón a copiar.
- Usá la escala de spacing de Tailwind directo; no inventes valores en brackets salvo necesidad real.

---

## 5. Motion (Reanimated)

- Librería: **`react-native-reanimated`**. No mezclar con otras libs de animación.
- **`FadeIn`** (`components/FadeIn.tsx`) es el envoltorio de entrada canónico. Para listas, escaloná
  con `delay` creciente (`delay={base + i * step}`).
- **Motion motivado (taste §5):** cada animación comunica jerarquía, storytelling, feedback o cambio
  de estado. Si no podés justificarla en una frase, no la pongas.
- **Reduced motion:** cualquier movimiento perceptible respeta la preferencia del sistema. Para loops
  (shimmer, spinners), degradá a estático con `useReducedMotion()` de Reanimated.
- Las transiciones entre pantallas viven centralizadas en `app/_layout.tsx` (`screenOptions`). No
  las redefinás por pantalla salvo intención clara.
- ⚠️ Deuda: hoy los timings son magic numbers por call-site (460ms, 90/120ms, 800ms…). En Fase 2 se
  centraliza un config de timing/easing; hasta entonces, reusá los valores de `FadeIn`/`GlowButton`.

---

## 6. Haptics

Feedback háptico intencional, no decorativo. Vocabulario (a centralizar en `lib/haptics.ts` en Fase 2):

| intención | API |
|---|---|
| tap / acción primaria | `impactAsync(Medium)` |
| like / acción ligera | `impactAsync(Light)` |
| selección / toggle | `selectionAsync()` |
| éxito (pago, crear) | `notificationAsync(Success)` |

Mientras no exista `lib/haptics.ts`, seguí exactamente esta tabla para no sumar más variantes.

---

## 7. Estados completos

Toda vista con datos implementa los **tres** estados (taste §4.5):

- **Vacío** → `components/EmptyState.tsx` (ícono + título + texto + CTA opcional). No hand-rollees uno.
- **Carga** → `components/Skeleton.tsx` (`SkeletonBlock`, `GameCardSkeleton`) con forma parecida al
  resultado final. Evitá `ActivityIndicator` suelto salvo overlays puntuales.
- **Error** → banner inline con token `danger` (**no** `red-500`). Hoy este banner está duplicado en
  ~9 pantallas; usá el patrón existente y no crees una variante nueva (se extrae a componente en Fase 2).

---

## 8. Componentes: reusar, no reimplementar

Antes de escribir UI nueva, buscá la primitiva. Canónicas en `components/`:

`Screen` (wrapper base) · `GlowButton` (CTA) · `FadeIn` (entrada) · `Field` / `DateTimeField`
(inputs) · `Chip` (pill seleccionable) · `Badge` (etiqueta) · `Avatar` · `GameCard` / `PostCard`
(tarjetas de dominio) · `EmptyState` · `Skeleton` · `ProgressBar` · `StarRating`.

**No reimplementes** patrones que ya existen. Drift conocido a NO repetir (unificar en Fase 2):
la píldora de urgencia "¡Falta 1!" (3 copias), la stat/info card (3 copias), el botón de volver
(cada pantalla el suyo), el toggle seleccionable (usar `Chip`, no rehacerlo).

---

## 9. AI-tells a evitar en RN (taste §9)

- Sin `#000000` puro ni `#FFFFFF` puro — usá `background`/`card`/`cream`.
- Sin em-dash (`—`) en el **texto visible de la app** (titulares, labels, botones, copy, alt): usá
  guion normal `-` o reescribí la frase. (Regla de taste §9.G — aplica al UI que ve el usuario, no a
  documentos internos como este.)
- Sin nombres genéricos ("Juan Pérez"), números fake-precisos, ni copy de relleno ("potenciá",
  "revolucioná"). El parlache real de la app ("cuadrá la llave", "pichanga") es el tono correcto.
- Sin íconos SVG hechos a mano: **solo Ionicons** (`@expo/vector-icons`), una sola familia.
- Un solo acento por pantalla; nada de glows neón por todos lados.

---

## 10. Imágenes e íconos

- Íconos: **Ionicons** exclusivamente, tamaño y `color={c.token}` desde `useTheme()`.
- Fotos/avatares: `expo-image` (ya usado en `Avatar`, `PostCard`). Fallback a iniciales, nunca a un
  ícono "egg" genérico.
- `expo-glass-effect` está en deps pero **sin uso real** (el "glassmorphism" hoy es aspiracional; el
  único blur real es el tab bar). No lo publicites en UI nueva hasta que se implemente de verdad.

---

## 11. Fuera de alcance de este estándar

Formularios multi-paso complejos, tablas densas de datos y paneles admin siguen las reglas de
consistencia (tokens, radios, estados) pero **no** las heurísticas de landing/marketing de la taste
skill. Para admin, prioridad = claridad y densidad, no espectáculo.

---

## 12. Pre-flight checklist

Corré esto **antes de dar por terminada cualquier UI**. Si un ítem no se puede tildar con honestidad,
la pantalla no está lista.

- [ ] **Tokens:** cero hex hardcodeado; colores vía clases o `useTheme()`.
- [ ] **Theme lock:** se ve bien en los 7 temas, incluido `Blanco` (fondo claro).
- [ ] **Theming reactivo:** colores JS vía `useTheme()`, no el proxy `Colors`.
- [ ] **Shape lock:** radios solo `rounded-sm/md/lg/full`; ningún `rounded-xl/2xl/3xl`.
- [ ] **Color lock:** un solo acento, aplicado consistente en toda la pantalla.
- [ ] **`danger`/`warning` como token**, nunca `red-500`/`amber-500` crudos.
- [ ] **Tipografía:** `font-display` + `uppercase` en titulares; ascendentes de `Anton` sin cortarse.
- [ ] **Motion motivado:** cada animación se justifica en una frase; respeta reduced-motion.
- [ ] **Haptics:** siguen el vocabulario de §6, sin nuevas variantes.
- [ ] **Estados:** vacío / carga / error resueltos con las primitivas compartidas.
- [ ] **Reuso:** no reimplementé un patrón que ya existe en `components/`.
- [ ] **Íconos:** solo Ionicons; una familia.
- [ ] **Copy:** sin em-dash, sin nombres/números genéricos; tono de la app.
- [ ] **Contraste (a11y):** texto de botones y de formularios legible sobre su fondo (WCAG AA).

---

## 13. Deuda conocida (roadmap de este esfuerzo)

Este estándar es la **Fase 1** de "taste en todo el proyecto". Lo que sigue:

- **Fase 2 — Reforzar el design system:** centralizar timings/easing de motion, `lib/haptics.ts`,
  extraer `ErrorBanner` / `StatCard` / `BackButton` / `UrgencyPill`, reconciliar `danger`/`warning`
  (una sola fuente), migrar radios y hex al estándar, opcional guard de ESLint.
- **Fase 3 — Auditoría + plan priorizado:** barrer las 40+ pantallas contra este checklist, rankear
  por impacto.
- **Fase 4 — Rediseño de pantallas clave** guiado por la auditoría.

> Referencia completa de principios: la taste skill (`taste-skill:taste-skill`). Este doc gana en
> conflicto para todo lo específico de React Native.
