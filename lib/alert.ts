import { type AlertButton, type AlertOptions } from 'react-native';

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

/**
 * Avisos y confirmaciones de la app. Misma firma que el `Alert.alert` de React
 * Native, así que migrar una pantalla es cambiar el import y nada más.
 *
 * Siempre pinta el modal propio (`components/AlertProvider`), nunca el diálogo
 * del sistema, por tres razones:
 *
 * 1. `react-native-web` no implementa `Alert`: su `alert()` es una función
 *    vacía. En el navegador el aviso simplemente no aparecería, y la web es por
 *    donde sale el MVP.
 * 2. El diálogo nativo de Android trunca los menús de más de tres botones, y el
 *    de denuncias tiene más motivos que eso. Apple y Google exigen que reportar
 *    contenido sea accesible: esconder opciones es un riesgo de rechazo.
 * 3. El diseño acordado es el mismo en el navegador y en el teléfono.
 *
 * Los avisos se encolan: uno nuevo no pisa al que se está mostrando.
 */
export const Alert = {
  alert(title: string,message?: string,buttons?: AlertButton[],options?: AlertOptions) {
    cola.push({title,message,buttons:buttons?.length ? buttons : [{text:'Listo'}],options});
    emitir();
  },
};
