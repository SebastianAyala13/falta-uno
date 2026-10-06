// Edge Function: rapyd-webhook
// Recibe la confirmación de Rapyd (JSON). El estado 'aprobado' (pago de partido) o
// 'confirmada' (reserva de cancha) SOLO se escribe acá, tras verificar la firma del
// webhook con el Secret Key. Nunca se confía en el cliente.
//
// STUB: sin RAPYD_SECRET_KEY, devuelve "Webhook no configurado".
//
// Deploy (sin verificación de JWT: Rapyd no manda token de Supabase; la autenticidad
// se valida con la firma del evento):
//   supabase functions deploy rapyd-webhook --no-verify-jwt
// Secretos:
//   RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY,
//   RAPYD_WEBHOOK_URL  (la URL EXACTA registrada en Rapyd para este webhook — entra
//                       en el cálculo de la firma; debe coincidir carácter por carácter,
//                       p. ej. https://<proj>.supabase.co/functions/v1/rapyd-webhook)
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen en el entorno.)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Firma del webhook de Rapyd (NO incluye el http_method):
 *   BASE64( hexdigest( HMAC-SHA256( secret,
 *     url_path + salt + timestamp + access_key + secret_key + body ) ) ).
 * url_path = la URL completa registrada en Rapyd para recibir webhooks.
 */
function firmaWebhookRapyd(
  urlPath: string,
  salt: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
  body: string,
): string {
  const toSign = urlPath + salt + timestamp + accessKey + secretKey + body;
  const hex = createHmac('sha256', secretKey).update(toSign).digest('hex');
  return btoa(hex); // == Buffer.from(hex).toString('base64'); btoa es nativo de Deno
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const accessKey = Deno.env.get('RAPYD_ACCESS_KEY');
    const secretKey = Deno.env.get('RAPYD_SECRET_KEY');
    const webhookUrl = Deno.env.get('RAPYD_WEBHOOK_URL');
    if (!accessKey || !secretKey || !webhookUrl) return json({ error: 'Webhook no configurado' }, 500);

    // Se usa el body CRUDO (texto exacto) para la firma; no re-serializar.
    const raw = await req.text();
    const salt = req.headers.get('salt') ?? '';
    const timestamp = req.headers.get('timestamp') ?? '';
    const sign = req.headers.get('signature') ?? '';

    const esperado = firmaWebhookRapyd(webhookUrl, salt, timestamp, accessKey, secretKey, raw);
    const firma = new TextEncoder().encode(sign);
    const valida = new TextEncoder().encode(esperado);
    if (!salt || !/^\d+$/.test(timestamp) || firma.length !== valida.length || !timingSafeEqual(firma,valida)) return json({ error: 'Firma inválida' }, 401);

    const evento = JSON.parse(raw);
    // Solo nos interesa el pago completado. Cualquier otro tipo se ignora (200 OK).
    if (evento?.type !== 'PAYMENT_COMPLETED') return json({ ok: true, ignorado: evento?.type ?? null });

    const pagoRapyd = evento.data ?? {};
    const referencia = String(pagoRapyd.merchant_reference_id ?? '');
    const amountInt = Number(pagoRapyd.amount);
    if (!Number.isSafeInteger(amountInt) || amountInt <= 0 || pagoRapyd.currency !== 'COP') return json({error:'Monto o moneda inválido'},400);
    if (!referencia) return json({ error: 'Sin referencia' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // The RPC commits payment, membership and ledger together. It locks only
    // the corresponding match/reservation and handles parallel retries safely.
    const {data,error} = await admin.rpc('confirmar_pago_online', {
      p_referencia:referencia,p_monto:amountInt,p_moneda:pagoRapyd.currency,
    });
    if (error) throw error; // Return 500 so the provider retries a failed transaction.
    return json({ok:true,...data});
  } catch (e) {
    console.error('rapyd-webhook:', e);
    return json({ error: 'No se pudo confirmar el pago' }, 500);
  }
});
