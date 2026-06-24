/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind escanea estos archivos para generar las clases de Tailwind
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Tokens de marca — Falta Uno
        primary: '#10B981', // Esmeralda
        primary2: '#34D399', // Esmeralda clara
        background: '#0B0F0D', // Negro Tribuna
        accent: '#C6FF3D', // Lima Eléctrica (urgencia + CTA)
        secondary: '#047857', // Verde Bosque
        cream: '#F6F9F6', // Crema Cal (texto principal)
        // grises de apoyo para tarjetas / bordes sobre el fondo oscuro
        card: '#141A17',
        muted: '#9AA69F', // subido para contraste AA
        border: '#1F2A24',
        borderStrong: '#243A2F',
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
