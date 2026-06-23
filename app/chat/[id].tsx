import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import Screen from '@/components/Screen';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useChatMensajes } from '@/lib/chat';
import { useStore } from '@/lib/store';
import type { Mensaje } from '@/types/database';

const hora = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
};

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const partido = useStore((s) => s.getPartido(id));
  const { mensajes, enviar: enviarMensaje, enVivo } = useChatMensajes(id);

  const [texto, setTexto] = useState('');
  const listRef = useRef<FlatList<Mensaje>>(null);

  const enviar = () => {
    if (!texto.trim()) return;
    enviarMensaje({ id: profile?.id ?? 'demo', nombre: profile?.nombre ?? 'Vos' }, texto);
    setTexto('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <Screen edges={['top']} glow={false}>
      {/* Header */}
      <View className="flex-row items-center border-b border-border px-4 pb-3 pt-1">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="chevron-back" size={22} color={Colors.cream} />
        </Pressable>
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Ionicons name="football" size={20} color={Colors.primary} />
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
            <View className="mt-24 items-center">
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.muted} />
              <Text className="mt-3 text-center font-body text-sm text-muted">
                Rompé el hielo, parce.{'\n'}Saludá al parche 👋
              </Text>
            </View>
          }
          renderItem={({ item }) => <Burbuja msg={item} mio={item.autor_id === (profile?.id ?? 'demo')} />}
        />

        {/* Input */}
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card">
          <View className="flex-row items-end gap-2 px-3 py-2">
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Escribí algo…"
              placeholderTextColor={Colors.muted}
              multiline
              className="max-h-28 flex-1 rounded-2xl border border-border bg-background px-4 py-3 font-body text-base text-cream"
            />
            <Pressable
              onPress={enviar}
              disabled={!texto.trim()}
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: texto.trim() ? Colors.primary : Colors.border }}>
              <Ionicons name="send" size={18} color={texto.trim() ? Colors.background : Colors.muted} />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Burbuja({ msg, mio }: { msg: Mensaje; mio: boolean }) {
  return (
    <View className={`max-w-[82%] ${mio ? 'self-end' : 'self-start'} flex-row items-end gap-2`}>
      {!mio ? <Avatar nombre={msg.autor_nombre} size={28} /> : null}
      <View
        className="rounded-2xl px-3.5 py-2.5"
        style={{
          backgroundColor: mio ? Colors.primary : Colors.card,
          borderWidth: mio ? 0 : 1,
          borderColor: Colors.border,
          borderBottomRightRadius: mio ? 4 : 16,
          borderBottomLeftRadius: mio ? 16 : 4,
        }}>
        {!mio ? (
          <Text className="mb-0.5 font-body-semibold text-xs text-primary">{msg.autor_nombre}</Text>
        ) : null}
        <Text className={`font-body text-[15px] ${mio ? 'text-background' : 'text-cream'}`}>{msg.texto}</Text>
        <Text className={`mt-1 text-right font-body text-[10px] ${mio ? 'text-background/60' : 'text-muted'}`}>
          {hora(msg.created_at)}
        </Text>
      </View>
    </View>
  );
}
