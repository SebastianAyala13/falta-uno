# Upgrade Expo SDK 54 → 57 — Plan

**Fecha:** 2026-07-07
**Estado:** Plan (sin ejecutar). Investigación hecha; pendiente de arrancar.

**Objetivo:** subir el proyecto de **Expo SDK 54 → 57** (RN 0.81 → 0.86, React 19.1 → 19.2)
de forma **incremental y verificada**, sin romper la app móvil ni el deploy web de Dokploy.

**Estrategia (decidida):** un SDK a la vez (54→55→56→57), cada salto con
`npx expo install --fix` + su guía de upgrade, validando antes de seguir. La migración de
`@expo/vector-icons` (43 archivos) queda **fuera de alcance** (sigue funcionando con warning;
tarea aparte post-upgrade).

## Restricciones y contexto

- **pnpm** (corepack, `packageManager: pnpm@11.10.0`, `nodeLinker: hoisted`). Usar `pnpm …`, no npm.
- **No hay suite de tests.** La verificación se apoya en `expo-doctor` + typecheck + build gates
  (Docker web) + **smoke manual en device**. Ver "Estrategia de validación".
- Node local ≥ 22.13 (tenés 22.16 ✅). El `Dockerfile` usa `node:22-alpine` (cumple los mínimos
  de RN 0.83/0.85/0.86: Node ≥ 20.19.4).
- New Architecture: no hay `newArchEnabled` en `app.json`, así que ya corrés en **New Arch**
  (default de SDK 54). SDK 55 **elimina** la Legacy Arch, por eso el riesgo real de ese salto es
  validar módulos nativos en New Arch (ya deberían andar, pero hay que probarlo en device).

## Estrategia de validación (correr en CADA salto de SDK)

1. **`pnpm dlx expo-doctor`** → 0 issues. **`npx expo install --check`** → sin mismatches.
2. **Typecheck:** `pnpm exec tsc --noEmit` (no hay script; usa el `tsconfig.json` del repo) y `pnpm lint`.
3. **Web (build gate):** `docker build … -t faltauno-web:sdd .` — ejercita `expo export` + los
   guardarraíles del Dockerfile (import.meta / classic-script + react-native-maps en app/).
   Correr el contenedor y `curl` las rutas (`/`, `/partido/1`, `/cancha/1`, `/legal/*` → 200).
4. **Nativo (dev build):** `npx expo run:android` / `run:ios` **o** un `eas build --profile development`
   en device/emulador. Smoke de las pantallas con módulos nativos (checklist abajo).
5. **Smoke de flujos** en modo demo y con Supabase real (login, feed, crear/inscribir, chat, canchas).

**Checklist de smoke nativo (las pantallas con módulos nativos):**
- Mapa: `app/partido/[id].tsx` y `app/cancha/[id]/index.tsx` (via `CanchaMap` → react-native-maps).
- Animaciones Reanimated: `FadeIn`, `GlowButton` (entrada escalonada, glow).
- Gestos: `react-native-gesture-handler` (scroll/press en tab bar, cards).
- Selectores de fecha/hora: `DateTimeField` (`@react-native-community/datetimepicker`) en crear partido.
- Fotos: `expo-image-picker` en `editar-perfil` / crear.
- Notificaciones locales: recordatorio al inscribirse (`expo-notifications`).
- Blur / glass: tab bar (`expo-blur`), efectos `expo-glass-effect`.

## Riesgos y bloqueantes a resolver ANTES de arrancar

- 🟡 **NativeWind vs RN 0.85/0.86:** styling es transversal, así que es el riesgo a vigilar. Dato
  concreto: `nativewind@4.2.6` (la instalada, y la última estable) declara **solo**
  `tailwindcss: '>3.3.0'` como peer — **no** fija versión de RN, así que **no bloquea el install**.
  El incógnito es el runtime con RN 0.85/0.86 (nativewind/react-native-css-interop tocan internals de
  RN/reanimated). Validar el estilado en el smoke de cada salto; si algo se rompe, el fallback es
  `nativewind@5.0.0-preview` (v5 en preview, apunta a RN nuevo). Confirmar en el smoke, no antes.
- 🟡 **react-native-maps en New Arch** (SDK 55): validar temprano en device; es el módulo nativo más
  histórico-problemático.
- 🟡 **Betas `@expo/ui` (~0.2-beta) y `expo-glass-effect` (~0.1):** APIs inestables entre SDKs;
  revisar su uso y changelog en cada salto; puede tocar ajustar código.
- 🟡 **Reanimated + Hermes v1 (SDK 56):** regresión conocida de +25-30% RAM en Android (fix en camino
  según Expo). Monitorear; no bloquea pero anotar.

## Paso 0 — Preparación

