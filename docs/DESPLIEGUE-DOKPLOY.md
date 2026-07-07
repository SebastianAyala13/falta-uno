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
