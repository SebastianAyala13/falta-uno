# Despliegue en Dokploy: web app + páginas legales

**Fecha:** 2026-07-06
**Estado:** Aprobado (pendiente de plan de implementación)

## Objetivo

Montar en un servidor Dokploy dos piezas de Falta Uno, servidas desde **un solo
dominio** por **una sola aplicación**:

1. **Versión web de la app** (export de Expo web / SPA con `react-native-web`) en la raíz.
2. **Páginas legales** (`legal/*.html`: privacidad, términos, eliminar-cuenta) bajo `/legal/`.

```
https://<dominio>/                      → app web (SPA, expo-router)
https://<dominio>/legal/privacidad.html
https://<dominio>/legal/terminos.html
https://<dominio>/legal/eliminar-cuenta.html
```

La app **móvil** (iOS/Android) sigue publicándose por EAS a las tiendas — eso NO
cambia. Esto es solo la web + lo legal.

## Decisiones tomadas

| Decisión | Elección |
|----------|----------|
| Qué se monta | App web + páginas legales |
| Estructura de dominio | Un dominio, web en `/`, legal en `/legal/` |
| Método de build | Dokploy buildea desde GitHub (Dockerfile), auto-deploy en push a `main` |
| Mapa en web | Fallback a Google Maps embed (iframe, sin API key); mapa nativo intacto en móvil |
| Dominio | **Configurable por `.env`** (`EXPO_PUBLIC_SITE_URL`), no hardcodeado |

## Arquitectura

Una **Application** en Dokploy conectada al repo `SebastianAyala13/falta-uno`
(rama `main`), build por **Dockerfile multi-stage** en la raíz del repo:

- **Stage 1 — builder (`node:20-alpine`):**
  - `npm ci`
  - `npx expo export --platform web` → genera `dist/` (SPA; `app.json` ya tiene `web.output: "single"`).
  - Copia `legal/*.html` → `dist/legal/`.
  - Recibe como **build args** las `EXPO_PUBLIC_*` (se hornean en el bundle).
- **Stage 2 — runtime (`nginx:alpine`):**
  - Copia `dist/` → `/usr/share/nginx/html`.
  - `nginx.conf` propio:
    - `location /legal/ { }` → sirve archivos reales (sin fallback SPA).
    - `location / { try_files $uri $uri/ /index.html; }` → fallback SPA para expo-router.
    - gzip + cache headers para assets con hash.
  - Expone puerto 80. Traefik de Dokploy enruta por Host y emite el SSL (Let's Encrypt).

Dokploy: dominio + HTTPS se configuran en su UI (no en el código). Auto-deploy webhook en push a `main`.

## Cambio de código: aislar el mapa (único ajuste funcional)

Hoy [app/partido/[id].tsx](../../../app/partido/[id].tsx) importa `MapView, { Marker }`
de `react-native-maps` en el nivel superior (línea 6). Esa librería es **solo nativa**
y **rompe el build web**. Se aísla con resolución por plataforma de Metro:

- **`components/CanchaMap.tsx`** (nativo) — el `MapView`/`Marker` actual, mismos props y UX.
- **`components/CanchaMap.web.tsx`** (web) — un **iframe de Google Maps embed**
  (`https://www.google.com/maps?q=<lat>,<lng>&output=embed`, **sin API key**) con la
  misma altura/estilo + el botón "Cómo llegar".
- `app/partido/[id].tsx` importa `CanchaMap` (props: `coords`, `cancha`, `zona`) en vez
  de `react-native-maps` directamente.

Metro resuelve `.web.tsx` solo en el bundle web, así que `react-native-maps` nunca
entra a la web. En móvil, cero cambios de comportamiento.

**Interfaz del componente:**
- Entrada: `{ coords: { latitude, longitude }, cancha: string, zona: string }`.
- Salida: bloque visual de mapa (nativo o iframe según plataforma).
- Depende de: `react-native-maps` (solo la variante nativa).

## Dominio configurable por `.env`

- Nueva var pública: **`EXPO_PUBLIC_SITE_URL`** (ej. `https://falta-uno.midominio.com`).
- En [constants/config.ts](../../../constants/config.ts) `LEGAL_URL` se deriva:
  ```ts
  const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://sebastianayala13.github.io/falta-uno-legal';
  export const LEGAL_URL = process.env.EXPO_PUBLIC_SITE_URL ? `${SITE_URL}/legal` : SITE_URL;
  export const URL_PRIVACIDAD = `${LEGAL_URL}/privacidad.html`;
  export const URL_TERMINOS = `${LEGAL_URL}/terminos.html`;
  ```
  (Fallback = GitHub Pages actual, para no romper builds sin la var.)
- Documentar `EXPO_PUBLIC_SITE_URL` en `.env.example`.
- El hostname/SSL real vive en la config de Dokploy (Traefik), no en el código. La var
  `.env` solo le dice a la app cuál es su propia URL pública (para los enlaces legales).
- Al cambiar de host, actualizar las URLs legales también en Play Console / App Store Connect.

## Variables de entorno (build args en Dokploy)

Se hornean en el bundle web al buildear (llaves **públicas**, es seguro exponerlas):

| Var | Uso |
|-----|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Conexión Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública) |
| `EXPO_PUBLIC_SITE_URL` | URL pública del sitio → deriva `LEGAL_URL` |
| `EXPO_PUBLIC_LEMONSQUEEZY_ENABLED` | (opcional) activa checkout online |

