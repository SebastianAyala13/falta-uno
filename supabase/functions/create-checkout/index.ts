// Edge Function: create-checkout
// Crea un checkout REAL de Lemon Squeezy para pagar el cupo de un partido.
// La app la invoca desde el checkout (supabase.functions.invoke('create-checkout')).
// La llave secreta de Lemon Squeezy vive SOLO acá: nunca en el cliente.
//
// Deploy:
//   supabase functions deploy create-checkout
// Requiere secretos (supabase secrets set ...):
//   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID
// (SUPABASE_URL y SUPABASE_ANON_KEY ya vienen en el entorno de Functions.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;

    // Cliente con el token del usuario para identificar quién llama
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY');
    const storeId = Deno.env.get('LEMONSQUEEZY_STORE_ID');
    const variantId = Deno.env.get('LEMONSQUEEZY_VARIANT_ID');
    if (!apiKey || !storeId || !variantId) {
      return json({ error: 'Pasarela de pago no configurada' }, 500);
    }

    const { partidoId, jugadorId, monto, referencia, email } = await req.json();
    if (
      typeof partidoId !== 'string' ||
      typeof referencia !== 'string' ||
      !partidoId ||
      !referencia ||
      typeof monto !== 'number' ||
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      return json({ error: 'Parámetros inválidos' }, 400);
    }
    // Solo se pueden crear checkouts para uno mismo
    if (jugadorId && jugadorId !== user.id) {
      return json({ error: 'No autorizado' }, 403);
    }

    // https://docs.lemonsqueezy.com/api/checkouts#create-a-checkout
    const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            // Precio en centavos de la moneda de la tienda (requiere que la
            // variante acepte precio custom / pay-what-you-want).
            custom_price: Math.round(monto * 100),
            product_options: {
              name: 'Cupo de partido · Falta Uno',
              description: `Reserva de cupo (ref. ${referencia})`,
              redirect_url: 'https://sebastianayala13.github.io/falta-uno-legal',
            },
            checkout_data: {
              ...(email ? { email } : {}),
              // Llega de vuelta en el webhook como meta.custom_data
              custom: {
                partido_id: partidoId,
                jugador_id: user.id,
                referencia,
              },
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error('Lemon Squeezy error:', res.status, detalle);
      return json({ error: 'La pasarela rechazó la solicitud' }, 502);
    }

    const data = await res.json();
    const checkoutUrl = data?.data?.attributes?.url;
    if (!checkoutUrl) return json({ error: 'Respuesta inesperada de la pasarela' }, 502);

    return json({ url: checkoutUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
