import { LinearGradient } from 'expo-linear-gradient';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  /** Bordes seguros a respetar. Por defecto solo arriba. */
  edges?: Edge[];
  /** Muestra los "glows" decorativos de fondo (estadio de noche). */
  glow?: boolean;
}

/**
 * Contenedor base de pantalla con el ambiente "estadio de noche":
 * degradado profundo Negro Tribuna + halos de luz Esmeralda / Lima.
 */
export default function Screen({
  children,
  edges = ['top'],
  glow = true,
  style,
  ...rest
}: ScreenProps) {
  return (
    <View className="flex-1 bg-background">
      {/* Degradado base */}
      <LinearGradient
        colors={['#0B0F0D', '#0C1410', '#0B0F0D']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Halos de luz decorativos */}
      {glow ? (
        <>
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              top: -140,
              right: -100,
              width: 320,
              height: 320,
              backgroundColor: '#10B981',
              opacity: 0.16,
            }}
          />
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              bottom: -160,
              left: -120,
              width: 300,
              height: 300,
              backgroundColor: '#C6FF3D',
              opacity: 0.06,
            }}
          />
        </>
      ) : null}

      <SafeAreaView edges={edges} className="flex-1" style={style} {...rest}>
        {children}
      </SafeAreaView>
    </View>
  );
}
