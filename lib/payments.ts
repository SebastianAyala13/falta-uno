import type { MedioPagoId } from '@/constants/config';
import type { EstadoPago } from '@/types/database';

export interface ResultadoPago {
  estado: EstadoPago;
  mensaje: string;
}

/**
 * Procesa un pago. **Simulado** por ahora.
 *
 * Para enchufar Wompi real (Nequi/PSE/Tarjeta), reemplazá el cuerpo por una
 * llamada a tu backend que cree la transacción con la pasarela:
 *
 *   const res = await fetch(`${API}/pagos`, {
 *     method: 'POST',
 *     body: JSON.stringify({ medio, monto, referencia }),
 *   });
 *
 * Nunca pongas la llave privada de Wompi en el cliente: va en el backend.
 */
export async function procesarPago(
  medio: MedioPagoId,
  _monto: number,
): Promise<ResultadoPago> {
  // Latencia simulada de la pasarela
  await new Promise((r) => setTimeout(r, 1900));

  if (medio === 'efectivo') {
    return { estado: 'pendiente', mensaje: 'Le pagás al organizador en la cancha.' };
  }
  return { estado: 'aprobado', mensaje: 'Pago aprobado. ¡Nos vemos en la cancha!' };
}
