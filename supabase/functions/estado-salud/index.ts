import { createClient } from 'jsr:@supabase/supabase-js@2';
import { timingSafeEqual } from 'node:crypto';

// This endpoint deliberately exposes a single bit, including on errors.
const respuesta = (ok: boolean, status: number) => new Response(JSON.stringify({ ok }), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SALUD_MONITOR_SECRET');
  const recibido = req.headers.get('X-Salud-Key');
  const jobSecret = Deno.env.get('CONCILIACION_JOB_SECRET');
  // Reject a missing configuration and accidental reuse of the payment-job key.
  if (!secret?.trim() || !recibido || secret === jobSecret) return respuesta(false, 401);
  const encoder = new TextEncoder();
  const esperado = encoder.encode(secret);
  const presentado = encoder.encode(recibido);
  if (esperado.length !== presentado.length || !timingSafeEqual(esperado, presentado)) {
    return respuesta(false, 401);
  }
  if (req.method !== 'GET') return respuesta(false, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return respuesta(false, 503);
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Bound the database request so an unavailable database also triggers the monitor.
    const { data, error } = await db.rpc('estado_salud').abortSignal(AbortSignal.timeout(5000));
    const ok = !error && data === true;
    return respuesta(ok, ok ? 200 : 503);
  } catch {
    // Never put SQL errors, secrets or payment details into responses or logs.
    return respuesta(false, 503);
  }
});
