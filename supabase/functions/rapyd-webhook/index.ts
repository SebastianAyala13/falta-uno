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
import { createHmac } from 'node:crypto';

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

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
  return Buffer.from(hex).toString('base64');
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
    if (!sign || sign !== esperado) return json({ error: 'Firma inválida' }, 401);

    const evento = JSON.parse(raw);
    // Solo nos interesa el pago completado. Cualquier otro tipo se ignora (200 OK).
    if (evento?.type !== 'PAYMENT_COMPLETED') return json({ ok: true, ignorado: evento?.type ?? null });

    const pagoRapyd = evento.data ?? {};
    const referencia = String(pagoRapyd.merchant_reference_id ?? '');
    const amountInt = Math.round(Number(pagoRapyd.amount ?? 0));
    if (!referencia) return json({ error: 'Sin referencia' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ¿Es un pago de partido? (pagos.referencia)
    const { data: pago } = await admin
      .from('pagos')
      .select('id, partido_id, jugador_id, monto, estado')
      .eq('referencia', referencia)
      .maybeSingle();

    if (pago) {
      if (pago.estado === 'aprobado') return json({ ok: true, duplicado: true });
      if (Math.round(pago.monto) !== amountInt) {
        console.error('rapyd-webhook: monto no coincide (pago)', referencia, pago.monto, amountInt);
        return json({ ok: true, alerta: 'monto no coincide' });
      }
      await admin.from('pagos').update({ estado: 'aprobado' }).eq('id', pago.id);

      // Asegurar inscripción (el trigger fn_sync_cupos ocupa el cupo)
      const { data: yaInscrito } = await admin
        .from('partido_jugadores')
        .select('id')
        .eq('partido_id', pago.partido_id)
        .eq('jugador_id', pago.jugador_id)
        .maybeSingle();
      if (!yaInscrito) {
        const { data: perfil } = await admin
          .from('profiles')
          .select('posicion')
          .eq('id', pago.jugador_id)
          .maybeSingle();
        const { error: errIns } = await admin.from('partido_jugadores').insert({
          partido_id: pago.partido_id,
          jugador_id: pago.jugador_id,
          posicion: perfil?.posicion ?? 'Mediocampista',
          confirmado: true,
        });
        if (errIns && errIns.code !== '23505') throw errIns;
      }
      return json({ ok: true, tipo: 'partido' });
    }

    // ¿Es una reserva de cancha? (reservas.referencia)
    const { data: reserva } = await admin
      .from('reservas')
      .select('id, cancha_id, precio, comision, estado')
      .eq('referencia', referencia)
      .maybeSingle();

    if (reserva) {
      if (reserva.estado === 'confirmada') return json({ ok: true, duplicado: true });
      if (Math.round(reserva.precio) !== amountInt) {
        console.error('rapyd-webhook: monto no coincide (reserva)', referencia, reserva.precio, amountInt);
        return json({ ok: true, alerta: 'monto no coincide' });
      }
      await admin.from('reservas').update({ estado: 'confirmada' }).eq('id', reserva.id);

      // Ledger de la cancha: ingreso por la reserva y comisión de Falta Uno
      const comision = reserva.comision ?? Math.round(reserva.precio * COMISION_SERVICIO);
      await admin.from('movimientos_cancha').insert([
        {
          cancha_id: reserva.cancha_id,
          tipo: 'ingreso_reserva',
          monto: reserva.precio,
          reserva_id: reserva.id,
          descripcion: 'Ingreso por reserva (Rapyd)',
        },
        {
          cancha_id: reserva.cancha_id,
          tipo: 'comision',
          monto: -Math.abs(comision),
          reserva_id: reserva.id,
          descripcion: 'Comisión Falta Uno',
        },
      ]);
      return json({ ok: true, tipo: 'reserva' });
    }

    return json({ ok: true, ignorado: 'referencia desconocida' });
  } catch (e) {
    console.error('rapyd-webhook:', e);
    return json({ error: String(e) }, 500);
  }
});
