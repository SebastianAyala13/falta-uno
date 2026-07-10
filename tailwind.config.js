/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind escanea estos archivos para generar las clases de Tailwind
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (no el default 'media'): el runtime web de NativeWind maneja el color
  // scheme manualmente y con 'media' tira "Cannot manually set color scheme". La app
  // tematiza con variables CSS (ver themes.ts), no usa la variante `dark:`, así que
  // esto no cambia nada visual — solo evita el error en web.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Tokens de marca — leen del tema activo vía variables CSS (ver themes.ts).
        // Esto hace que cambiar de tema actualice TODAS las clases en vivo.
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        primary2: 'rgb(var(--c-primary2) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        background: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        cream: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        borderStrong: 'rgb(var(--c-border-strong) / <alpha-value>)',
        // texto/ícono sobre superficies de color (CTA accent/primary)
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        // semánticos (constantes en todos los temas)
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      borderRadius: {
        // Radios fijos del sistema de diseño
        sm: '12px', // inputs, chips, badges
        md: '18px', // tarjetas pequeñas, stat cards
        lg: '24px', // tarjetas grandes, hero, modales
      },
      fontFamily: {
        // Fuente display (titulares) y body (texto)
        display: ['Anton'],
        body: ['Archivo'],
        'body-medium': ['Archivo-Medium'],
        'body-semibold': ['Archivo-SemiBold'],
        'body-bold': ['Archivo-Bold'],
      },
    },
  },
  plugins: [],
};
