import type { Formato } from '@/constants/config';
import type { DiaConfig } from '@/lib/disponibilidad';
import type { Amenidades } from '@/types/database';

/** Lo que el dueño puede editar en la pantalla de su cancha. */
export interface DatosFormulario {
  nombre: string;
  direccion: string;
  zona: string | null;
  telefono: string;
  descripcion: string;
  formatos: Formato[];
  amenidades: Amenidades;
  fotos: string[];
  dias: DiaConfig[];
}

/**
 * Huella estable del formulario, para comparar lo que hay en pantalla con lo
 * que se cargó y saber si quedó algo sin guardar.
 *
 * Normaliza lo que cambia de forma sin cambiar de significado. Si no lo hiciera,
 * la confirmación saltaría cuando no corresponde y el dueño aprendería a
 * descartarla sin leerla, que es peor que no tenerla:
 *
 * - Las amenidades apagadas se descartan. `AmenidadPicker` escribe `false` donde
 *   antes no había clave, así que prender y apagar una dejaba el objeto distinto
 *   sin que el dueño haya cambiado nada.
 * - Los formatos se ordenan: tocar 5v5 y 7v7 en otro orden no es un cambio.
 * - Los textos se recortan, igual que hace el guardado.
 * - De un día cerrado no se mira el horario: no se va a guardar igual.
 */
export function huellaFormulario(d: DatosFormulario): string {
  return JSON.stringify({
    nombre: d.nombre.trim(),
    direccion: d.direccion.trim(),
    zona: d.zona,
    telefono: d.telefono.trim(),
    descripcion: d.descripcion.trim(),
    formatos: [...d.formatos].sort(),
    amenidades: Object.entries(d.amenidades)
      .filter(([, valor]) => !!valor)
      .map(([clave]) => clave)
      .sort(),
    fotos: d.fotos,
    dias: d.dias.map((dia) =>
      dia.abierto ? [dia.apertura, dia.cierre, dia.precio.trim(), dia.duracion] : null,
    ),
  });
}
