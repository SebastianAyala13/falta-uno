# Onboarding — Falta Uno (handoff para un nuevo colaborador)

Checklist para que otra persona (y su Claude Code) arranque sin fricción.

## 1. Tu Claude ya conoce el proyecto

Este repo tiene un **`CLAUDE.md`** en la raíz — Claude Code lo carga **solo**. Documenta el
setup de pnpm/Node, la arquitectura y los "gotchas" del export web. No hace falta explicarle el
proyecto: apuntá a Claude al archivo de la tarea (abajo) y ya tiene el contexto.

> Requisito: esto solo funciona si `CLAUDE.md` y los docs están **pusheados a GitHub** (no basta
> con tenerlos en local). Si clonaste y no ves `CLAUDE.md`, pedile al owner que haga `git push`.

## 2. Setup de la máquina (hacelo en orden)

Este proyecto usa **pnpm**, NO npm (no hay `package-lock.json`; pnpm usa `node_modules` hoisted
que Metro necesita). Usar npm rompe el build.

1. **Node ≥ 22.13** (pnpm 11 lo requiere): `node -v`.
2. **`corepack enable`** — activa la versión de pnpm fijada en `package.json` (`packageManager`).
3. `git clone https://github.com/SebastianAyala13/falta-uno.git && cd falta-uno`
4. **`pnpm install`**
5. **Credenciales:** `cp .env.example .env` y completá `EXPO_PUBLIC_SUPABASE_URL` y
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API; pedíselas al owner). Sin ellas la app
   corre en **modo demo** (datos locales) — sirve para casi todo el trabajo de UI, pero auth/chat/datos
   reales necesitan las llaves. La `service_role` NO va en la app (solo en Edge Functions).
6. Correr: **`pnpm start`** (Expo Go / emulador) o **`pnpm web`**.

## 3. La tarea: upgrade de Expo SDK 54 → 57

- **Runbook:** [`docs/superpowers/plans/2026-07-07-expo-sdk-54-to-57-upgrade.md`](superpowers/plans/2026-07-07-expo-sdk-54-to-57-upgrade.md).
  Abrilo y pedile a tu Claude que lo ejecute **paso a paso** (incremental 54→55→56→57).
- **Necesitás un device o emulador** (Android Studio / Xcode): el smoke nativo (mapas, animaciones,
  gestos, date picker, fotos, notificaciones) NO se valida solo con el build web.
- Trabajá en una rama: `chore/expo-sdk-57-upgrade`. No mergees a `main` hasta que los 3 saltos validen.

## 4. Accesos que podés necesitar

| Para | Qué |
|---|---|
| Código | Write access a `SebastianAyala13/falta-uno` (GitHub). |
| Datos / auth | Proyecto Supabase (URL + anon key). |
| Builds móviles | Cuenta Expo/EAS (`eas build`). |
| Deploy web | Dokploy — los `EXPO_PUBLIC_*` van en **Build-time Arguments** (ver [`docs/DESPLIEGUE-DOKPLOY.md`](DESPLIEGUE-DOKPLOY.md)). |

## 5. Guardarraíles ya puestos (para que tu Claude no tropiece con lo que ya resolvimos)

- El **Dockerfile** falla el build si se importa `react-native-maps` directo en `app/` (usar
  `@/components/CanchaMap`) o si el bundle web tiene un error de parseo de script clásico.
- La sección "web-export gotchas" de `CLAUDE.md` cubre la trampa del `EXPO_PUBLIC_*` en string vacío
  y la de `import.meta`.

## 6. Claude Code — paridad de setup

- `CLAUDE.md` se autocarga; con eso alcanza para la mayoría del trabajo.
- Si vas a tocar **Supabase** o **Mercado Pago**, conectá sus MCP en Claude Code (`/mcp`).
- El plan de upgrade referencia skills de `superpowers` (brainstorming/plans); son opcionales — el
  runbook se puede seguir sin ellas.
