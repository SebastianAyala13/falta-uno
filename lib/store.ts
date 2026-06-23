import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { COMISION_SERVICIO, CUPOS_POR_FORMATO, type Formato, type Nivel } from '@/constants/config';
import { partidosDisponibles } from '@/lib/mockData';
import type { EstadoPago, Pago, PartidoConOrganizador } from '@/types/database';

export interface NuevoPartido {
  cancha: string;
  zona: string;
  fecha: string;
  hora: string;
  formato: Formato;
  nivel: Nivel;
  precio: number;
  descripcion: string;
}

interface StoreState {
  partidos: PartidoConOrganizador[];
  inscritos: string[]; // ids de partidos a los que el usuario se unió
  pagos: Pago[];

  getPartido: (id: string) => PartidoConOrganizador | undefined;
  estaInscrito: (id: string) => boolean;
  misPartidos: () => PartidoConOrganizador[];

  crearPartido: (data: NuevoPartido, organizador: { id: string; nombre: string }) => string;
  /** Inscribe al usuario y registra el pago. Devuelve el pago creado. */
  inscribirse: (
    partidoId: string,
    jugadorId: string,
    medio: string,
    estado: EstadoPago,
  ) => Pago;
  salirse: (partidoId: string, jugadorId: string) => void;
}

const genId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
const genRef = () => 'FU-' + Math.random().toString(36).slice(2, 8).toUpperCase();

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      partidos: partidosDisponibles,
      inscritos: [],
      pagos: [],

      getPartido: (id) => get().partidos.find((p) => p.id === id),
      estaInscrito: (id) => get().inscritos.includes(id),
      misPartidos: () => get().partidos.filter((p) => get().inscritos.includes(p.id)),

      crearPartido: (data, organizador) => {
        const id = genId('p');
        const nuevo: PartidoConOrganizador = {
          id,
          organizador_id: organizador.id,
          cancha: data.cancha,
          zona: data.zona,
          fecha: data.fecha,
          hora: data.hora,
          formato: data.formato,
          nivel: data.nivel,
          precio: data.precio,
          cupos_totales: CUPOS_POR_FORMATO[data.formato],
          cupos_ocupados: 1, // el organizador cuenta como inscrito
          descripcion: data.descripcion || null,
          created_at: new Date().toISOString(),
          organizador: { nombre: organizador.nombre, avatar_url: null, rating: 5 },
        };
        set((s) => ({ partidos: [nuevo, ...s.partidos], inscritos: [...s.inscritos, id] }));
        return id;
      },

      inscribirse: (partidoId, jugadorId, medio, estado) => {
        const partido = get().getPartido(partidoId);
        const precio = partido?.precio ?? 0;
        const comision = Math.round(precio * COMISION_SERVICIO);
        const pago: Pago = {
          id: genId('pago'),
          partido_id: partidoId,
          jugador_id: jugadorId,
          medio,
          monto: precio + comision,
          comision,
          estado,
          referencia: genRef(),
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          pagos: [pago, ...s.pagos],
          inscritos: s.inscritos.includes(partidoId) ? s.inscritos : [...s.inscritos, partidoId],
          partidos: s.partidos.map((p) =>
            p.id === partidoId
              ? { ...p, cupos_ocupados: Math.min(p.cupos_totales, p.cupos_ocupados + 1) }
              : p,
          ),
        }));
        return pago;
      },

      salirse: (partidoId) => {
        set((s) => ({
          inscritos: s.inscritos.filter((id) => id !== partidoId),
          partidos: s.partidos.map((p) =>
            p.id === partidoId
              ? { ...p, cupos_ocupados: Math.max(0, p.cupos_ocupados - 1) }
              : p,
          ),
        }));
      },
    }),
    {
      name: 'faltauno.store',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos lo que el usuario generó; los partidos seed se recargan
      partialize: (s) => ({ inscritos: s.inscritos, pagos: s.pagos, partidos: s.partidos }),
    },
  ),
);
