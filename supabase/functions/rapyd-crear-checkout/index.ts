// Edge Function: rapyd-crear-checkout
// Crea un Hosted Checkout de Rapyd para el cupo de un PARTIDO o la RESERVA de una
// cancha. El MONTO se recomputa SIEMPRE en el servidor desde la BD (nunca se confía
// en el cliente) y la firma HMAC se calcula acá con el Secret Key, que vive SOLO en
// la Edge Function.
//
// Rapyd es la plataforma sucesora de PayU en LatAm (adquisición del GPO en 2025).
// La integración es REST: POST /v1/checkout devuelve un `redirect_url` que el cliente
// abre en el navegador (expo-web-browser). Al pagar, Rapyd confirma vía webhook
// (`rapyd-webhook`); el estado 'aprobado'/'confirmada' NUNCA se escribe desde el cliente.
//
// STUB: sin RAPYD_ACCESS_KEY/RAPYD_SECRET_KEY, devuelve "Pasarela no configurada".
//
// Deploy:  supabase functions deploy rapyd-crear-checkout
// Secretos (supabase secrets set ...):
//   RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY,
//   RAPYD_BASE_URL   (opcional; default sandbox https://sandboxapi.rapyd.net; prod https://api.rapyd.net)
//   RAPYD_COMPLETE_URL, RAPYD_CANCEL_URL (opcional; páginas de retorno tras pagar/cancelar)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

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

/**
 * Firma de Rapyd: BASE64( hexdigest( HMAC-SHA256( secret,
 *   http_method + url_path + salt + timestamp + access_key + secret_key + body ) ) ).
 * OJO: se base64-codifica el HEX (no los bytes crudos). Es el error #1 de estas
 * integraciones. http_method va en minúsculas; body es el JSON exacto ("" si vacío).
 * btoa(hex) == Buffer.from(hex).toString('base64') porque el hex es ASCII, y btoa
 * es nativo de Deno (Buffer no es global en el runtime de Edge Functions).
 */
function firmarRapyd(
  method: string,
  path: string,
  salt: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
  body: string,
): string {
  const toSign = method + path + salt + timestamp + accessKey + secretKey + body;
  const hex = createHmac('sha256', secretKey).update(toSign).digest('hex');
  return btoa(hex);
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

    const accessKey = Deno.env.get('RAPYD_ACCESS_KEY');
    const secretKey = Deno.env.get('RAPYD_SECRET_KEY');
    if (!accessKey || !secretKey) return json({ error: 'Pasarela no configurada' }, 500);

    const baseUrl = Deno.env.get('RAPYD_BASE_URL') || 'https://sandboxapi.rapyd.net';
    const completeUrl =
      Deno.env.get('RAPYD_COMPLETE_URL') || 'https://sebastianayala13.github.io/falta-uno-legal';
    const cancelUrl = Deno.env.get('RAPYD_CANCEL_URL') || completeUrl;

    const { tipo, partidoId, reservaId, referencia } = await req.json();
    if (typeof referencia !== 'string' || !referencia) {
      return json({ error: 'Referencia inválida' }, 400);
    }

    // Monto recomputado SIEMPRE desde la BD (anti-tampering).
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

    // Crear el Hosted Checkout de Rapyd. COP es moneda sin decimales: el entero va tal cual.
    const method = 'post';
    const path = '/v1/checkout';
    const bodyObj = {
      amount,
      country: 'CO',
      currency: 'COP',
      merchant_reference_id: referencia,
      complete_checkout_url: completeUrl,
      cancel_checkout_url: cancelUrl,
      description: tipo === 'partido' ? 'Cupo de partido - Falta Uno' : 'Reserva de cancha - Falta Uno',
    };
    const body = JSON.stringify(bodyObj);
    const salt = crypto.randomUUID().replace(/-/g, ''); // salt aleatorio (Web Crypto, nativo de Deno)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = firmarRapyd(method, path, salt, timestamp, accessKey, secretKey, body);

    const resp = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_key: accessKey,
        salt,
        timestamp,
        signature,
      },
      body,
    });
    const out = await resp.json();
    const redirectUrl = out?.data?.redirect_url;
    if (!resp.ok || out?.status?.status !== 'SUCCESS' || !redirectUrl) {
      console.error('rapyd-crear-checkout: respuesta Rapyd', JSON.stringify(out?.status ?? out));
      return json({ error: 'No se pudo crear el checkout' }, 502);
    }

    return json({ url: redirectUrl });
  } catch (e) {
    console.error('rapyd-crear-checkout:', e);
    return json({ error: String(e) }, 500);
  }
});
