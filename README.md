# ⚽ Falta Uno

**Vos ponés las ganas, nosotros el equipo.**

App móvil para cuadrar partidos de fútbol y encontrar jugadores en Colombia — arrancando en **Pereira, Risaralda**.

Construida con **React Native + Expo**, navegación basada en archivos con **Expo Router**, estilos con **NativeWind** (Tailwind para React Native) y backend en **Supabase**.

---

## 🎨 Marca

| Token | Color | Uso |
|-------|-------|-----|
| Esmeralda | `#10B981` | Primario |
| Negro Tribuna | `#0B0F0D` | Fondo |
| Lima Eléctrica | `#C6FF3D` | Acento / CTA |
| Verde Bosque | `#047857` | Fondo secundario |
| Crema Cal | `#F6F9F6` | Texto claro |

**Tipografías:** Anton (titulares) · Archivo (texto).

---

## 📱 Pantallas y funcionalidades

- **Splash animado** — logo con glow pulsante; redirige según haya sesión.
- **Onboarding / Welcome** — marca, tagline, mini-features y acceso como invitado.
- **Login / Registro** — autenticación **real con Supabase** (email + contraseña),
  validación, errores en español y modo demo cuando no hay backend.
- **Home / Feed** — saludo, hero CTA con gradiente, stats rápidas y partidos cerca.
- **Buscar partido** — buscador + filtros por zona, nivel y formato (en vivo).
- **Crear partido** — formulario que **publica un partido real** en el store.
- **Detalle de partido** — roster visual de cupos, organizador, **mapa de la cancha**
  con "Cómo llegar", acceso al **chat**, desglose de precio e **inscripción**.
- **Chat del parche** — chat por partido con **Supabase Realtime** (en vivo entre
  dispositivos) y fallback local-first automático si no hay backend.
- **Recordatorios** — al inscribirte, se programa una **notificación local 2 h antes**
  del partido (`expo-notifications`).
- **Fotos** — foto de **perfil** y de **cancha** con `expo-image-picker`.
- **Reputación** — calificá el partido y al organizador con estrellas, reportá
  no-shows y dejá comentario (pantalla Calificar, desde Mis Partidos).
- **Checkout / Pago** — **efectivo en cancha** y **pago online con PayU**
  (Nequi, PSE o tarjeta, próximamente), con comprobante y referencia. _(El
  online se activa con `EXPO_PUBLIC_PAYU_ENABLED`; ver
  [`docs/PAYU-SETUP.md`](docs/PAYU-SETUP.md).)_
- **Mis partidos** — los partidos en los que te inscribiste.
- **Mis pagos** — historial de comprobantes con estado.
- **Editar perfil** — actualizá nombre, ciudad, celular, posición y nivel (sincroniza
  con Supabase).
- **Mi perfil** — avatar con anillo, badges, stats y cierre de sesión.

> **Facilidad de uso:** selectores nativos de **fecha y hora** al crear partido,
> **pull-to-refresh** en los feeds, **compartir partido** (WhatsApp/etc.),
> animaciones de press con háptica y cero botones muertos.
- **Tab bar premium** — Home · Buscar · **Crear** (botón "+" en Lima Eléctrica) · Perfil,
  con fondo translúcido (blur).

### ✨ Nivel premium
Rediseño total "estadio de noche": fondos con gradientes y halos de luz,
glassmorphism, animaciones de entrada escalonadas (Reanimated), botones con glow,
y **feedback háptico** en las acciones clave.

### 🔐 Seguridad & 💳 Pagos
- **Auth**: Supabase Auth (sesión persistida en el dispositivo) + RLS por usuario
  en todas las tablas (definido en las migraciones de `supabase/migrations/`).
- **Pagos**: el medio real hoy es **efectivo en cancha** (acuerdo con el
  organizador, sin custodia de dinero); **pago online con PayU** (próximamente)
  abrirá un checkout externo confirmado por webhook en el servidor. La llave
  secreta de la pasarela **nunca** va en el cliente y el estado "aprobado"
  **solo** lo escribe el servidor.

---

## 🚀 Cómo correr el proyecto

