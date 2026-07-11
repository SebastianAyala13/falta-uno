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
 * Los pagos online NO pasan por acá: van por `crearCheckoutOnline` / `crearCheckoutReserva`
 * (Wompi) y el estado 'aprobado'/'confirmada' lo escribe SOLO el servidor cuando
 * Wompi confirma vía webhook (`supabase/functions/wompi-webhook`). Nunca marcamos
 * un pago como aprobado desde el cliente.
 */
export async function procesarPago(
  medio: MedioPagoId,
  _monto: number,
): Promise<ResultadoPago> {
  if (medio !== 'efectivo') {
    throw new Error('Este medio se paga online con Wompi, no desde la app.');
  }
  // Pequeña pausa para que el usuario vea la confirmación del registro
  await new Promise((r) => setTimeout(r, 1200));
  return { estado: 'pendiente', mensaje: 'Le pagás al organizador en la cancha.' };
}

/**
 * Crea el Web Checkout de Wompi para el cupo de un PARTIDO llamando a la Edge
 * Function `wompi-crear-transaccion` (ahí viven las llaves y se calcula la firma
 * de integridad; el monto se recomputa en el servidor). Devuelve la URL segura.
 */
export async function crearCheckoutOnline(params: {
  partidoId: string;
  jugadorId: string;
  monto: number;
  referencia: string;
  email?: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    'wompi-crear-transaccion',
    { body: { tipo: 'partido', partidoId: params.partidoId, referencia: params.referencia, email: params.email } },
  );

  if (error || !data?.url) {
    throw new Error('No pudimos iniciar el pago online, parce. Revisá tu conexión e intentá de nuevo.');
  }
  return { url: data.url };
}

/**
 * Crea el Web Checkout de Wompi para la RESERVA de una cancha. La reserva debe
 * existir ya en estado 'pendiente'; el webhook la marca 'confirmada' al pagar.
 */
export async function crearCheckoutReserva(params: {
  reservaId: string;
  referencia: string;
  email?: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    'wompi-crear-transaccion',
    { body: { tipo: 'reserva', reservaId: params.reservaId, referencia: params.referencia, email: params.email } },
  );

  if (error || !data?.url) {
    throw new Error('No pudimos iniciar el pago online, parce. Revisá tu conexión e intentá de nuevo.');
  }
  return { url: data.url };
}
