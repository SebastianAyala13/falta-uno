// Edge Function: lemonsqueezy-webhook
// Recibe los webhooks de Lemon Squeezy y confirma los pagos de cupo en el
// servidor. El estado 'aprobado' de un pago online SOLO se escribe acá:
// nunca se confía en lo que diga el cliente.
//
// Deploy (sin verificación de JWT: Lemon Squeezy no manda token de Supabase,
// la autenticidad se valida con la firma HMAC del webhook):
//   supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
// Requiere secretos (supabase secrets set ...):
//   LEMONSQUEEZY_WEBHOOK_SECRET  (el "Signing secret" del webhook en Lemon Squeezy)
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen en el entorno de Functions.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Comisión de servicio de Falta Uno (mantener en sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Convierte un string hex en bytes; null si no es hex válido. */
function hexABytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verifica la firma HMAC-SHA256 del webhook (header X-Signature, en hex).
 * `crypto.subtle.verify` hace la comparación en tiempo constante.
 */
async function firmaValida(rawBody: string, firmaHex: string, secreto: string): Promise<boolean> {
  const firma = hexABytes(firmaHex);
  if (!firma) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, firma.buffer as ArrayBuffer, enc.encode(rawBody));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const secreto = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
    if (!secreto) return json({ error: 'Webhook no configurado' }, 500);

    // La firma se calcula sobre el body CRUDO: leerlo antes de parsear
    const rawBody = await req.text();
    const firma = req.headers.get('X-Signature') ?? '';
    if (!firma || !(await firmaValida(rawBody, firma, secreto))) {
      return json({ error: 'Firma inválida' }, 401);
    }

    const evento = JSON.parse(rawBody);
    const nombreEvento = evento?.meta?.event_name;

    // Solo nos interesan órdenes creadas y efectivamente pagadas
    if (nombreEvento !== 'order_created') return json({ ok: true, ignorado: nombreEvento });
    if (evento?.data?.attributes?.status !== 'paid') {
      return json({ ok: true, ignorado: 'orden no pagada' });
    }

    const custom = evento?.meta?.custom_data ?? {};
    const partidoId = custom.partido_id;
    const jugadorId = custom.jugador_id;
    const referencia = custom.referencia;
    if (!partidoId || !jugadorId || !referencia) {
      return json({ error: 'custom_data incompleta' }, 400);
    }

    // Cliente admin (service_role): las escrituras de pagos aprobados son solo del servidor
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotencia: si la referencia ya se registró, no repetimos nada
    const { data: existente } = await admin
      .from('pagos')
      .select('id')
      .eq('referencia', referencia)
      .maybeSingle();
    if (existente) return json({ ok: true, duplicado: true });

    // El monto se calcula en el servidor a partir del precio real del partido
    const { data: partido, error: errPartido } = await admin
      .from('partidos')
      .select('id, precio, cupos_totales, cupos_ocupados')
      .eq('id', partidoId)
      .single();
    if (errPartido || !partido) return json({ error: 'Partido no encontrado' }, 404);

    const comision = Math.round(partido.precio * COMISION_SERVICIO);
    const monto = partido.precio + comision;

    const { error: errPago } = await admin.from('pagos').insert({
      partido_id: partidoId,
      jugador_id: jugadorId,
      medio: 'online',
      monto,
      comision,
      estado: 'aprobado',
      referencia,
    });
    // Carrera con otro webhook duplicado: el índice único de referencia lo frena
    if (errPago) {
      if (errPago.code === '23505') return json({ ok: true, duplicado: true });
      throw errPago;
    }

    // Inscripción (espejo server-side de `inscribirse` en lib/store.ts):
    // agregar al jugador al partido y ocupar un cupo, sin duplicar.
    const { data: yaInscrito } = await admin
      .from('partido_jugadores')
      .select('id')
      .eq('partido_id', partidoId)
      .eq('jugador_id', jugadorId)
      .maybeSingle();

    if (!yaInscrito) {
      const { data: perfil } = await admin
        .from('profiles')
        .select('posicion')
        .eq('id', jugadorId)
        .maybeSingle();

      const { error: errInscripcion } = await admin.from('partido_jugadores').insert({
        partido_id: partidoId,
        jugador_id: jugadorId,
        posicion: perfil?.posicion ?? 'Mediocampista',
        confirmado: true,
      });
      // 23505 = unique_violation (otro webhook lo inscribió primero)
      if (errInscripcion && errInscripcion.code !== '23505') throw errInscripcion;
      // NOTA: cupos_ocupados lo actualiza el trigger fn_sync_cupos (schema.sql)
      // de forma atómica al insertar en partido_jugadores. No lo tocamos acá
      // para no contar doble.
    }

    return json({ ok: true });
  } catch (e) {
    console.error('lemonsqueezy-webhook:', e);
    return json({ error: String(e) }, 500);
  }
});
