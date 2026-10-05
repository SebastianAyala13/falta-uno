import { create } from 'zustand';

/**
 * Diálogos de la app.
 *
 * Existe porque `Alert.alert` de react-native-web es, literalmente, una función
 * vacía: en el navegador no muestra nada. La app llama a Alert en decenas de
 * sitios (errores de pago, confirmaciones, reportar y bloquear contenido), así
 * que en web toda esa capa estaba muda.
 *
 * La firma imita a propósito la de `Alert.alert(titulo, mensaje, botones)` para
 * que migrar cada sitio sea un reemplazo directo, y el host `components/Dialogo`
 * lo pinta con la tipografía y los colores de la marca, igual en celular y web.
 */

/** Mismos estilos que maneja `Alert`, para no reaprender nada. */
export type EstiloBoton = 'default' | 'cancel' | 'destructive';

export interface BotonDialogo {
  text: string;
  onPress?: () => void;
  style?: EstiloBoton;
}

interface DialogoState {
  visible: boolean;
  titulo: string;
  mensaje?: string;
  botones: BotonDialogo[];
  cerrar: () => void;
}

export const useDialogo = create<DialogoState>()((set) => ({
  visible: false,
  titulo: '',
  mensaje: undefined,
  botones: [],
  cerrar: () => set({ visible: false }),
}));

/**
 * Abre el diálogo. Sin botones muestra uno de cierre, igual que `Alert`.
 *
 *   dialogo.mostrar('No se pudo procesar el pago', 'Intentá de nuevo.');
 *   dialogo.mostrar('¿Eliminar la cuenta?', 'Esto no se puede deshacer.', [
 *     { text: 'Cancelar', style: 'cancel' },
 *     { text: 'Eliminar', style: 'destructive', onPress: borrar },
 *   ]);
 */
export const dialogo = {
  mostrar(titulo: string, mensaje?: string, botones?: BotonDialogo[]) {
    useDialogo.setState({
      visible: true,
      titulo,
      mensaje,
      botones: botones && botones.length > 0 ? botones : [{ text: 'Entendido', style: 'cancel' }],
    });
  },
};
