import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/BackButton';
import ChatBubble from '@/components/ChatBubble';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { useChatMensajes } from '@/lib/chat';
import { MENSAJE_BLOQUEO_FILTRO, contieneContenidoObjetable } from '@/lib/moderation';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import type { Mensaje } from '@/types/database';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const c = useTheme();

  const partido = useStore((s) => s.getPartido(id));
  const bloqueados = useStore((s) => s.bloqueados);
  const { mensajes: mensajesRaw, enviar: enviarMensaje, enVivo } = useChatMensajes(id);

  // Ocultamos los mensajes de usuarios bloqueados (moderación UGC)
  const mensajes = mensajesRaw.filter((m) => !bloqueados.includes(m.autor_id));

  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Mensaje>>(null);

  const enviar = () => {
    if (!texto.trim()) return;
    if (contieneContenidoObjetable(texto)) {
      setError(MENSAJE_BLOQUEO_FILTRO);
      return;
    }
    setError(null);
    enviarMensaje({ id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos' }, texto);
    setTexto('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <Screen edges={['top']} glow={false}>
      {/* Header del parche */}
      <ScreenHeader borderBottom backClassName="mr-2" className="px-4 pb-3 pt-1">
        <View className="flex-1 flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-sm bg-primary/15">
            <Ionicons name="football" size={20} color={c.primary} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-body-bold text-base text-cream" numberOfLines={1}>
              {partido?.cancha ?? 'Chat del partido'}
            </Text>
            <View className="flex-row items-center gap-1.5">
              {enVivo ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
              <Text className="font-body text-xs text-muted">{enVivo ? 'En vivo' : 'Chat del parche'}</Text>
            </View>
          </View>
        </View>
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        className="flex-1">
        <FlatList
          ref={listRef}
          data={mensajes}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              titulo="Rompé el hielo"
              texto="Saludá al parche y arrancá la conversación."
            />
          }
          renderItem={({ item }) => (
            <ChatBubble msg={item} mio={item.autor_id === (profile?.id ?? 'demo')} />
          )}
        />

        {/* Input */}
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card">
          <ErrorBanner message={error} className="mx-3 mt-2" />
          <View className="flex-row items-end gap-2 px-3 py-2">
            <TextInput
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                if (error) setError(null);
              }}
              placeholder="Escribí algo…"
              placeholderTextColor={c.muted}
              multiline
              className="max-h-28 flex-1 rounded-sm border border-border bg-background px-4 py-3 font-body text-base text-cream"
            />
            <Pressable
              onPress={enviar}
              disabled={!texto.trim()}
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: texto.trim() ? c.primary : c.border }}>
              <Ionicons name="send" size={18} color={texto.trim() ? c.ink : c.muted} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
