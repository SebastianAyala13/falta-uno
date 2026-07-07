# Despliegue en Dokploy (web + legal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir la versión web de Falta Uno (Expo export) en `/` y las páginas legales en `/legal/` desde una sola app en Dokploy, construida por Dockerfile desde GitHub.

**Architecture:** Dockerfile multi-stage: Node exporta la web (`expo export --platform web` → `dist/`) y copia `legal/*.html` a `dist/legal/`; nginx sirve `dist/` con SPA fallback para expo-router y estático real para `/legal/`. El dominio se configura por env (`EXPO_PUBLIC_SITE_URL`) y el mapa nativo se aísla en un componente con variante `.web` (iframe de Google Maps) para que `react-native-maps` no entre al bundle web.

**Tech Stack:** Expo SDK 54 (`react-native-web`), expo-router (output `single`), Docker (node:20-alpine + nginx:alpine), Dokploy/Traefik.

## Global Constraints

- **Expo SDK instalado = 54** (`expo` `^54.0.35` en package.json). Consultá los docs versionados en https://docs.expo.dev/versions/v54.0.0/ antes de tocar código Expo. (AGENTS.md apunta a v56, pero la versión instalada manda: usá v54.)
- **`web.output` = `"single"`** (SPA) en `app.json`: nginx DEBE hacer fallback a `/index.html` para todas las rutas que no sean archivos reales.
- **Vars públicas = prefijo `EXPO_PUBLIC_`** y se hornean en el bundle al buildear (seguras de exponer). Las secretas NUNCA llevan ese prefijo ni van al cliente.
- **Un dominio, rutas:** web en `/`, legal en `/legal/`. El hostname/SSL real se define en la UI de Dokploy (Traefik), no en el código.
- **Mapa:** en web se usa fallback a Google Maps embed (sin API key); en móvil el `MapView` nativo queda **idéntico**. El texto/ícono del botón "Cómo llegar" debe ser el mismo en ambas plataformas.
- **No hay framework de tests** en el repo (sin `jest`, sin script `test`). La verificación de cada task son comandos de build/smoke, no tests unitarios. No agregar infra de tests (fuera de alcance).
- **Comando de export confirmado:** `npx expo export --platform web` (output por defecto `dist/`).

---

## File Structure

**Nuevos:**
- `components/CanchaMap.tsx` — variante nativa (MapView + Marker + botón "Cómo llegar").
- `components/CanchaMap.web.tsx` — variante web (iframe Google Maps + botón "Cómo llegar").
- `Dockerfile` — build multi-stage node→nginx.
- `nginx.conf` — SPA fallback + estático `/legal/`.
- `.dockerignore` — excluye node_modules, .git, .expo, dist, .env.
- `docs/DESPLIEGUE-DOKPLOY.md` — runbook de despliegue.

**Editados:**
- `app/partido/[id].tsx` — usar `<CanchaMap>` en vez de importar `react-native-maps`.
- `constants/config.ts` — `LEGAL_URL` derivado de `EXPO_PUBLIC_SITE_URL`.
- `.env.example` — documentar `EXPO_PUBLIC_SITE_URL`.

---

### Task 1: Aislar el mapa en un componente por plataforma

Elimina el import directo de `react-native-maps` en la pantalla de detalle (rompe el bundle web) moviéndolo a un componente con variante `.web`.

**Files:**
- Create: `components/CanchaMap.tsx`
- Create: `components/CanchaMap.web.tsx`
- Modify: `app/partido/[id].tsx` (import en línea 6; bloque del mapa en líneas 213–235)

**Interfaces:**
- Produces: `CanchaMap` (default export en ambos archivos) con props
  `{ coords: { latitude: number; longitude: number }; cancha: string; zona: string; onComoLlegar: () => void }`.
- Consumes (en la pantalla): `coords = coordsDePartido(partido)`, `partido.cancha`, `partido.zona`, `abrirMapa` — todos ya existen en `app/partido/[id].tsx`.

