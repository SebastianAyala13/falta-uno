import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { ScreenHeader } from '@/components/BackButton';
import FadeIn from '@/components/FadeIn';
import Field from '@/components/Field';
import GlowButton from '@/components/GlowButton';
import Screen from '@/components/Screen';
import StarRating from '@/components/StarRating';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

export default function Calificar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const c = useTheme();

  const partido = useStore((s) => s.getPartido(id));
  const calificarPartido = useStore((s) => s.calificarPartido);

  const [estrellas, setEstrellas] = useState(0);
  const [orgEstrellas, setOrgEstrellas] = useState(0);
  const [noShow, setNoShow] = useState(false);
  const [comentario, setComentario] = useState('');

  const enviar = () => {
    if (estrellas === 0) {
      Alert.alert('Ponele estrellas', 'Calificá la experiencia del partido para enviar.');
      return;
    }
    calificarPartido(id, profile?.id ?? 'demo', {
      estrellas,
      organizador_estrellas: orgEstrellas || estrellas,
      hubo_no_show: noShow,
      comentario,
    });
    haptics.success();
    Alert.alert('¡Gracias, parce! 🙌', 'Tu calificación ayuda a que la comunidad juegue mejor.', [
      { text: 'Listo', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Calificar" className="px-6 pb-2 pt-2" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FadeIn delay={50}>
            <Text className="font-body text-sm text-muted">¿Cómo estuvo el partido en</Text>
            <Text className="mb-6 font-display text-2xl uppercase text-cream">{partido?.cancha ?? 'el partido'}?</Text>
          </FadeIn>

          {/* Experiencia */}
          <FadeIn delay={120}>
            <View className="mb-4 items-center rounded-lg border border-border bg-card p-5">
              <Text className="mb-3 font-body-semibold text-sm text-cream">Tu experiencia</Text>
              <StarRating value={estrellas} onChange={setEstrellas} size={40} />
            </View>
          </FadeIn>

          {/* Organizador */}
          <FadeIn delay={180}>
            <View className="mb-4 flex-row items-center rounded-lg border border-border bg-card p-4">
              <Avatar nombre={partido?.organizador?.nombre ?? '?'} size={44} />
              <View className="ml-3 flex-1">
                <Text className="font-body text-xs uppercase tracking-wide text-muted">Organizador</Text>
                <Text className="font-body-bold text-base text-cream">{partido?.organizador?.nombre ?? '—'}</Text>
              </View>
              <StarRating value={orgEstrellas} onChange={setOrgEstrellas} size={22} />
            </View>
          </FadeIn>

          {/* No-show */}
          <FadeIn delay={230}>
            <View className="mb-4 flex-row items-center rounded-lg border border-border bg-card p-4">
              <View className="h-10 w-10 items-center justify-center rounded-sm bg-danger/15">
                <Ionicons name="alert-circle-outline" size={20} color={c.danger} />
              </View>
              <Text className="ml-3 flex-1 font-body-semibold text-sm text-cream">¿Faltó alguien sin avisar?</Text>
              <Switch
                value={noShow}
                onValueChange={setNoShow}
                trackColor={{ false: c.border, true: c.danger }}
                thumbColor={c.cream}
              />
            </View>
          </FadeIn>

          <FadeIn delay={280}>
            <Field label="Comentario (opcional)" icon="chatbubble-outline" placeholder="Contanos qué tal estuvo..." value={comentario} onChangeText={setComentario} multiline />
            <GlowButton label="Enviar calificación" variant="accent" icon="send" onPress={enviar} />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
