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

## 📱 Pantallas

- **Onboarding / Splash** — logo, tagline y accesos (`Entrar` / `Registrarme`).
- **Registro** — nombre, ciudad, posición, nivel, celular y contraseña.
- **Home / Feed** — saludo, banner y "Partidos cerca de vos".
- **Buscar partido** — buscador + filtros por zona, nivel y formato.
- **Crear partido** — formulario completo de publicación.
- **Mi perfil** — avatar, badges, stats (partidos, no-shows, rating).
- **Tab bar** — Home · Buscar · **Crear** (botón "+" en Lima Eléctrica) · Perfil.

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
