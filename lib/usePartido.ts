import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

/** Direct links fetch their row explicitly; feed pagination cannot hide it. */
export function usePartido(id: string) {
  const {profile} = useAuth();
  const partido = useStore(s => s.getPartido(id));
  const cargarPartido = useStore(s => s.cargarPartido);
  const hidratar = useStore(s => s.hidratar);
  const [cargando,setCargando] = useState(true);
  const [error,setError] = useState<string | null>(null);
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    void (async () => {
      try {
        if (profile?.id) await hidratar(profile.id);
        await cargarPartido(id);
      } catch { if (activo) setError('No pudimos cargar el partido. Revisá tu conexión.'); }
      finally { if (activo) setCargando(false); }
    })();
    return () => { activo = false; };
  },[id,profile?.id,hidratar,cargarPartido,revision]);
  return {partido,cargando,error,reintentar:() => setRevision(r => r+1)};
}
