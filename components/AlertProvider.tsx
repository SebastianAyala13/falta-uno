import { useReducedMotion } from 'react-native-reanimated';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Alert, cerrarAviso, escucharAvisos, type Aviso } from '@/lib/alert';
import { useTheme } from '@/lib/theme';

export default function AlertProvider({children}: {children:ReactNode}) {
  const c = useTheme();
  const reducedMotion = useReducedMotion();
  const [aviso,setAviso] = useState<Aviso | null>(null);
  useEffect(() => escucharAvisos(setAviso),[]);
  const cancelar = () => {
    if (!aviso) return;
    const cancel = aviso.buttons.find(button=>button.style === 'cancel');
    if (!cancel && !aviso.options?.cancelable) return;
    cerrarAviso(aviso);
    cancel?.onPress?.();
    aviso.options?.onDismiss?.();
  };
  return <>
    {children}
    {aviso ? <Modal transparent visible animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={cancelar}>
      <View className="flex-1 items-center justify-center px-6" style={{backgroundColor:c.background+'CC'}}>
        <View accessibilityRole="alert" accessibilityLabel={aviso.title} accessibilityViewIsModal
          className="w-full max-w-md rounded-lg border border-borderStrong bg-card p-6">
          <Text accessibilityRole="header" className="font-display text-xl uppercase text-cream">{aviso.title}</Text>
          {aviso.message ? <Text className="mt-3 font-body text-base text-cream">{aviso.message}</Text> : null}
          <ScrollView style={{maxHeight:320}} className="mt-4">
            {aviso.buttons.map((button,index) => <Pressable key={index} accessibilityRole="button"
              className="mb-2 rounded-sm border border-border px-4 py-3"
              onPress={() => {
                cerrarAviso(aviso);
                try {
                  Promise.resolve(button.onPress?.()).catch(e => Alert.alert('No pudimos completar la acción',e instanceof Error ? e.message : 'Reintentá.'));
                } catch(e) { Alert.alert('No pudimos completar la acción',e instanceof Error ? e.message : 'Reintentá.'); }
              }}>
              <Text className="text-center font-body-semibold text-base"
                style={{color:button.style === 'destructive' ? c.danger : button.style === 'cancel' ? c.muted : c.primary}}>{button.text ?? 'Listo'}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal> : null}
  </>;
}