- [ ] Rama dedicada: `chore/expo-sdk-57-upgrade` (aparte de trabajo de features).
- [ ] `pnpm install` (deps no están instaladas localmente).
- [ ] Baseline verde: `pnpm dlx expo-doctor`, `pnpm exec tsc --noEmit`, `docker build` web OK. Anotar salida.
- [ ] Leer las guías: https://expo.dev/changelog/sdk-55 · /sdk-56 · /sdk-57 y la guía de upgrade de Expo.
- [ ] Investigar compat de **nativewind** con RN 0.83/0.85/0.86 (bloqueante potencial, ver arriba).

## Paso 1 — SDK 54 → 55  (RN 0.83, React 19.2; **New-Arch-only**)

- [ ] `pnpm dlx expo install expo@^55` → `npx expo install --fix` (alinea todos los `expo-*`/RN/React).
- [ ] `app.json`: **quitar** `android.edgeToEdgeEnabled: true` (campo removido; edge-to-edge obligatorio).
      Confirmar que NO hay `newArchEnabled` ni `notification` (ya no los hay).
- [ ] Bumpear `nativewind` si `expo-doctor`/peer-deps lo piden para RN 0.83.
- [ ] (Ya verificado: no usamos `experimentalBlurMethod`, ni el prop `reset` de headless tabs, ni
      imports directos de `@react-navigation` → nada que migrar acá.)
- [ ] **Validación completa** (los 5 pasos), con foco en el **smoke nativo en device** (New Arch).
- [ ] Commit: `chore(expo): upgrade a SDK 55 (RN 0.83, New Arch only)`.

## Paso 2 — SDK 55 → 56  (RN 0.85, Hermes v1, TypeScript 6)

- [ ] `pnpm dlx expo install expo@^56` → `npx expo install --fix`.
- [ ] `babel.config.js`: **quitar** `unstable_transformImportMeta: true` (en SDK 56 el transform es
      default, y la opción se renombró a `transformImportMeta`). Re-verificar el build web: el
      guardarraíl `vm.Script` del Dockerfile debe seguir en verde (0 `import.meta` en el bundle).
- [ ] **TypeScript 6:** `pnpm exec tsc --noEmit` y arreglar los errores nuevos que aparezcan.
- [ ] **`expo/fetch` como fetch global:** probar Supabase (auth, queries, realtime del chat). Si algo
      falla, opt-out temporal con `EXPO_PUBLIC_USE_RN_FETCH=1` y documentarlo.
- [ ] **Hermes v1 + Reanimated:** smoke de animaciones; vigilar RAM en Android (regresión conocida).
- [ ] `@expo/vector-icons`: **dejar como está** (deferido); aceptamos el warning de deprecación.
- [ ] (No hay imports directos de `@react-navigation` → no correr el codemod de router.)
- [ ] **Validación completa.** Commit: `chore(expo): upgrade a SDK 56 (RN 0.85, Hermes v1, TS6)`.

## Paso 3 — SDK 56 → 57  (RN 0.86; sin breaking changes)

- [ ] `pnpm dlx expo install expo@^57` → `npx expo install --fix` (bumps menores: reanimated 4.5,
      worklets 0.10, gesture-handler 2.32).
- [ ] **Validación completa** (rápida; Expo lo describe como el salto más fácil).
- [ ] Commit: `chore(expo): upgrade a SDK 57 (RN 0.86)`.

## Paso 4 — Cierre y docs

- [ ] Actualizar `CLAUDE.md` y `AGENTS.md`: SDK 57 y el link de docs versionados (v57).
- [ ] Si se quitó `unstable_transformImportMeta`: actualizar la nota del gotcha de `import.meta` en
      `CLAUDE.md` (ahora es default).
- [ ] Re-verificar el deploy web completo en Dokploy (build + rutas) y, si se puede, un
      `eas build --profile preview` para probar el binario móvil.
- [ ] Anotar como follow-up la migración de `@expo/vector-icons` → `@react-native-vector-icons/*`
      (codemod, 43 archivos).

## Rollback / seguridad

- Cada salto de SDK es **su propio commit** en la rama. Si un salto no pasa validación, `git revert`
  ese commit (o `reset` la rama) y reevaluar; **no** mergear a `main` hasta que los 3 saltos validen
  y el smoke en device (Android + iOS) pase.
- La rama se mantiene separada del trabajo de features para no bloquear releases.

## Definition of Done

- `expo-doctor` limpio en SDK 57; `pnpm exec tsc --noEmit` limpio; `pnpm lint` OK.
- Build web (Docker) + rutas `200`; deploy en Dokploy re-verificado.
- Dev build nativo con smoke OK en **Android e iOS** (checklist de módulos nativos).
- `CLAUDE.md`/`AGENTS.md` actualizados a SDK 57.

## Fuera de alcance

- Migración de `@expo/vector-icons` (tarea aparte).
- Subir `tailwindcss` a v4 (NativeWind 4 usa Tailwind 3 — **no** tocar).
- Subir dependencias no-Expo a mano fuera de lo que ordena `expo install --fix`.
