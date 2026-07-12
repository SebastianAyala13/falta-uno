# Fase 3 — Auditoría de pantallas + plan priorizado

> **Parte de "taste en todo el proyecto".** Fase 1 = [`docs/DESIGN.md`](../../DESIGN.md) (estándar) + regla en `CLAUDE.md`.
> Fase 2 = reforzar el design system (motion/haptics, tokens `danger`/`warning`, primitivas
> `ErrorBanner`/`StatCard`/`BackButton`+`ScreenHeader`/`UrgencyPill`, theming reactivo repo-wide).
> **Esta Fase 3** barre las 37 pantallas + los componentes contra el [Pre-flight de §12](../../DESIGN.md#12-pre-flight-checklist)
> y rankea por impacto. Alimenta la **Fase 4** (rediseño de pantallas clave).

**Fecha:** 2026-07-12
**Método:** 38 auditorías en paralelo (37 pantallas de `app/` + 1 sweep de `components/`), cada una contra
el checklist de 14 puntos, + síntesis priorizada. Sweeps mecánicos vía `grep` repo-wide (autoritativos).
**Verificación disponible (no hay test suite):** `pnpm lint` + `pnpm exec tsc --noEmit` + `expo export web`.

---

## 0. TL;DR — diagnóstico

**El núcleo del sistema está sano.** Post-Fase 2, tokens, copy, theming reactivo y las primitivas nuevas
ya viven repo-wide. No hay deuda **estructural**: lo que queda es **drift de superficie**, denso pero
mayormente mecánico, **concentrado en `canchas/*` y `admin/*`**.

Donde de verdad duele son **dos frentes puntuales** (los únicos 10 hallazgos *critical*):

1. **Theme-lock roto (4 fugas de hex/dark hardcodeado)** en pantallas de altísimo alcance: `welcome`
   (logo + scrim), `perfil` (gradiente hero) y **`components/DateTimeField`** (picker iOS forzado a
   oscuro, compartido por *todos* los formularios). Rompen el tema claro `Blanco` — es exactamente el
   anti-patrón que `DESIGN.md §2.1` cita como ejemplo de "MAL".
2. **Estados de datos faltantes (loading/error) en 6 pantallas de fetch**: muestran el `EmptyState` como
   "no hay datos" *durante la carga*, o fallan en silencio si la red/RLS falla.

**Todo lo demás es volumen, no criterio** (126 radios fuera de escala, 14 `ActivityIndicator`, tamaños
tipográficos ad-hoc, haptics, reuso de primitivas): alto valor por unidad de esfuerzo vía **sweeps
guiados**, no rediseño. Solo **1 pantalla** (`cancha/registrar`, el wizard de onboarding) amerita
rediseño de fondo.

| Métrica | Valor |
|---|---|
| Unidades auditadas | **38** (37 pantallas + sweep de componentes) |
| Hallazgos *critical* | **10** (4 theme-lock + 6 estados faltantes) |
| Hallazgos *important* | **123** |
| Hallazgos *minor* | **65** |
| Pantallas que ameritan rediseño (no solo limpieza) | **1** (`cancha/registrar`) |
| Pantallas limpias (0 hallazgos) | **4** (`login`, `recuperar`, `editar-perfil`, `app/_layout`) |

---

## 1. Drift mecánico (medido con grep, repo-wide)

| Chequeo | `app/` | `components/` | Estado |
|---|---:|---:|---|
| **Radios default** (`rounded-xl/2xl/3xl`) | **114** en 31 archivos | 12 en 9 | ⚠️ **Drift #1** |
| `ActivityIndicator` suelto (vs `Skeleton`) | 14 archivos (todo `cancha/*` + `admin/*`) | — | ⚠️ Drift #2 |
| Hex crudo `#RRGGBB` | 6 en 5 (casi todo gradiente decorativo) | 1 (`GlowButton`) | ✔️ bajo |
| Clases de color crudas (`red-500`…) | **0** | **0** | ✔️ Fase 2 tokenizó |
| em-dash `—` en copy visible | **0** | — | ✔️ limpio |
| Fuga del proxy `Colors.` | **0** | — | ✔️ sin regresión |

Peores archivos por radios: `cancha/finanzas` (12), `cancha/registrar` (9), `admin/canchas` (9),
`perfil` (9), `partido/[id]` (6), `checkout/[id]` (6), `cancha/panel` (5).

---

## 2. Temas transversales (cruzan muchas pantallas)

| # | Tema | Sev. | Alcance | Tipo | Esfuerzo |
|---|---|---|---|---|---|
| 1 | **Theme-lock: hex/dark hardcodeado rompe `Blanco`** | 🔴 critical | `welcome`, `perfil`, `DateTimeField` (todos los forms), tab bar (`rgba` de blur) | rediseño | bajo |
| 2 | **Estados de datos faltantes (loading/error)** | 🔴 critical | `mis-reservas`, `canchas`, `admin/canchas`, `admin/reportes`, `admin/retiros` (+`crear` sin catch) | rediseño | medio |
| 3 | **Radios default fuera de escala** | 🟠 important | 126 usos (31 archivos app/ + 9 comp/) | sweep-mecánico | medio |
| 4 | **`ActivityIndicator` → `Skeleton`** | 🟠 important | 14 archivos `cancha/*` + `admin/*` | mixto | medio |
| 5 | **Primitivas hand-rolled** (`EmptyState`/`Badge`/`Chip`/`Field`/`ScreenHeader`/`GlowButton`/`ProgressBar`) | 🟠 important | `EmptyState` en ~9; badge `color+'22'` en ~8; `Chip` en ~6; `Field` en ~4; `GlowButton` en 4 comp | mixto | alto |
| 6 | **Color lock: dos acentos (`primary` + `accent`) en una pantalla** | 🟠 important | `home`, `admin/index` (4), `admin/canchas` (3), `post/[id]`, `cancha/[id]/index` | rediseño | bajo |
| 7 | **Haptics ausentes** en Pressables de nav/selección | 🟠 important | casi toda la nav hand-rolled (home, perfil, `reservar` y `registrar` en 0) | sweep-mecánico | bajo |
| 8 | **Tamaños tipográficos ad-hoc** (`text-[10px]`/`[11px]`/`[15px]`/`[25px]`) | 🟡 minor | ~10 pantallas | sweep-mecánico | bajo |

> **Trampa clave del sweep de radios:** el `2xl` default (16px) **NO** equivale a `rounded-md` (18px).
> Mapear **por rol semántico**, no por cercanía numérica: inputs→`sm`(12), tiles/filas/tarjetas
> chicas→`md`(18), heros/tarjetas grandes/modales→`lg`(24), icon-badges cuadrados→`full`.

---

## 3. Plan priorizado — tiers por impacto

Prioridad = **severidad × prominencia**. P0 = rompe theme-lock en alto alcance; P3 = nits periféricos.

### 🔴 P0 — Rompe theme-lock en alto alcance (`Blanco` inusable)

Bajo esfuerzo, máximo impacto de percepción de calidad. Fugas en las pantallas que más usuarios ven.

| Pantalla | Por qué | Top fixes |
|---|---|---|
| **`app/(auth)/welcome.tsx`** | Primera pantalla de todo usuario nuevo; 2 hex `#0B0F0D` (fondo logo + scrim) pintan caja/franja negra en `Blanco` | Derivar de `useTheme()` (`c.card`/`c.background`); `rounded-3xl`→`lg`, icon-badge→`full`; `haptics.tap()` en el CTA invitado |
| **`components/DateTimeField.tsx`** | `themeVariant='dark'` fuerza el picker iOS oscuro en **todos** los forms bajo cualquier tema. **Un fix, muchas pantallas** | `themeVariant = c.esOscuro ? 'dark' : 'light'`; inputs→`sm/md`; CTA "Listo" → `GlowButton` |
| **`app/(tabs)/perfil.tsx`** | Tab core muy visitado; gradiente hero `#10231C`/`#0C1712` rompe `Blanco`; + peor cluster de radios (9) y cero haptics | Gradiente desde `c`; sweep radios (`3xl`→`lg` ×4, `2xl`→`md` ×2, `xl`→`sm` ×3); haptics; `bg-danger/15`; `text-[11px]`→`xs` |

### 🟠 P1 — Criticals de estado + pantallas core del flujo

Pantallas de fetch que hoy "mienten" (EmptyState durante carga) o fallan mudas, + core del flujo
principal (home, crear, checkout). Impacto directo en confianza y en flujos que generan dinero.

| Pantalla | Por qué | Top fixes |
|---|---|---|
| **`mis-reservas.tsx`** | 2 criticals: sin loading (muestra "Sin reservas aún" mientras carga) y sin catch | flag `cargando`→`Skeleton`; `try/catch`→`ErrorBanner` con reintento; radios; `Badge`; haptics en Cancelar |
| **`canchas.tsx`** | Entrada al marketplace; critical sin loading (EmptyState engañoso) + sin error | estado `cargando` (montar + al filtrar)→`Skeleton`; `try/catch`→`ErrorBanner`; buscador→`Field`; `2xl`→`lg` |
| **`admin/canchas.tsx`** | Critical sin catch (falla = "sin canchas"); + 9 radios (2º peor) + multi-acento | `catch`→`ErrorBanner`; sweep 9 radios; `ActivityIndicator`→`Skeleton`; unificar acento; toggle→`Chip` |
| **`admin/reportes.tsx`** | Critical sin catch: moderación que falla en silencio deja al admin ciego | estado error + `catch`→`ErrorBanner`; `ActivityIndicator`→`SkeletonBlock`; radios; chips/badges de motivo |
| **`admin/retiros.tsx`** | Critical sin catch (toca **dinero**: retiros) | `catch` en ambos `try/finally`→`ErrorBanner`; `ActivityIndicator`→`Skeleton`; `Badge` (tone warning) |
| **`(tabs)/index.tsx` (home)** | Pantalla más vista; mezcla 2 acentos, `text-[25px]` ad-hoc, nav sin haptics | unificar acento dominante; `text-[25px]`→`text-2xl/3xl`; haptics en toda la nav; `rounded-xl`→`md/full` |
| **`(tabs)/crear.tsx`** | Falta loading de `canchasDisponibles` (lista vacía = estado vacío real) + catch silencioso | estado `cargandoCanchas`→`Skeleton` horizontal; `catch`→`ErrorBanner`; radios; `borderRadius:10` inline→clase |
| **`checkout/[id].tsx`** | Pago core (**invariante crítico**); 6 radios, "no encontrado" suelto, spinner sin reduced-motion | radios por rol; "no encontrado"→`EmptyState`; `haptics.select()`; reduced-motion **(NO tocar lógica aprobado-solo-webhook)** |

### 🟡 P2 — Drift *important* en secundarias (canchas owner-side, muro, detalle)

Mucho volumen de drift mecánico + gaps de reuso, pero sin romper theme-lock ni perder datos. Alto
retorno vía sweeps por lote; algunas necesitan juicio puntual (skeletons, `Chip`/`ChatBubble`, acento).

`cancha/finanzas` (12 radios + `ActivityIndicator`) · `cancha/registrar` (**único redesignCandidate**:
wizard 8 pasos, `ProgressBar`/botón hand-rolled, 0 haptics) · `cancha/reservar` (slots/pagos como `Chip`
duplicado, 2 `ActivityIndicator`, 0 haptics) · `cancha/panel` (header hand-rolled ×3) · `cancha/agenda` ·
`cancha/editar` · `cancha/[id]/index` (color lock icono teléfono) · `partido/[id]` (no distingue
"cargando" de "no existe") · `post/[id]` · `chat/[id]` (extraer `ChatBubble`, radios crudos 4/16) ·
`crear-post` (textarea→`Field`, **cero FadeIn**, `Alert`→`ErrorBanner`) · `buscar` (buscador→`Field`).

### ⚪ P3 — Nits periféricos y admin de bajo tráfico

Absorbibles casi enteramente por los quick-win sweeps. `admin/pagos` · `admin/reservas` ·
`admin/usuarios` · `mis-pagos` · `mis-partidos` (+ shadow `c`→`cal` diferido de Fase 2) · `calificar/[id]`
(1 em-dash en fallback de nombre) · `register` · `muro` · `apariencia` (header sin fix anti-clipping) ·
`(tabs)/_layout` (blur `rgba`, FAB) · **sweep de `components/`** (12 radios + 4 CTA hand-rolled→`GlowButton`).

---

## 4. Quick-wins — backlog de sweeps (alto valor / bajo costo)

Ordenados. Correr `pnpm lint` + `expo export web` tras cada lote grande.

1. **Sweep de radios (126 usos)** → escala `sm/md/lg/full` por **rol semántico** (no por valor; `2xl`≠`md`).
   Empezar por los peores: `finanzas` (12), `registrar`/`admin-canchas`/`perfil` (9). Incluir
   `borderRadius` inline mágicos (10/16/18).
2. **`ActivityIndicator` → `Skeleton`** en los 14 archivos `cancha/*`+`admin/*` (spinner = mecánico;
   silueta = juicio ligero; reusar el mismo `SkeletonBlock`/`GameCardSkeleton` donde el layout se repite).
3. **Tamaños tipográficos ad-hoc**: `[10/11px]`→`text-xs`, `[15px]`→`text-sm/base`, `[25px]`→`text-2xl`
   (preservar `lineHeight`/`paddingTop` de Anton). ~10 pantallas.
4. **Haptics** vía `lib/haptics.ts` (§6): `impact` Medium en primaria/submit/nav, `selectionAsync` en
   filtros/chips/toggles, `Light` en checkboxes. Prioridad: home, perfil, `registrar`, `reservar` (hoy en 0).
5. **Reemplazar el truco `color+'22'`/`'66'`** por `bg-{tone}/15` o `Badge` (extendido con tone `warning`):
   `admin/canchas`, `admin/pagos`, `admin/reservas`, `admin/retiros`, `cancha/panel`, `cancha/agenda`,
   `mis-reservas`, `mis-pagos`, `perfil`.
6. **`EmptyState` hand-rolled → primitiva** en: `mis-pagos`, `mis-partidos`, `partido/[id]`, `post/[id]`
   (×2), `checkout`, `chat`, `cancha/[id]/index`, `cancha/reservar`, `admin/index`.
7. **Deuda diferida de Fase 2** (baratísima, un solo commit): `StatCard rounded-2xl`→escala `md`; podar
   `iconStyle`/`onPress` sin uso; extraer el helper `cx` duplicado (`BackButton`+`StatCard`) a un módulo;
   `mis-partidos:19` shadow `c`→`cal`; `useMemo` en los factories de Categoría B.

---

## 5. Orden recomendado para Fase 4 (rediseño de pantallas clave)

Las que necesitan **juicio**, no solo find/replace:

1. **`(tabs)/index.tsx` (home)** — la más vista; unificar acento (jerarquía) + escala tipográfica del hero
   = mayor impacto percibido por esfuerzo.
2. **`cancha/registrar.tsx`** — único redesignCandidate; wizard de onboarding del marketplace: `ProgressBar`/botón
   a primitivas, tarjetas selectoras, haptics de flujo largo.
3. **`cancha/reservar.tsx`** — extraer/extender `Chip` para slots con precio + medios de pago; skeletons de
   cancha+grilla; `EmptyState`s y haptics.
4. **`checkout/[id].tsx`** — estados completos + reduced-motion en el spinner, **sin tocar** el invariante
   aprobado-solo-webhook.
5. **`partido/[id].tsx`** — distinguir "cargando" (hidratación) de "no existe" con `Skeleton` vs `EmptyState`
   (requiere exponer flag de hidratación del store).
6. **`cancha/finanzas.tsx`** — diseñar el skeleton de saldo+movimientos y el mapeo de 12 radios por rol.
7. **`chat/[id]` y `post/[id]`** — extraer `ChatBubble` con radios de escala; unificar acento;
   `ScreenHeader`/`EmptyState`/`GlowButton` compartidos.

---

## 6. Riesgos y guardrails al ejecutar

- **Invariante de pago:** al tocar `checkout/[id]`, `cancha/reservar`, `mis-pagos`, `admin/pagos` **NO**
  alterar la lógica de estado — el cliente **nunca** marca `aprobado`, solo el webhook. Cambios **puramente
  visuales** (radios/estados/skeletons).
- **No romper el look del tema por defecto** (esmeralda oscuro): al re-tematizar los hex de
  `welcome`/`perfil`/`DateTimeField`/tab bar, derivar de `useTheme()` debe quedar **visualmente equivalente**
  en el tema activo y SOLO arreglar `Blanco`/claros. **Verificar los 7 temas, foco en `Blanco`.**
- **Radios:** `2xl` default (16px) ≠ `rounded-md` (18px). Mapear por rol semántico, **revisar visualmente
  cada archivo**, no un find/replace ciego global.
- **Dualidad backend/demo:** los estados nuevos de loading/error deben funcionar en modo demo
  (`AsyncStorage` + `mockData`) **y** con Supabase. No asumir que `hidratar()`/`listarCanchas()` siempre
  pegan a red; probar ambos caminos.
- **Extender `Badge`/`Chip` con tone `warning`** toca primitivas compartidas: `grep` de todos los
  consumidores antes de mergear.
- **`CanchaMap`:** al ajustar radios mantener el split de plataforma; **jamás** un import directo de
  `react-native-maps` en `app/` (el Dockerfile falla el build).
- **No tocar** `supabase/functions/*` ni su config (managed en el dashboard): fuera de scope de UI.
- **Web export:** los sweeps no deben introducir `import.meta` ni romper el bundle clásico; `pnpm lint` +
  `expo export web` tras cada lote (esa es la verificación — no hay test suite).
- **Skeletons/estados nuevos** = solo presentación: no cambiar el contrato de datos ni el orden de hooks.
  Cuidado con `set-state-in-effect` al agregar flags `cargando`.

---

## 7. Apéndice — todas las pantallas (ordenadas por drift)

`crit`/`imp`/`min` = hallazgos por severidad. 🎯 = redesignCandidate.

| # | Archivo | Prom. | Drift | c/i/m | Tier | Lectura |
|---|---|---|---:|---|---|---|
| 1 | `cancha/finanzas.tsx` | sec | 62 | 0/10/4 | P2 | Peor radio drift (12) + `ActivityIndicator` |
| 2 | `admin/canchas.tsx` | perif | 58 | 1/6/3 | P1 | Sin catch + 9 radios + multi-acento |
| 3 | `(tabs)/perfil.tsx` | core | 55 | 1/4/2 | **P0** | Gradiente hex rompe `Blanco` + 9 radios + 0 haptics |
| 4 | `mis-reservas.tsx` | sec | 55 | 2/3/2 | P1 | Sin loading **ni** error |
| 5 | `post/[id].tsx` | core | 52 | 0/6/5 | P2 | 4 radios + tamaños ad-hoc + 2 estados + 2 acentos |
| 6 | `cancha/registrar.tsx` | sec | 52 | 0/5/2 | P2 🎯 | Wizard: `ProgressBar`/botón hand-rolled, 0 haptics |
| 7 | `crear-post.tsx` | core | 48 | 0/4/0 | P2 | Textarea, **cero FadeIn**, `Alert` en vez de banner |
| 8 | `canchas.tsx` | sec | 45 | 1/4/0 | P1 | Sin loading/error + buscador hand-rolled |
| 9 | `chat/[id].tsx` | sec | 45 | 0/5/3 | P2 | Radios crudos 4/16, header/empty hand-rolled |
| 10 | `cancha/panel.tsx` | sec | 45 | 0/3/1 | P2 | `ActivityIndicator` + header ×3 hand-rolled |
| 11 | `admin/reportes.tsx` | perif | 45 | 1/3/1 | P1 | Sin catch en moderación |
| 12 | `admin/retiros.tsx` | perif | 45 | 1/3/1 | P1 | Sin catch (toca dinero) |
| 13 | `welcome.tsx` | core | 42 | 2/1/2 | **P0** | 2 hex `#0B0F0D` rompen `Blanco` |
| 14 | `cancha/[id]/index.tsx` | sec | 42 | 0/5/2 | P2 | `ActivityIndicator` + color lock teléfono |
| 15 | `cancha/[id]/reservar.tsx` | sec | 42 | 0/10/1 | P2 | Slots/pagos duplican `Chip`, 0 haptics |
| 16 | `admin/index.tsx` | perif | 42 | 0/4/2 | P3 | `ActivityIndicator` + 4 acentos |
| 17 | `admin/pagos.tsx` | perif | 42 | 0/4/2 | P3 | Filtros/badge hand-rolled |
| 18 | `components/` (sweep) | perif | 42 | 1/2/2 | P3 | `DateTimeField` dark forzado + 12 radios + 4 CTA |
| 19 | `admin/usuarios.tsx` | perif | 40 | 0/4/1 | P3 | 2 radios + `ActivityIndicator` + chip rol |
| 20 | `(tabs)/crear.tsx` | core | 38 | 0/2/1 | P1 | Falta loading de canchas + radios |
| 21 | `cancha/editar.tsx` | sec | 38 | 0/5/3 | P2 | 3 radios + `ActivityIndicator` full-screen |
| 22 | `mis-pagos.tsx` | sec | 35 | 0/3/2 | P3 | `EmptyState`/`Badge` hand-rolled |
| 23 | `mis-partidos.tsx` | sec | 35 | 0/2/2 | P3 | `EmptyState` reimplementado + shadow `c`→`cal` |
| 24 | `partido/[id].tsx` | core | 35 | 0/3/3 | P2 | No distingue "cargando" de "no existe" |
| 25 | `checkout/[id].tsx` | core | 35 | 0/2/2 | P1 | 6 radios + reduced-motion (invariante pago) |
| 26 | `cancha/agenda.tsx` | sec | 35 | 0/3/2 | P2 | 2 `ActivityIndicator` + pills hand-rolled |
| 27 | `admin/reservas.tsx` | perif | 35 | 0/3/3 | P3 | `Chip`/`Badge` reimplementados |
| 28 | `register.tsx` | sec | 32 | 0/3/2 | P3 | 2 radios + haptics de selección faltantes |
| 29 | `calificar/[id].tsx` | sec | 32 | 0/1/3 | P3 | 3 radios + 1 em-dash en fallback |
| 30 | `(tabs)/index.tsx` (home) | core | 28 | 0/3/1 | P1 | 2 acentos + `text-[25px]` + 0 haptics |
| 31 | `(tabs)/buscar.tsx` | core | 28 | 0/3/0 | P2 | Buscador hand-rolled + sin error |
| 32 | `apariencia.tsx` | perif | 28 | 0/2/1 | P3 | Header sin fix anti-clipping + swatches |
| 33 | `(tabs)/muro.tsx` | core | 25 | 0/1/2 | P3 | Compositor `2xl` + filtros `Chip` |
| 34 | `(tabs)/_layout.tsx` | core | 18 | 0/1/2 | P3 | Blur `rgba` ad-hoc + FAB |
| 35 | `recuperar.tsx` | perif | 5 | 0/0/0 | — | ✔️ Limpia |
| 36 | `login.tsx` | core | 2 | 0/0/0 | — | ✔️ Limpia (patrón origen) |
| 37 | `editar-perfil.tsx` | core | 2 | 0/0/0 | — | ✔️ Limpia |
| 38 | `app/_layout.tsx` | core | 0 | 0/0/0 | — | ✔️ Infraestructura, limpio |
