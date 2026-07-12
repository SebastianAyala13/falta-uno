/**
 * Tokens de motion. Los valores son EXACTAMENTE los que hoy están inline en cada
 * call-site (ver docs/DESIGN.md §5). Migrar a estos tokens no cambia el feel.
 * El proyecto no usa withSpring; solo withTiming/withRepeat/withDelay.
 */
import { Easing } from 'react-native-reanimated';

export const Duration = {
  instant: 90,   // press-in tap (GlowButton, GameCard)
  fast: 120,     // press-out GlowButton
  fastCard: 130, // press-out GameCard (distinto de fast a propósito: preserva el feel)
  base: 460,     // entrada de contenido (FadeIn)
  slow: 600,     // fade del splash
  shimmer: 800,  // medio ciclo del shimmer (Skeleton)
  spin: 900,     // una vuelta del spinner (checkout)
  grand: 1100,   // escala del splash (mantener el setTimeout(1150) en sync)
} as const;

export const MotionEasing = {
  entrance: Easing.out(Easing.cubic),  // entrada desacelerada
  pulse: Easing.inOut(Easing.quad),    // ping-pong del shimmer
  linear: Easing.linear,               // rotación constante
} as const;
