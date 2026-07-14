// Edge Function: payu-webhook
// Recibe la confirmación de PayU (form-urlencoded). El estado 'aprobado' (pago de
// partido) o 'confirmada' (reserva de cancha) SOLO se escribe acá, tras verificar
// la firma con PAYU_API_KEY. Nunca se confía en el cliente.
//
// STUB: sin PAYU_API_KEY seteada, devuelve "Webhook no configurado".
//
// Deploy (sin verificación de JWT: PayU no manda token de Supabase; la
// autenticidad se valida con la firma del evento):
//   supabase functions deploy payu-webhook --no-verify-jwt
// Secretos:  PAYU_API_KEY
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen en el entorno.)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const md5hex = (s: string): string => createHash('md5').update(s).digest('hex');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const apiKey = Deno.env.get('PAYU_API_KEY');
    if (!apiKey) return json({ error: 'Webhook no configurado' }, 500);

    const form = await req.formData();
    const merchantId = String(form.get('merchant_id') ?? '');
    const referencia = String(form.get('reference_sale') ?? '');
    const value = String(form.get('value') ?? '');
    const currency = String(form.get('currency') ?? '');
    const statePol = String(form.get('state_pol') ?? '');
    const sign = String(form.get('sign') ?? '');

    // Firma PayU: MD5(ApiKey~merchant_id~reference_sale~new_value~currency~state_pol).
    // new_value: PayU formatea el value con una regla de decimales (si el segundo
    // decimal es 0, usa 1 decimal). Se computan ambas variantes y se acepta
    // cualquiera. Validar contra la doc de PayU al conectar credenciales.
    const num = Number(value);
    const v1 = num.toFixed(1);
    const v2 = num.toFixed(2);
    const esperado1 = md5hex(`${apiKey}~${merchantId}~${referencia}~${v1}~${currency}~${statePol}`);
    const esperado2 = md5hex(`${apiKey}~${merchantId}~${referencia}~${v2}~${currency}~${statePol}`);
    const firmaOk =
      sign.toLowerCase() === esperado1.toLowerCase() ||
      sign.toLowerCase() === esperado2.toLowerCase();
    if (!sign || !firmaOk) return json({ error: 'Firma inválida' }, 401);

    // state_pol 4 = APPROVED. Cualquier otro estado se ignora.
    if (statePol !== '4') return json({ ok: true, ignorado: statePol });
    if (!referencia) return json({ error: 'Sin referencia' }, 400);

    const amountInt = Math.round(num);

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
        console.error('payu-webhook: monto no coincide (pago)', referencia, pago.monto, amountInt);
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
        console.error('payu-webhook: monto no coincide (reserva)', referencia, reserva.precio, amountInt);
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
          descripcion: 'Ingreso por reserva (PayU)',
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
    console.error('payu-webhook:', e);
    return json({ error: String(e) }, 500);
  }
});
