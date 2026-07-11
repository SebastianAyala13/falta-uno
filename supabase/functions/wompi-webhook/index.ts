// Edge Function: wompi-webhook
// Recibe los Eventos de Wompi. El estado 'aprobado' (pago de partido) o
// 'confirmada' (reserva de cancha) SOLO se escribe acá, tras verificar el
// checksum del evento con el WOMPI_EVENTS_SECRET. Nunca se confía en el cliente.
//
// Deploy (sin verificación de JWT: Wompi no manda token de Supabase; la
// autenticidad se valida con el checksum del evento):
//   supabase functions deploy wompi-webhook --no-verify-jwt
// Secretos:  WOMPI_EVENTS_SECRET
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen en el entorno.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lee un path con puntos (ej. "transaction.id") dentro de un objeto. */
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const secret = Deno.env.get('WOMPI_EVENTS_SECRET');
    if (!secret) return json({ error: 'Webhook no configurado' }, 500);

    const evento = await req.json();
    const firma = evento?.signature;
    const props: string[] = firma?.properties ?? [];
    const checksumRecibido: string = firma?.checksum ?? '';
    const timestamp = evento?.timestamp;

    // Checksum = SHA256( valores(data, props en orden) + timestamp + events_secret )
    const concatenado =
      props.map((p) => String(getPath(evento?.data, p) ?? '')).join('') + String(timestamp) + secret;
    const esperado = await sha256hex(concatenado);
    if (!checksumRecibido || esperado.toLowerCase() !== String(checksumRecibido).toLowerCase()) {
      return json({ error: 'Checksum inválido' }, 401);
    }

    if (evento?.event !== 'transaction.updated') return json({ ok: true, ignorado: evento?.event });

    const tx = evento?.data?.transaction;
    const referencia: string = tx?.reference ?? '';
    const amountInCents: number = Number(tx?.amount_in_cents ?? 0);
    if (tx?.status !== 'APPROVED') return json({ ok: true, ignorado: tx?.status });
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
      // Anti-tampering: el monto cobrado debe coincidir con el de la BD
      if (Math.round(pago.monto * 100) !== amountInCents) {
        console.error('wompi-webhook: monto no coincide (pago)', referencia, pago.monto, amountInCents);
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
      if (Math.round(reserva.precio * 100) !== amountInCents) {
        console.error('wompi-webhook: monto no coincide (reserva)', referencia, reserva.precio, amountInCents);
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
          descripcion: 'Ingreso por reserva (Wompi)',
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
    console.error('wompi-webhook:', e);
    return json({ error: String(e) }, 500);
  }
});