- [ ] **Step 1: Crear la variante nativa `components/CanchaMap.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Colors } from '@/constants/colors';

type Props = {
  coords: { latitude: number; longitude: number };
  cancha: string;
  zona: string;
  onComoLlegar: () => void;
};

export default function CanchaMap({ coords, cancha, zona, onComoLlegar }: Props) {
  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-border bg-card">
      <MapView
        style={{ height: 160 }}
        pointerEvents="none"
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}>
        <Marker coordinate={coords} title={cancha} description={zona} />
      </MapView>
      <Pressable
        onPress={onComoLlegar}
        className="flex-row items-center justify-center gap-2 border-t border-border py-3.5 active:bg-border/40">
        <Ionicons name="navigate" size={18} color={Colors.primary} />
        <Text className="font-body-bold text-sm uppercase tracking-wide text-primary">
          Cómo llegar
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Crear la variante web `components/CanchaMap.web.tsx`**

En web, `react-native-maps` no existe. Se renderiza un `<iframe>` de Google Maps embed (sin API key). En un archivo `.web.tsx` compilado por react-dom, `<iframe>` es válido. `expo export` transpila con Babel (no corre `tsc`), así que aunque el editor marque el `<iframe>` sin `lib: DOM`, el build no falla.

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  coords: { latitude: number; longitude: number };
  cancha: string;
  zona: string;
  onComoLlegar: () => void;
};

export default function CanchaMap({ coords, cancha, onComoLlegar }: Props) {
  const src = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}&z=15&output=embed`;
  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-border bg-card">
      <iframe
        title={`Mapa de ${cancha}`}
        src={src}
        loading="lazy"
        style={{ width: '100%', height: 160, border: 0, display: 'block' }}
      />
      <Pressable
        onPress={onComoLlegar}
        className="flex-row items-center justify-center gap-2 border-t border-border py-3.5 active:bg-border/40">
        <Ionicons name="navigate" size={18} color={Colors.primary} />
        <Text className="font-body-bold text-sm uppercase tracking-wide text-primary">
          Cómo llegar
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Editar `app/partido/[id].tsx` — quitar el import nativo y usar `CanchaMap`**

Borrá la línea 6:

```tsx
import MapView, { Marker } from 'react-native-maps';
```

Agregá el import del componente junto al resto de imports de `@/components` (después de la línea 9, `import Avatar from '@/components/Avatar';`):

```tsx
import CanchaMap from '@/components/CanchaMap';
```

Reemplazá el bloque del mapa (líneas 213–235, el `<FadeIn delay={230}>…</FadeIn>` que contiene el `<MapView>`) por:

```tsx
          {/* Ubicación / mapa */}
          <FadeIn delay={230}>
            <CanchaMap
              coords={coords}
              cancha={partido.cancha}
              zona={partido.zona}
              onComoLlegar={abrirMapa}
            />
          </FadeIn>
```

- [ ] **Step 4: Verificar que la pantalla ya no importa `react-native-maps` directamente**

Run: `git grep -n "react-native-maps" app/`
Expected: **sin resultados** (el único import de `react-native-maps` queda ahora en `components/CanchaMap.tsx`).

Run: `git grep -n "react-native-maps" components/`
Expected: una línea → `components/CanchaMap.tsx:...import MapView, { Marker } from 'react-native-maps';`

- [ ] **Step 5: Verificar que el export web compila (aquí es donde antes rompía el mapa)**

Run: `npx expo export --platform web`
Expected: termina con éxito (exit 0) y crea la carpeta `dist/` con `dist/index.html`. No debe aparecer error de resolución/runtime de `react-native-maps` ni `RNMapsAirModule`.

- [ ] **Step 6: Smoke-test manual del fallback web del mapa**

En PowerShell (Windows): copiá lo legal y serví el build para revisar la pantalla en el navegador.

```powershell
New-Item -ItemType Directory -Force dist\legal
Copy-Item legal\*.html dist\legal\ -Force
npx serve dist
```

Abrí `http://localhost:3000`, entrá a un partido (modo demo) y confirmá que el bloque de ubicación muestra el **iframe de Google Maps** y el botón "Cómo llegar". Cerrá el server con Ctrl+C.

- [ ] **Step 7: Limpiar el build de prueba y commitear**

```bash
rm -rf dist
git add components/CanchaMap.tsx components/CanchaMap.web.tsx app/partido/[id].tsx
git commit -m "Aislar mapa en CanchaMap con variante web (iframe) para el build web"
```

---

### Task 2: Dominio configurable por `.env`

`LEGAL_URL` deja de estar hardcodeado y se deriva de `EXPO_PUBLIC_SITE_URL`, con fallback al hosting actual.

**Files:**
- Modify: `constants/config.ts` (líneas 11–18)
- Modify: `.env.example` (insertar tras la línea 5)

**Interfaces:**
- Produces: `LEGAL_URL`, `URL_PRIVACIDAD`, `URL_TERMINOS` (sin cambios de nombre ni tipo; solo cambia cómo se calcula `LEGAL_URL`). Consumidores existentes: `app/(auth)/register.tsx`, `app/(tabs)/perfil.tsx`.

- [ ] **Step 1: Editar `constants/config.ts`**

Reemplazá las líneas 11–18 (el bloque de comentario + las 3 constantes `LEGAL_URL`/`URL_PRIVACIDAD`/`URL_TERMINOS`) por:

