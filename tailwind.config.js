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
        background: '#0B0F0D', // Negro Tribuna
        accent: '#C6FF3D', // Lima Eléctrica
        secondary: '#047857', // Verde Bosque
        cream: '#F6F9F6', // Crema Cal (texto claro)
        // grises de apoyo para tarjetas / bordes sobre el fondo oscuro
        surface: '#12181500',
        card: '#141A17',
        muted: '#8A968F',
        border: '#1F2A24',
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
