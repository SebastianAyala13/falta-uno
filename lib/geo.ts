import type { Partido } from '@/types/database';

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Centro aproximado de Pereira. */
export const PEREIRA: Coords = { latitude: 4.8133, longitude: -75.6961 };

/** Coordenadas aproximadas por zona (para ubicar la cancha en el mapa). */
const ZONA_COORDS: Record<string, Coords> = {
  Centro: { latitude: 4.8143, longitude: -75.6946 },
  Cuba: { latitude: 4.7905, longitude: -75.7115 },
  Dosquebradas: { latitude: 4.835, longitude: -75.675 },
  Pinares: { latitude: 4.805, longitude: -75.7 },
  'La Villa': { latitude: 4.82, longitude: -75.69 },
  'El Poblado': { latitude: 4.809, longitude: -75.698 },
  Álamos: { latitude: 4.8, longitude: -75.68 },
};

/**
 * Coordenadas de un partido. Usa las del partido si existen; si no, las de su
 * zona; y como último recurso, el centro de Pereira (con un leve offset estable
 * por id para que dos partidos en la misma zona no queden exactamente encimados).
 */
export function coordsDePartido(p: Pick<Partido, 'lat' | 'lng' | 'zona' | 'id'>): Coords {
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return { latitude: p.lat, longitude: p.lng };
  }
  const base = ZONA_COORDS[p.zona] ?? PEREIRA;
  const jitter = (idToNum(p.id) % 20) / 10000; // ~ ±0.002°
  return { latitude: base.latitude + jitter, longitude: base.longitude - jitter };
}

function idToNum(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 1000;
  return h;
}
