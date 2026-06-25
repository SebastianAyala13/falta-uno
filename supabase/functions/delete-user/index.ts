// Edge Function: delete-user
// Borra por completo la cuenta del usuario que la invoca (perfil + usuario de Auth).
// La app la llama desde Perfil → Eliminar cuenta (supabase.functions.invoke('delete-user')).
//
// Deploy:
//   supabase functions deploy delete-user
// Requiere las variables (ya disponibles en el entorno de Functions):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Cumple el requisito de App Store y Play Store de eliminación de cuenta.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: cors });
    }

    const url = Deno.env.get('SUPABASE_URL')!;

    // Cliente con el token del usuario para identificar quién llama
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: cors });
    }

    // Cliente admin (service_role) para borrar de verdad
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.from('profiles').delete().eq('id', user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
