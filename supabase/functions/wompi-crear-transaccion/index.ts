// Edge Function: wompi-crear-transaccion
// Arma la URL del Web Checkout de Wompi para pagar el cupo de un partido o la
// reserva de una cancha. El MONTO se recomputa en el servidor desde la BD (nunca
// se confía en el cliente) y la FIRMA DE INTEGRIDAD se calcula acá con el secreto
// que vive SOLO en la Edge Function.
//
// Deploy:  supabase functions deploy wompi-crear-transaccion
// Secretos (supabase secrets set ...):
//   WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_REDIRECT_URL (opcional)
// (SUPABASE_URL y SUPABASE_ANON_KEY ya vienen en el entorno de Functions.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY');
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET');
    if (!publicKey || !integritySecret) return json({ error: 'Pasarela no configurada' }, 500);
    const redirectUrl =
      Deno.env.get('WOMPI_REDIRECT_URL') || 'https://sebastianayala13.github.io/falta-uno-legal';

    const { tipo, partidoId, reservaId, referencia, email } = await req.json();
    if (typeof referencia !== 'string' || !referencia) {
      return json({ error: 'Referencia inválida' }, 400);
    }

    // Monto recomputado SIEMPRE desde la BD (anti-tampering)
    let amount = 0;
    if (tipo === 'partido') {
      if (typeof partidoId !== 'string' || !partidoId) return json({ error: 'partidoId inválido' }, 400);
      const { data: p, error } = await userClient
        .from('partidos')
        .select('precio')
        .eq('id', partidoId)
        .single();
      if (error || !p) return json({ error: 'Partido no encontrado' }, 404);
      amount = p.precio + Math.round(p.precio * COMISION_SERVICIO);
    } else if (tipo === 'reserva') {
      if (typeof reservaId !== 'string' || !reservaId) return json({ error: 'reservaId inválido' }, 400);
      const { data: r, error } = await userClient
        .from('reservas')
        .select('precio, jugador_id')
        .eq('id', reservaId)
        .single();
      if (error || !r) return json({ error: 'Reserva no encontrada' }, 404);
      if (r.jugador_id !== user.id) return json({ error: 'No autorizado' }, 403);
      amount = r.precio; // el jugador paga el precio del turno; la comisión sale del ledger de la cancha
    } else {
      return json({ error: 'Tipo inválido' }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Monto inválido' }, 400);
    const amountInCents = Math.round(amount * 100);

    // Firma de integridad: SHA256(reference + amountInCents + currency + integritySecret)
    const signature = await sha256hex(`${referencia}${amountInCents}COP${integritySecret}`);

    // La clave 'signature:integrity' y 'customer-data:email' llevan ':' literal
    const params = [
      `public-key=${encodeURIComponent(publicKey)}`,
      `currency=COP`,
      `amount-in-cents=${amountInCents}`,
      `reference=${encodeURIComponent(referencia)}`,
      `signature:integrity=${signature}`,
      `redirect-url=${encodeURIComponent(redirectUrl)}`,
      ...(email ? [`customer-data:email=${encodeURIComponent(email)}`] : []),
    ];
    const url = `https://checkout.wompi.co/p/?${params.join('&')}`;

    return json({ url });
  } catch (e) {
    console.error('wompi-crear-transaccion:', e);
    return json({ error: String(e) }, 500);
  }
});