```ts
/**
 * URL pública del sitio (app web + páginas legales). Configurable por entorno:
 * poné EXPO_PUBLIC_SITE_URL en `.env` (o en los build args de Dokploy).
 * De ahí se deriva LEGAL_URL = <SITE_URL>/legal (privacidad y términos viven ahí).
 * Fallback sin la var: el hosting actual en GitHub Pages, para no romper builds.
 * Lo usan el registro (aceptación de términos) y el Perfil.
 */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://sebastianayala13.github.io/falta-uno-legal';
export const LEGAL_URL = process.env.EXPO_PUBLIC_SITE_URL ? `${SITE_URL}/legal` : SITE_URL;
export const URL_PRIVACIDAD = `${LEGAL_URL}/privacidad.html`;
export const URL_TERMINOS = `${LEGAL_URL}/terminos.html`;
```

- [ ] **Step 2: Documentar la var en `.env.example`**

Insertá este bloque después de la línea 5 (la de `EXPO_PUBLIC_SUPABASE_ANON_KEY`) y antes de la sección de Lemon Squeezy:

```bash

# ── URL pública del sitio (app web + páginas legales) ─────────────────────────
# Dominio donde Dokploy sirve la web y las páginas legales.
# La app deriva LEGAL_URL = <SITE_URL>/legal para privacidad y términos.
# Vacío/sin definir = cae al hosting actual en GitHub Pages.
# EXPO_PUBLIC_SITE_URL=https://falta-uno.tudominio.com
```

- [ ] **Step 3: Verificar que la var fluye al bundle**

Run (PowerShell): `$env:EXPO_PUBLIC_SITE_URL="https://demo.faltauno.app"; npx expo export --platform web`
Expected: build exitoso.

Run: `git grep -l "demo.faltauno.app/legal/privacidad.html" dist/ 2>$null; Select-String -Path dist\_expo\static\js\web\*.js -Pattern "demo.faltauno.app/legal" -List`
Expected: al menos un archivo del bundle contiene `demo.faltauno.app/legal` → confirma que `EXPO_PUBLIC_SITE_URL` se horneó en `LEGAL_URL`.

- [ ] **Step 4: Limpiar y commitear**

```bash
rm -rf dist
git add constants/config.ts .env.example
git commit -m "LEGAL_URL configurable por EXPO_PUBLIC_SITE_URL"
```

---

### Task 3: Contenerización (Dockerfile + nginx + .dockerignore)

Imagen multi-stage que Dokploy construye desde el repo.

**Files:**
- Create: `Dockerfile`
- Create: `nginx.conf`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: build args `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_LEMONSQUEEZY_ENABLED`.
- Produces: imagen que sirve `dist/` en el puerto 80 con SPA fallback + estático `/legal/`.

- [ ] **Step 1: Crear `Dockerfile`**

```dockerfile
# ---- Stage 1: exportar la web ----
FROM node:20-alpine AS builder
WORKDIR /app

# Vars públicas que se hornean en el bundle al exportar
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_SITE_URL
ARG EXPO_PUBLIC_LEMONSQUEEZY_ENABLED
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_SITE_URL=$EXPO_PUBLIC_SITE_URL \
    EXPO_PUBLIC_LEMONSQUEEZY_ENABLED=$EXPO_PUBLIC_LEMONSQUEEZY_ENABLED

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx expo export --platform web
# Empaquetar las páginas legales bajo /legal
RUN mkdir -p dist/legal && cp legal/*.html dist/legal/

# ---- Stage 2: servir con nginx ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: Crear `nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Páginas legales: archivos reales, SIN fallback SPA
    location /legal/ {
        try_files $uri $uri/ =404;
    }

    # Assets con hash: cache larga
    location /_expo/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Fallback SPA para expo-router (output "single")
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Crear `.dockerignore`**

```gitignore
node_modules
.git
.gitignore
.expo
dist
web-build
.env
.env.*
!.env.example
*.log
.vscode
.idea
android
ios
docs
```

- [ ] **Step 4: Build local de la imagen (si tenés Docker; si no, saltá al Step 6)**

Run:
```bash
docker build \
  --build-arg EXPO_PUBLIC_SUPABASE_URL="https://demo.supabase.co" \
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY="demo" \
  --build-arg EXPO_PUBLIC_SITE_URL="https://demo.faltauno.app" \
  -t faltauno-web .
```
Expected: build termina con éxito; ambas etapas completan (`expo export` + copia legal + nginx).

- [ ] **Step 5: Correr el contenedor y verificar rutas**

