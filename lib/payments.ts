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
 * (Rapyd) y el estado 'aprobado'/'confirmada' lo escribe SOLO el servidor cuando
 * Rapyd confirma vía webhook (`supabase/functions/rapyd-webhook`). Nunca marcamos
 * un pago como aprobado desde el cliente.
 */
export async function procesarPago(
  medio: MedioPagoId,
  _monto: number,
): Promise<ResultadoPago> {
  if (medio !== 'efectivo') {
    throw new Error('Este medio se paga en línea, no desde la app.');
  }
  // Pequeña pausa para que el usuario vea la confirmación del registro
  await new Promise((r) => setTimeout(r, 1200));
  return { estado: 'pendiente', mensaje: 'Le pagás al organizador en la cancha.' };
}

/**
 * Crea el Hosted Checkout de Rapyd para el cupo de un PARTIDO llamando a la Edge
 * Function `rapyd-crear-checkout` (ahí viven las llaves y se firma la request; el
 * monto se recomputa en el servidor). Devuelve el redirect_url seguro.
 */
export async function crearCheckoutOnline(params: {
  partidoId: string;
  jugadorId: string;
  monto: number;
  referencia: string;
  email?: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    'rapyd-crear-checkout',
    { body: { tipo: 'partido', partidoId: params.partidoId, referencia: params.referencia, email: params.email } },
  );

  if (error || !data?.url) {
    throw new Error('No pudimos iniciar el pago online, parce. Revisá tu conexión e intentá de nuevo.');
  }
  return { url: data.url };
}

/**
 * Crea el Hosted Checkout de Rapyd para la RESERVA de una cancha. La reserva debe
 * existir ya en estado 'pendiente'; el webhook la marca 'confirmada' al pagar.
 */
export async function crearCheckoutReserva(params: {
  reservaId: string;
  referencia: string;
  email?: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(
    'rapyd-crear-checkout',
    { body: { tipo: 'reserva', reservaId: params.reservaId, referencia: params.referencia, email: params.email } },
  );

  if (error || !data?.url) {
    throw new Error('No pudimos iniciar el pago online, parce. Revisá tu conexión e intentá de nuevo.');
  }
  return { url: data.url };
}
