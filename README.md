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
- **Detalle de partido** — roster visual de cupos, organizador, desglose de precio
  e **inscripción**.
- **Checkout / Pago** — métodos colombianos (**Nequi, PSE, Tarjeta, Efectivo**),
  procesamiento animado y **comprobante** con referencia. _(Pago simulado,
  arquitectura lista para Wompi.)_
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
  en todas las tablas (`supabase/schema.sql`).
- **Pagos**: el procesamiento es **simulado** (`lib/payments.ts`) pero el modelo de
  datos (`pagos`), el desglose con comisión de servicio y el comprobante son reales.
  Para producción se enchufa Wompi desde un backend (la llave privada **nunca** va
  en el cliente).

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
3. Creá las tablas ejecutando [`supabase/schema.sql`](./supabase/schema.sql) en el **SQL Editor** de Supabase.
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
├── supabase/             # schema.sql
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

Hecho con 💚 para la gallada de Pereira.
