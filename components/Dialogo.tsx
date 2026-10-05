import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import GlowButton from '@/components/GlowButton';
import { type BotonDialogo, useDialogo } from '@/lib/dialogo';
import { haptics } from '@/lib/haptics';

/**
 * Host del diálogo. Va montado UNA sola vez en el layout raíz y escucha el store
 * de `lib/dialogo`. Reemplaza a `Alert`, que en web no pinta nada.
 *
 * El marco (fondo oscuro al 70%, tarjeta `bg-background` con borde fuerte,
 * título display en mayúsculas) es el mismo de los modales que ya usan Finanzas
 * y el panel de admin, para que no desentone.
 */
export default function Dialogo() {
  const visible = useDialogo((s) => s.visible);
  const titulo = useDialogo((s) => s.titulo);
  const mensaje = useDialogo((s) => s.mensaje);
  const botones = useDialogo((s) => s.botones);
  const cerrar = useDialogo((s) => s.cerrar);

  const pulsar = (b: BotonDialogo) => {
    haptics.tap();
    cerrar();
    b.onPress?.();
  };

  // Tocar fuera o el botón atrás de Android equivale al botón de cancelar, como
  // en Alert. Si el diálogo no tiene cancelar, solo se cierra.
  const cancelar = () => {
    const botonCancelar = botones.find((b) => b.style === 'cancel');
    cerrar();
    botonCancelar?.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancelar}>
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onPress={cancelar}>
        {/* onPress vacío a propósito: traga el toque para que tocar la tarjeta
            no se propague al fondo y cierre el diálogo. */}
        <Pressable
          onPress={() => {}}
          className="w-full rounded-lg border border-borderStrong bg-background p-6">
          <Text
            className="font-display text-2xl uppercase text-cream"
            style={{ lineHeight: 30, paddingTop: 2 }}>
            {titulo}
          </Text>

          {mensaje ? <Text className="mt-2 font-body text-sm text-muted">{mensaje}</Text> : null}

          {/* Scroll por los menús largos: el de reportar contenido lista todos
              los motivos y se sale de pantalla en celulares pequeños. */}
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            <View className="mt-5">
              {botones.map((b, i) => (
                <View key={`${b.text}-${i}`} className={i > 0 ? 'mt-2' : ''}>
                  {b.style === 'destructive' ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => pulsar(b)}
                      className="items-center rounded-md border border-danger bg-danger/15 py-3.5 active:opacity-80">
                      <Text className="font-body-bold text-base text-danger">{b.text}</Text>
                    </Pressable>
                  ) : (
                    <GlowButton
                      label={b.text}
                      variant={b.style === 'cancel' ? 'outline' : 'primary'}
                      onPress={() => pulsar(b)}
                      haptic={false}
                    />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