## Archivos

**Nuevos:**
- `Dockerfile` (raíz) — multi-stage Node→nginx.
- `nginx.conf` (raíz o `docker/`) — SPA fallback + estático `/legal`.
- `.dockerignore` — excluye `node_modules`, `.git`, `.expo`, etc.
- `components/CanchaMap.tsx` + `components/CanchaMap.web.tsx`.

**Editados:**
- `app/partido/[id].tsx` — usar `CanchaMap`.
- `constants/config.ts` — `SITE_URL`/`LEGAL_URL` por env.
- `.env.example` — documentar `EXPO_PUBLIC_SITE_URL`.

## Riesgos conocidos (no bloquean)

- **RAM del build:** `expo export --platform web` puede pedir ~1.5–2GB. Si el server es
  chico, asegurar swap/2GB o mover el build a GitHub Actions (plan B).
- **Otros módulos nativos en web:** `expo-notifications`, `expo-haptics`,
  `expo-image-picker`, `expo-blur/glass-effect` degradan suave en web (Expo los maneja).
  El único bloqueante era el mapa. Se hace smoke-test del export local antes de subir.
- **Reset de contraseña en web:** el flujo usa el scheme `faltauno://`, sin efecto en
  browser. Limitación menor; queda anotada, no se resuelve en este alcance.

## Verificación

**Local (antes de subir):**
1. `npx expo export --platform web` compila sin error y produce `dist/`.
2. Copiar `legal/` a `dist/legal/`, servir `dist/` (`npx serve dist`) y navegar:
   feed, detalle de partido (se ve el iframe de Google Maps), `/legal/privacidad.html`.

**En Dokploy (post-deploy):**
1. `https://<dominio>/` carga la app.
2. Deep-link `https://<dominio>/partido/1` recarga sin 404 (SPA fallback OK).
3. `https://<dominio>/legal/privacidad.html`, `/terminos.html`, `/eliminar-cuenta.html` rinden.
4. SSL válido (candado).

## Pasos de despliegue en Dokploy (referencia)

1. Instalar la GitHub App de Dokploy y dar acceso al repo.
2. Crear Project → Application → source = GitHub, repo `falta-uno`, rama `main`.
3. Build type = Dockerfile.
4. Setear build args / env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_SITE_URL`, (`EXPO_PUBLIC_LEMONSQUEEZY_ENABLED`).
5. Domains → agregar el dominio, activar HTTPS (Let's Encrypt).
6. Deploy. Activar auto-deploy en push a `main`.
7. DNS: apuntar registro A del dominio → IP del servidor Dokploy.
8. Actualizar URLs legales en Play Console / App Store Connect al nuevo dominio.

## Fuera de alcance

- Supabase self-hosted (backend sigue en Supabase Cloud).
- Publicación en tiendas (sigue por EAS, aparte).
- Mapa web interactivo real (se usa fallback embed).
