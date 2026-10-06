import { Alert as NativeAlert, Platform, type AlertButton, type AlertOptions } from 'react-native';

export interface Aviso { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions }
const cola: Aviso[] = [];
const listeners = new Set<(aviso: Aviso | null) => void>();
const emitir = () => listeners.forEach(listener => listener(cola[0] ?? null));

export function escucharAvisos(listener: (aviso: Aviso | null) => void) {
  listeners.add(listener);
  listener(cola[0] ?? null);
  return () => { listeners.delete(listener); };
}

export function cerrarAviso(aviso: Aviso) {
  if (cola[0] !== aviso) return;
  cola.shift();
  emitir();
}

/** Web has no native alert; Android native alerts truncate menus to 3 buttons. */
export const Alert = {
  alert(title: string,message?: string,buttons?: AlertButton[],options?: AlertOptions) {
    if (Platform.OS !== 'web' && !(Platform.OS === 'android' && (buttons?.length ?? 0) > 3)) { NativeAlert.alert(title,message,buttons,options); return; }
    cola.push({title,message,buttons:buttons?.length ? buttons : [{text:'Listo'}],options});
    emitir();
  },
};
