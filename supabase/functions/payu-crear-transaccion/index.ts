// Edge Function: payu-crear-transaccion
// Arma el pago del Web Checkout de PayU para el cupo de un partido o la reserva
// de una cancha. El MONTO se recomputa en el servidor desde la BD (nunca se
// confía en el cliente) y la FIRMA se calcula acá con el ApiKey que vive SOLO en
// la Edge Function.
//
// STUB: sin los secretos PAYU_* seteados, devuelve "Pasarela no configurada".
// PayU WebCheckout es un form POST; al conectar credenciales hay que cerrar el
// detalle del envío (ver docs/PAYU-SETUP.md).
//
// Deploy:  supabase functions deploy payu-crear-transaccion
// Secretos (supabase secrets set ...):
//   PAYU_API_KEY, PAYU_MERCHANT_ID, PAYU_ACCOUNT_ID,
//   PAYU_CHECKOUT_URL (opcional; default sandbox), PAYU_RESPONSE_URL (opcional)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

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

const md5hex = (s: string): string => createHash('md5').update(s).digest('hex');

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

    const apiKey = Deno.env.get('PAYU_API_KEY');
    const merchantId = Deno.env.get('PAYU_MERCHANT_ID');
    const accountId = Deno.env.get('PAYU_ACCOUNT_ID');
    if (!apiKey || !merchantId || !accountId) {
      return json({ error: 'Pasarela no configurada' }, 500);
    }
    const checkoutUrl =
      Deno.env.get('PAYU_CHECKOUT_URL') ||
      'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/';
    const responseUrl =
      Deno.env.get('PAYU_RESPONSE_URL') || 'https://sebastianayala13.github.io/falta-uno-legal';

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

    // Firma de PayU: MD5(ApiKey~merchantId~referenceCode~amount~currency).
    // amount va como entero COP (sin decimales) en el WebCheckout.
    const currency = 'COP';
    const signature = md5hex(`${apiKey}~${merchantId}~${referencia}~${amount}~${currency}`);

    // Campos firmados del WebCheckout de PayU. OJO: PayU espera un form POST a
    // `checkoutUrl`. Este stub arma la estructura firmada y devuelve el gateway
    // con los parámetros; el cierre del envío (form POST / página puente) se
    // valida al conectar credenciales reales (ver docs/PAYU-SETUP.md).
    const fields: Record<string, string> = {
      merchantId,
      accountId,
      description: tipo === 'partido' ? 'Cupo de partido - Falta Uno' : 'Reserva de cancha - Falta Uno',
      referenceCode: referencia,
      amount: String(amount),
      tax: '0',
      taxReturnBase: '0',
      currency,
      signature,
      buyerEmail: email ?? '',
      responseUrl,
      confirmationUrl: `${supaUrl}/functions/v1/payu-webhook`,
      test: '1',
    };

    const qs = Object.entries(fields)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${checkoutUrl}?${qs}`;

    return json({ url });
  } catch (e) {
    console.error('payu-crear-transaccion:', e);
    return json({ error: String(e) }, 500);
  }
});
