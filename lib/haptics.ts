/**
 * Vocabulario háptico. Cada verbo envuelve exactamente una llamada de expo-haptics
 * (ver docs/DESIGN.md §6). Fire-and-forget con .catch no-op: en web expo-haptics es
 * no-op y así no genera unhandled rejections.
 */
import * as Haptics from 'expo-haptics';

const run = (p: Promise<unknown>) => {
  p.catch(() => {});
};

export const haptics = {
  tap: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),   // CTA primario
  light: () => run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),  // like/toggle sutil
  select: () => run(Haptics.selectionAsync()),                               // cambio de valor / tick
  success: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),  // reservado, sin cablear
  error: () => run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),   // reservado, sin cablear
};