### 1. Requisitos
- [Node.js](https://nodejs.org/) 18 o superior
- La app **Expo Go** en tu celular (Android / iOS), o un emulador

### 2. Instalar dependencias
```bash
cd falta-uno
npm install
```

### 3. (Opcional) Configurar Supabase
La app funciona con **datos de prueba (mock)** sin backend. Para conectar Supabase real:

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Copiá `.env.example` a `.env` y pegá tus credenciales:
   ```bash
   cp .env.example .env
   ```
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```
   (las encontrás en **Dashboard → Settings → API**).
3. Creá las tablas aplicando las migraciones con el CLI de Supabase: `pnpm supabase link
   --project-ref <tu-ref>` y luego `pnpm supabase db push` (ver [`supabase/migrations/`](./supabase/migrations/)).
4. Para probar el login sin esperar correos de confirmación, en **Authentication →
   Providers → Email** desactivá "Confirm email" (solo en desarrollo).

> Sin credenciales, la app corre en **modo demo**: registro/login funcionan contra
> el almacenamiento local del dispositivo, así podés probar todo el flujo ya mismo.

### 4. Arrancar la app
```bash
npx expo start
```
Escaneá el QR con **Expo Go** o presioná `a` (Android) / `i` (iOS) / `w` (web).

---

## 🚢 Publicar en App Store y Play Store

El proyecto ya está configurado para builds de producción con **EAS** (bundle IDs,
versiones, permisos, ícono y splash con el logo, `eas.json`).

### 1. Instalar y entrar
```bash
npm install -g eas-cli
eas login           # con tu cuenta de Expo (expo.dev)
eas init            # vincula el repo y agrega tu projectId al app.json
```

### 2. Antes del primer build
- **IDs de la app** (ya puestos, cambialos si querés): iOS `com.faltauno.app`,
  Android `com.faltauno.app` en `app.json`.
- **Google Maps (Android):** reemplazá `TU_GOOGLE_MAPS_ANDROID_API_KEY` en
  `app.json` → `android.config.googleMaps.apiKey` por tu key de Google Cloud
  (Maps SDK for Android). iOS usa Apple Maps, no necesita key.
- **Supabase:** poné las credenciales reales en `.env` (ver arriba) para que auth,
  chat y datos funcionen en producción.

### 3. Compilar
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```
Para probar antes en tu dispositivo sin las stores:
```bash
eas build --platform android --profile preview   # genera un APK instalable
```

### 4. Subir a las tiendas
```bash
eas submit --platform ios       # necesita cuenta Apple Developer (US$99/año)
eas submit --platform android   # necesita cuenta Google Play (US$25 única vez)
```

> **Versionado:** `eas.json` usa `autoIncrement` en producción, así que el
> build/version code sube solo en cada build. Subí `version` en `app.json` para
> los releases visibles al usuario (ej. 1.0.1).

### ✅ Checklist de cumplimiento (App Store + Play Store)
Lo que ya está resuelto en la app y lo que tenés que completar vos al publicar:

**Listo en el código:**
- **Permisos con descripción** (fotos) en `app.json` (iOS `infoPlist` + plugin de
  image-picker). Solo se piden permisos que la app usa.
- **Eliminar cuenta dentro de la app** (Perfil → Eliminar cuenta) — **requisito
  obligatorio** de Apple y Google para apps con login.
- **Cifrado:** `ITSAppUsesNonExemptEncryption: false` (evita el trámite de
  export compliance de Apple).
- **Login propio** (email/contraseña): no usamos login social, así que **no** se
  exige "Sign in with Apple".
- **Pagos:** el flujo cobra un **servicio del mundo real** (cupo en una cancha),
  que está **exento de las compras in-app (IAP)** de Apple. El pago online es
  real (PayU, en navegador externo); no hay pagos simulados.

**Recursos que ya dejé listos en el repo:**
- **Páginas legales** en `legal/` (`privacidad.html`, `terminos.html`,
  `eliminar-cuenta.html`) — hosteálas (ej. GitHub Pages, Vercel, tu dominio) y
  reemplazá los `[PLACEHOLDERS]` (nombre legal, correo, fecha, URL).
- **Edge Function de borrado** en `supabase/functions/delete-user/` —
  desplegá con `supabase functions deploy delete-user` (la app ya la invoca).
- Recordatorio de pago **transparente** ("no custodiamos dinero") en el checkout.
- **Recuperación de contraseña** (login → "¿Olvidaste tu contraseña?").
- **Privacy manifest de iOS** declarado en `app.json` (`ios.privacyManifests`).

**Tenés que completar al publicar (fuera del código):**
1. **Hostear** las 3 páginas legales y poner sus URLs en App Store Connect y
   Play Console. Actualizá el link de la app en `app/(tabs)/perfil.tsx`
   (`abrirPrivacidad`) por tu URL real.
2. **Formularios de datos:** *App Privacy* (Apple) y *Data safety* (Google),
   declarando: email, nombre, celular, fotos y contenido que sube el usuario,
   y los proveedores (Supabase, etc.).
3. **Cuenta demo para revisores:** la app tiene **modo invitado** (Welcome →
   "Echar un vistazo como invitado") que da acceso a todo sin registro — indicáselo
   al revisor, o creá un usuario demo y pasá las credenciales en las notas de revisión.
4. **Ficha de tienda:** 2+ capturas reales por tienda, descripción, categoría
   (Deportes), correo de soporte, **clasificación por edad** y países.
5. **Google Maps API key** (Android) en `app.json` (ver arriba).

**Requisitos técnicos a tener en cuenta:**
- **Android:** se publica en **.aab** (EAS production ya lo genera) y apunta a
  **API 35 (Android 15)** con SDK 54. Si tu cuenta de Play Console es nueva
  (posterior a nov-2023), Google exige una **prueba cerrada con ≥12 testers por
  14 días** antes de producción.
- **iOS:** desde el **28-abr-2026** Apple exige compilar con **Xcode 26 / SDK iOS 26+**.
  EAS usa imágenes actualizadas; corré el build con la imagen más reciente.

---

## 🗂️ Estructura del proyecto

```
falta-uno/
├── app/                    # Rutas (Expo Router, file-based)
│   ├── _layout.tsx         # Layout raíz (fuentes + Stack)
│   ├── index.tsx           # Onboarding / Splash
│   ├── register.tsx        # Registro
│   └── (tabs)/             # Navegación por tabs
│       ├── _layout.tsx     # Tab bar (Home, Buscar, Crear, Perfil)
│       ├── index.tsx       # Home / Feed
│       ├── buscar.tsx      # Buscar partido
│       ├── crear.tsx       # Crear partido
│       └── perfil.tsx      # Mi perfil
├── components/             # Componentes reutilizables (Button, GameCard, ...)
├── constants/             # colors.ts y config.ts (tokens de marca)
├── lib/                   # supabase.ts y mockData.ts
├── types/                 # database.ts (tipos de Supabase)
├── supabase/             # migrations/, functions/, config.toml, seed-demo.sql
├── tailwind.config.js     # Tema de NativeWind con tokens de marca
└── global.css             # Directivas de Tailwind
```

---

## 🛠️ Stack técnico

- **React Native + Expo** (SDK 56)
- **Expo Router** — navegación basada en archivos
- **NativeWind** — Tailwind CSS para React Native
- **Supabase** — auth, base de datos y realtime
- **TypeScript** — tipado en todo el proyecto

---

## 📌 Notas

- Los datos de partidos y perfil son **mock** (en `lib/mockData.ts`) mientras no conectes Supabase.
- Los formularios de registro y creación ya están cableados a la navegación; los `TODO:` marcan dónde enganchar las queries reales de Supabase.
- **Mapas**: en **Expo Go** funcionan sin configuración. Para un build de producción
  (EAS) en Android necesitás una **Google Maps API key** en `app.json`.
- **Notificaciones**: se usan **locales programadas** (funcionan en Expo Go). Las
  **push remotas** requieren un build de desarrollo/EAS y un token de Expo Push.

Hecho con 💚 para la gallada de Pereira.
