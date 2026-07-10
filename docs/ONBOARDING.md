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
6. Correr: **`pnpm web`** (rápido, en el navegador) o un **development build** en device/simulador
   (ver sección 3). ⚠️ Expo Go de las tiendas **no** sirve para SDK 57 (ver abajo).

## 3. Correr en un dispositivo o simulador (development build)

> El **upgrade a Expo SDK 57 ya está hecho** (contexto en
> [`docs/superpowers/plans/2026-07-07-expo-sdk-54-to-57-upgrade.md`](superpowers/plans/2026-07-07-expo-sdk-54-to-57-upgrade.md)).

⚠️ **Expo Go de las tiendas todavía no soporta SDK 57** — escanear el QR con Expo Go da *"requires a
newer version of Expo Go"* aunque la tengas actualizada. Para probar en device/simulador se usa un
**development build**. El repo ya trae `expo-dev-client` y el perfil `development` en `eas.json`.

- **Web (lo más rápido, sin setup nativo):** `pnpm web` (o `http://localhost:8081`). Ideal para
  UI/lógica; lo nativo (mapas/cámara/notificaciones) no se prueba igual que en el celu.
- **iOS Simulator (Mac):** necesitás **Xcode**. Luego `npx expo run:ios` genera `ios/`, compila y abre
  el Simulador con el dev build (la 1ª vez tarda: CocoaPods + Xcode). Día a día: `pnpm start` y conecta.
  Sin EAS, sin cuenta Expo, sin cuenta Apple.
- **Android (device/emulador):** con **Android Studio** → `npx expo run:android`. Sin toolchain local
  → `eas build --profile development -p android` (build en la nube, requiere cuenta Expo) → instalás el
  APK → `pnpm start`.
- **iPhone físico:** necesita **cuenta Apple Developer** ($99/año) + registrar el UDID del iPhone con
  `npx eas-cli device:create`, y buildear con un perfil sin `simulator: true`.

> Tip (Windows + pnpm): si `pnpm start` se cae con un `ENOENT ... _tmp_...` en `node_modules`, es un
> temp dir huérfano de una instalación interrumpida — reiniciá con `pnpm start -c` (limpia la caché de
> Metro); si persiste, `rm -rf node_modules && pnpm install`.

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
