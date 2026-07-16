# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Falta Uno** — Expo (React Native) app to organize pickup football games and a fields
("canchas") marketplace, starting in Pereira, Colombia. Ships to iOS/Android (EAS) and as
a web build (React Native Web) hosted on Dokploy.

## Package manager: pnpm (NOT npm)

This is the single most common trip-up. The repo standardized on **pnpm via corepack**:

- `package.json` pins `packageManager: pnpm@11.10.0`. Run `corepack enable` once; then `pnpm …`.
- `pnpm-workspace.yaml` sets **`nodeLinker: hoisted`** — required so Metro/NativeWind can
  resolve a flat `node_modules` (pnpm's default symlinked layout breaks React Native autolinking
  and NativeWind's injected `react-native-css-interop/jsx-runtime` import). Do not change this or
  switch to npm/yarn. There is no committed `package-lock.json` on purpose.
- pnpm 11 requires **Node ≥ 22** (it uses the `node:sqlite` builtin). The Docker build pins `node:22-alpine`.

## Commands

```bash
pnpm install                          # install deps (uses pnpm-lock.yaml)
pnpm start                            # expo start — dev server (Expo Go QR, or press a/i/w)
pnpm android | pnpm ios | pnpm web    # expo start on a specific platform
pnpm lint                             # expo lint — the only automated check in the repo
pnpm exec expo export --platform web  # produce the static web build in dist/
```

There is **no test suite** (no jest, no `test` script). "Verification" means: `pnpm lint`, a
successful `expo export`, and — for the web deploy — a `docker build` (see Deploy).

Mobile release builds go through EAS (`eas.json`):

```bash
eas build --platform android --profile preview        # installable APK for testing
eas build --platform android|ios --profile production # store artifacts (.aab / .ipa)
eas submit --platform android|ios
```

## Architecture

**Routing** — Expo Router, file-based in `app/`. `app/_layout.tsx` loads fonts and wraps everything
in the auth provider. Groups: `(auth)` (welcome/login/register/recuperar), `(tabs)` (home, buscar,
crear, muro, perfil). The rest are stack routes: `partido/[id]`, `chat/[id]`, `checkout/[id]`,
`calificar/[id]`, the muro (`post/[id]`, `crear-post`), and the canchas marketplace
(`canchas`, `cancha/panel`, `cancha/agenda`, `cancha/finanzas`, `cancha/[id]/…`, `mis-reservas`).

**Two roles** — a profile has `roles` including `jugador` (default: create/join partidos) and/or
`cancha` (field owner: panel, agenda, finanzas, reservations). Screens branch on the active role.

**Backend/demo duality (core pattern)** — the app runs fully **without a backend**. `lib/supabase.ts`
exposes `supabaseConfigurado`; when Supabase credentials are absent it falls back to local
`AsyncStorage` + `lib/mockData.ts`. Both `lib/auth.tsx` (AuthContext: session, profile, `demo` flag,
sign-in/up/guest, delete-account) and `lib/store.ts` branch on this. When configured,
`store.hidratar(userId)` pulls real data from Supabase and `lib/chat.ts` uses Realtime. Keep both
paths working when touching data flow.

**State** — a single persisted **zustand** store in `lib/store.ts` (partidos, inscripciones, pagos,
chat fallback, calificaciones/reputación, muro social posts+comentarios, moderación bloqueos+reportes).
Auth lives separately in `lib/auth.tsx`. Data layers: `lib/canchas.ts` (canchas: reservas, agenda,
saldo, PayU), `lib/payments.ts`, `types/database.ts` (Supabase row types).

**Supabase** — the schema (tables + per-user RLS) is managed with **versioned migrations** in
`supabase/migrations/` (the source of truth; there is no `schema.sql`). Local dev uses the Supabase CLI
(a devDependency) with a Docker stack: `pnpm db:start`, add a change with `pnpm db:new <name>` (or
`pnpm db:diff`), test with `pnpm db:reset` (re-applies every migration + `supabase/seed-demo.sql`).
Merging to `main` triggers `.github/workflows/db-migrations.yml`, which runs `supabase db push` to apply
pending migrations to prod. `db reset` is **local only**, never against prod; there is **no staging**, so
always test locally before merging. Server logic lives in `supabase/functions/` (`rapyd-crear-checkout`,
`rapyd-webhook`, `delete-user`) and — together with its secrets — is **managed in the Supabase
dashboard**, not deployed by the CLI or CI.

**Payments (hard invariant)** — the client **never** marks a payment `aprobado`. Cash stays
`pendiente` (Falta Uno holds no money). Online payments (Rapyd — the PSP that acquired PayU's LatAm
operation in 2025 — for both partidos and canchas) open an external hosted checkout via an edge function;
`aprobado` is written **only** by the server webhook. Secret keys live only in edge functions, never with
the `EXPO_PUBLIC_` prefix. See `docs/RAPYD-SETUP.md`.

**Styling** — NativeWind (Tailwind for RN). Brand tokens in `constants/colors.ts` + a runtime theme
switcher in `constants/themes.ts`/`lib/theme.ts`. Wired via `babel.config.js` (`jsxImportSource: nativewind`)
and `metro.config.js` (`withNativeWind`, `input: ./global.css`).

## Web-export gotchas (non-obvious, will silently blank the page if ignored)

- **`EXPO_PUBLIC_*` vars are inlined at BUILD time** (`expo export`), not runtime. In a Docker build,
  an unset `ARG` becomes an **empty string** (defined, not undefined). Read such vars with
  `process.env.X?.trim() || fallback`, **never `?? fallback`** (empty string isn't null and would win).
  See `lib/supabase.ts` and `constants/config.ts`.
- **Never `import 'react-native-maps'` directly in `app/`** — it is native-only and breaks the web
  bundle. Always use `@/components/CanchaMap` (platform-split `CanchaMap.tsx` / `CanchaMap.web.tsx`,
  where web renders a Google Maps iframe). The Dockerfile fails the build if a direct import reappears in `app/`.
- **`import.meta` in the web bundle** — deps (e.g. zustand middleware) emit `import.meta`, a
  SyntaxError in Expo's classic-`<script>` web bundle. Expo's transform for it is **default since
  SDK 56** (`babel-preset-expo`'s `transformImportMeta`), so no babel config is needed on SDK 57. The
  Dockerfile still parse-checks the emitted bundle (`vm.Script`) so this class of error fails the build
  instead of shipping a blank page.

## Deploy

- **Web + legal pages → Dokploy.** Multi-stage `Dockerfile` (pnpm build → nginx) + `nginx.conf`
  (SPA fallback to `index.html`, `/legal/*` served as static files). Runbook: `docs/DESPLIEGUE-DOKPLOY.md`.
  In Dokploy the `EXPO_PUBLIC_*` values go in **Build-time Arguments** (they bake in at build), not
  runtime Environment; they are public (baked into the browser bundle) so they are not secrets.
  The `legal/*.html` files are static pages the stores require (privacy, terms, account deletion).
- **Mobile → EAS.** See `eas.json`. Store-compliance notes: `docs/CUMPLIMIENTO-TIENDAS.md`,
  `docs/GUIA-PUBLICACION-GOOGLE-PLAY.md`.

## Expo SDK version

The repo pins **Expo SDK 57** (`expo` in `package.json`: RN 0.86, React 19.2, TypeScript 6). Before
writing Expo/RN code, consult the versioned docs for the **installed** SDK:
https://docs.expo.dev/versions/v57.0.0/ — always verify the version in `package.json` first.

Lint note: `eslint-config-expo` 57 turns on the React Compiler hook rules. `eslint.config.js` disables
the advisory ones (`react-hooks/immutability`, `set-state-in-effect`, `preserve-manual-memoization`,
`purity`) because they flag Reanimated's `sharedValue.value = …` API and standard data-loading
effects — they are optimization hints, not bugs. It also ignores `supabase/functions/**` (Deno).

## Working style & skills

This project is built with Claude Code's **superpowers** and **taste** plugins. Use them whenever they
fit — prefer them over ad-hoc work:

- **superpowers (process discipline).** For any non-trivial change, follow its flow instead of coding
  off the cuff: `brainstorming` to turn an idea into a design, `writing-plans` → `executing-plans` (or
  `subagent-driven-development`) for multi-step work, `systematic-debugging` for any bug or test failure,
  `test-driven-development` when writing logic, and `verification-before-completion` before claiming
  anything works. Feature work is **specced before coding**: designs go in `docs/superpowers/specs/`,
  implementation plans in `docs/superpowers/plans/` (dated `YYYY-MM-DD-<topic>`) — see the existing files
  for the format. When installed, the `using-superpowers` skill auto-loads at session start.
- **taste (frontend design).** Reach for the taste skill whenever you **build or redesign UI** — screens,
  components, visual polish. This app has a real design system (NativeWind brand tokens in
  `constants/colors.ts`, runtime themes, glassmorphism, staggered Reanimated motion, haptics); keep new
  screens consistent with it and avoid generic/templated layouts.
  - **HARD RULE — `docs/DESIGN.md` governs all UI.** Any work that touches `app/` or `components/`
    MUST follow the project design standard in [`docs/DESIGN.md`](docs/DESIGN.md) and pass its
    **Pre-flight checklist** before being considered done. The taste skill supplies the *principles*
    (it is web-oriented; §13 lists native mobile as out of scope) — `docs/DESIGN.md` is its
    **React Native / Expo / NativeWind translation** and **wins on any RN-specific conflict**. The
    core non-negotiables: tokens only (never hardcoded hex), `useTheme()` in components (not the
    `Colors` proxy), the `rounded-sm/md/lg/full` radius scale only, works across all 7 themes
    (incl. light `Blanco`), motivated motion, and complete empty/loading/error states.

> These are **per-machine Claude Code plugins**, not part of the repo, so this guidance only takes effect
> if your Claude Code has them installed. If it doesn't, install them via `/plugin` (the superpowers
> marketplace + a taste/design skill). Without them the repo still works — the guidance above is just inert.
