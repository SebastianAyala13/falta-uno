import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import FadeIn from '@/components/FadeIn';
import Screen from '@/components/Screen';
import { THEMES } from '@/constants/themes';
import { haptics } from '@/lib/haptics';
import { urgencyLabel } from '@/lib/format';
import { useTheme, useThemeMeta } from '@/lib/theme';
import { useStore } from '@/lib/store';

export default function Apariencia() {
  const theme = useTheme();
  const activo = useThemeMeta();
  const setTema = useStore((s) => s.setTema);

  const elegir = (id: string) => {
    haptics.select();
    setTema(id);
  };

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 pb-2 pt-1">
        <BackButton className="mr-3" />
        <View>
          <Text className="font-display text-3xl uppercase text-cream">Apariencia</Text>
          <Text className="font-body text-sm text-muted">Elegí el color de tu Falta Uno</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <FadeIn delay={40}>
          <View className="mb-6 overflow-hidden rounded-lg border border-borderStrong bg-card p-5">
            <Text className="font-body text-xs uppercase tracking-widest text-muted">Vista previa</Text>
            <Text className="mt-1 font-display text-3xl uppercase text-cream">{`${urgencyLabel(1, { urgentLabel: '¡Falta 1, parce!' })} 🔥`}</Text>
            <View className="mt-4 flex-row gap-3">
              <View className="rounded-sm bg-primary px-4 py-2.5">
                <Text className="font-body-bold text-sm uppercase text-ink">Unirme</Text>
              </View>
              <View className="rounded-sm bg-accent px-4 py-2.5">
                <Text className="font-body-bold text-sm uppercase text-ink">Crear</Text>
              </View>
              <View className="rounded-sm border border-border px-4 py-2.5">
                <Text className="font-body-bold text-sm uppercase text-cream">Ver</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* Grilla de temas */}
        <Text className="mb-3 font-body-semibold text-xs uppercase tracking-widest text-muted">Temas</Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {THEMES.map((t, i) => {
            const sel = activo.id === t.id;
            return (
              <FadeIn key={t.id} delay={80 + i * 50} style={{ width: '47%' }}>
                <Pressable
                  onPress={() => elegir(t.id)}
                  className="overflow-hidden rounded-md border bg-card p-4"
                  style={{ borderColor: sel ? t.palette.primary : theme.border, borderWidth: sel ? 2 : 1 }}>
                  {/* muestras de color */}
                  <View className="mb-3 flex-row gap-1.5">
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.palette.primary }} />
                    <View style={{ width: 20, height: 34, borderRadius: 8, backgroundColor: t.palette.accent }} />
                    <View style={{ width: 14, height: 34, borderRadius: 7, backgroundColor: t.palette.secondary }} />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-body-bold text-base text-cream">{t.label}</Text>
                    {sel ? (
                      <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: t.palette.primary }}>
                        <Ionicons name="checkmark" size={15} color={t.palette.ink} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </FadeIn>
            );
          })}
        </View>

        <Text className="mt-6 text-center font-body text-xs text-muted">
          Tu color queda guardado para la próxima vez ⚽
        </Text>
      </ScrollView>
    </Screen>
  );
}
