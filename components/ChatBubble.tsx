import { Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import ModeracionBoton from '@/components/ModeracionBoton';
import { useTheme } from '@/lib/theme';
import type { Mensaje } from '@/types/database';

const hora = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
};

/**
 * Burbuja de chat con cola. Propio → verde de marca con texto `ink`; ajeno →
 * tarjeta con nombre del autor + botón de moderación. Radio base `rounded-md`
 * (18); solo la esquina inferior del lado del emisor se recorta a una cola sutil.
 */
export default function ChatBubble({ msg, mio }: { msg: Mensaje; mio: boolean }) {
  const c = useTheme();
  return (
    <View className={`max-w-[82%] ${mio ? 'self-end' : 'self-start'} flex-row items-end gap-2`}>
      {!mio ? <Avatar nombre={msg.autor_nombre} size={28} /> : null}
      <View
        className="rounded-md px-3.5 py-2.5"
        style={{
          backgroundColor: mio ? c.primary : c.card,
          borderWidth: mio ? 0 : 1,
          borderColor: c.border,
          // Cola: la esquina inferior del lado del emisor se recorta; la otra sigue el radio base.
          borderBottomRightRadius: mio ? 6 : 18,
          borderBottomLeftRadius: mio ? 18 : 6,
        }}>
        {!mio ? (
          <Text className="mb-0.5 font-body-semibold text-xs text-primary">{msg.autor_nombre}</Text>
        ) : null}
        <Text className={`font-body text-base ${mio ? 'text-ink' : 'text-cream'}`}>{msg.texto}</Text>
        <Text className={`mt-1 text-right font-body text-xs ${mio ? 'text-ink/60' : 'text-muted'}`}>
          {hora(msg.created_at)}
        </Text>
      </View>
      {!mio ? (
        <ModeracionBoton
          tipo="mensaje"
          contenidoId={msg.id}
          autorId={msg.autor_id}
          autorNombre={msg.autor_nombre}
          texto={msg.texto}
          size={16}
        />
      ) : null}
    </View>
  );
}
