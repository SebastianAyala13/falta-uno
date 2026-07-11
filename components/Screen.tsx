import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

interface ScreenProps extends ViewProps {
  /** Bordes seguros a respetar. Por defecto solo arriba. */
  edges?: Edge[];
  /** Muestra los "glows" decorativos de fondo (estadio de noche). */
  glow?: boolean;
  /** Ancho máximo del contenido en pantallas anchas (web/tablet). Default 640. */
  maxWidth?: number;
}

/** Mezcla un color hex con un alfa (0-1) en formato rgba. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Contenedor base de pantalla con el ambiente de marca: degradado del fondo del
 * tema + halos de luz con los colores activos. Sigue el tema (claro u oscuro).
 */
export default function Screen({ children, edges = ['top'], glow = true, maxWidth = 640, style, ...rest }: ScreenProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // En pantallas anchas (web/tablet) centramos el contenido como una columna;
  // en teléfonos ocupa todo el ancho. El fondo/glows sí llenan toda la pantalla.
  const centrar = width > maxWidth;

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[t.background, t.card, t.background]}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      {glow ? (
        <>
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{ top: -140, right: -100, width: 320, height: 320, backgroundColor: withAlpha(t.primary, 0.16) }}
          />
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{ bottom: -160, left: -120, width: 300, height: 300, backgroundColor: withAlpha(t.accent, 0.06) }}
          />
        </>
      ) : null}

      <SafeAreaView
        edges={edges}
        className="flex-1"
        style={[
          centrar ? { width: '100%', maxWidth, alignSelf: 'center' } : null,
          style,
        ]}
        {...rest}>
        {children}
      </SafeAreaView>
    </View>
  );
}