Run: `docker run --rm -p 8080:80 faltauno-web`
En otra terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/                         # 200 (app)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/partido/1                 # 200 (SPA fallback, no 404)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/legal/privacidad.html     # 200 (estático)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/legal/terminos.html       # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/legal/eliminar-cuenta.html# 200
```
Expected: todos `200`. Frená el contenedor con Ctrl+C.

- [ ] **Step 6: Commitear**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "Dockerfile multi-stage + nginx (SPA + /legal) para Dokploy"
```

---

### Task 4: Runbook de despliegue en Dokploy

Documentación para dejar el despliegue reproducible y las URLs legales sincronizadas con las tiendas.

**Files:**
- Create: `docs/DESPLIEGUE-DOKPLOY.md`

- [ ] **Step 1: Crear `docs/DESPLIEGUE-DOKPLOY.md`**

```markdown
# Despliegue en Dokploy — web + páginas legales

Una sola **Application** en Dokploy sirve la web de Falta Uno en `/` y las
páginas legales en `/legal/`, construida por Dockerfile desde GitHub.

## Requisitos
- Servidor con Dokploy y **~2GB RAM** libres para el build de Expo (o swap).
- Repo `SebastianAyala13/falta-uno` accesible desde Dokploy.
- Un dominio apuntando (registro **A**) a la IP del servidor.

## Pasos

1. **Conectar GitHub:** en Dokploy, instalá la GitHub App y dale acceso al repo.
2. **Crear la app:** Project → Create → Application. Source = GitHub, repo
   `falta-uno`, branch `main`. Build Type = **Dockerfile** (path `Dockerfile`).
3. **Build args / Environment** (pestaña Environment, como build-time):
   - `EXPO_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
   - `EXPO_PUBLIC_SITE_URL` = `https://<tu-dominio>`
   - `EXPO_PUBLIC_LEMONSQUEEZY_ENABLED` = `1` (opcional)
4. **Dominio:** pestaña Domains → agregá `<tu-dominio>`, puerto interno **80**,
   activá **HTTPS** (Let's Encrypt). Traefik emite el certificado.
5. **Deploy.** Activá **Auto Deploy** para que cada push a `main` redepliegue.
6. **DNS:** registro A del dominio → IP del servidor Dokploy.

## Verificación post-deploy
- `https://<tu-dominio>/` carga la app.
- `https://<tu-dominio>/partido/1` recarga sin 404 (SPA fallback).
- `https://<tu-dominio>/legal/privacidad.html`, `/terminos.html`,
  `/eliminar-cuenta.html` renderizan.
- Candado SSL válido.

## Después de desplegar
- Poné `https://<tu-dominio>/legal/...` como URLs de privacidad, términos y
  eliminación de cuenta en **Play Console** y **App Store Connect**.
- El próximo build EAS de la app tomará `EXPO_PUBLIC_SITE_URL` para los enlaces
  legales internos (registro y perfil).

## Notas
- El build de Expo web puede pedir ~1.5–2GB RAM. Si el server es chico y el
  build muere por OOM, agregá swap o movelo a GitHub Actions (buildear el
  `dist/` en CI y servirlo como estático en Dokploy).
- El reset de contraseña en web usa el scheme `faltauno://` (sin efecto en
  browser). Limitación conocida; la web es un complemento del móvil.
```

- [ ] **Step 2: Commitear**

```bash
git add docs/DESPLIEGUE-DOKPLOY.md
git commit -m "Runbook de despliegue en Dokploy"
```

---

## Self-Review

**Cobertura de la spec:**
- Arquitectura (una app, Dockerfile multi-stage, nginx SPA + /legal) → Task 3. ✓
- Aislar el mapa (CanchaMap nativo + web) → Task 1. ✓
- Dominio configurable por env (`EXPO_PUBLIC_SITE_URL` → `LEGAL_URL`) → Task 2. ✓
- Build args / env vars → Task 3 (Dockerfile ARG/ENV) + Task 4 (Dokploy). ✓
- Verificación (export compila, rutas 200, /legal rinde) → Tasks 1, 3. ✓
- Pasos de despliegue Dokploy + actualizar tiendas → Task 4. ✓
- Riesgos (RAM, reset password web) → documentados en Task 4. ✓

**Placeholders:** `<tu-dominio>` en el runbook es intencional (valor de config del usuario), no un TODO. Sin "TBD"/"implementar luego".

**Consistencia de tipos:** `CanchaMap` usa la misma firma de props en `.tsx` y `.web.tsx` y en el uso desde `app/partido/[id].tsx` (`coords`, `cancha`, `zona`, `onComoLlegar`). `LEGAL_URL`/`URL_PRIVACIDAD`/`URL_TERMINOS` conservan nombre y tipo. Vars `EXPO_PUBLIC_*` idénticas entre `.env.example`, config.ts, Dockerfile y runbook.
