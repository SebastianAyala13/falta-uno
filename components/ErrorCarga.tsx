import ErrorBanner from '@/components/ErrorBanner';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';

/**
 * Aviso de que la carga inicial del store falló, con botón de reintentar.
 *
 * Va en las pantallas que leen del store. Sin él, un fallo de red se ve
 * exactamente igual que "todavía no hay nada": el inicio dice que no hay
 * partidos, el muro que no hay publicaciones. Es la lectura más cara posible,
 * porque el usuario concluye que la app está vacía y no vuelve.
 *
 * No pinta nada cuando la última carga salió bien.
 */
export default function ErrorCarga({ className }: { className?: string }) {
  const errorCarga = useStore((s) => s.errorCarga);
  const hidratar = useStore((s) => s.hidratar);
  const { profile } = useAuth();

  if (!errorCarga) return null;

  return (
    <ErrorBanner
      message={errorCarga}
      className={className}
      action={{
        label: 'Reintentar',
        onPress: () => {
          if (profile?.id) hidratar(profile.id);
        },
      }}
    />
  );
}
