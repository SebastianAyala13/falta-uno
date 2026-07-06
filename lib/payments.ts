import type { MedioPagoId } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import type { EstadoPago } from '@/types/database';

export interface ResultadoPago {
  estado: EstadoPago;
  mensaje: string;
}

/**
 * Procesa un pago en EFECTIVO: queda 'pendiente' porque el acuerdo real es
 * con el organizador en la cancha (Falta Uno no custodia dinero).
 *
 * Los pagos online NO pasan por acá: van por `crearCheckoutOnline` (Lemon
 * Squeezy) y el estado 'aprobado' lo escribe SOLO el servidor cuando la
 * pasarela confirma vía webhook (`supabase/functions/lemonsqueezy-webhook`).
 * Nunca marcamos un pago como aprobado desde el cliente.
 */
export async function procesarPago(
  medio: MedioPagoId,
  _monto: number,
): Promise<ResultadoPago> {
  if (medio !== 'efectivo') {
    throw new Error('Este medio se paga online con Lemon Squeezy, no desde la app.');
  }
  // Pequeña pausa para que el usuario vea la confirmación del registro
  await new Promise((r) => setTimeout(r, 1200));
  return { estado: 'pendiente', mensaje: 'Le pagás al organizador en la cancha.' };
}

/**
 * Crea un checkout REAL de Lemon Squeezy llamando a la Edge Function
 * `create-checkout` (ahí vive la llave secreta de la API, nunca en la app).
 * Devuelve la URL segura del checkout para abrirla en el navegador.
 */
export async function crearCheckoutOnline(params: {
  partidoId: string;
  jugadorId: string;
  monto: number;
  referencia: string;
  email?: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    'create-checkout',
    { body: params },
  );

  if (error || !data?.url) {
    throw new Error(
      'No pudimos iniciar el pago online, parce. Revisá tu conexión e intentá de nuevo.',
    );
  }
  return { url: data.url };
}
