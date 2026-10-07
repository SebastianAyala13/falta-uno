// Deletes only the authenticated caller. Deploy with JWT verification enabled.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown,status=200) => new Response(JSON.stringify(body),{
  status,headers:{...cors,'Content-Type':'application/json'},
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors});
  if (req.method !== 'POST') return json({error:'Método no permitido'},405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({error:'No autorizado'},401);
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return json({error:'Eliminación no configurada'},503);
    const userClient = createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError} = await userClient.auth.getUser();
    if (authError || !user) return json({error:'No autorizado'},401);
    const admin = createClient(url,service);
    const {data:solicitud,error:requestError} = await admin.rpc('solicitar_eliminacion',{p_usuario:user.id});
    if (requestError || !solicitud || typeof solicitud.lista !== 'boolean') throw new Error('No se pudo registrar la solicitud');
    if (!solicitud.lista) return json({
      ok:false,solicitud_recibida:true,solicitud:solicitud.solicitud,motivos:solicitud.motivos,
      error:'Registramos tu solicitud de borrado. Primero debemos resolver tus reservas o partidos futuros, pagos, devoluciones, saldo y retiros pendientes. No perdés tu dinero: contactá a soporte para liquidarlos y completar el cierre.',
    },409);
    // Remove blobs through Storage API before deleting Auth. A failed cleanup
    // leaves the account available to retry, never a fake success response.
    let previousBatch = '';
    for (;;) {
      const {data:files,error} = await admin.rpc('archivos_usuario',{p_usuario:user.id});
      if (error) throw error;
      if (!files?.length) break;
      const batch = JSON.stringify(files);
      if (batch === previousBatch) throw new Error('Storage cleanup did not make progress');
      previousBatch = batch;
      const groups = new Map<string,string[]>();
      for (const file of files) groups.set(file.bucket_id,[...(groups.get(file.bucket_id) ?? []),file.name]);
      for (const [bucket,paths] of groups) {
        const {error:removeError} = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw removeError;
      }
    }
    // profiles.id references auth.users ON DELETE CASCADE. One Auth deletion
    // removes profile/relational data atomically; no separate profile deletion.
    const {error:deleteError} = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return json({ok:true});
  } catch (error) {
    console.error('delete-user: operación incompleta');
    return json({error:'No pudimos eliminar la cuenta. Reintentá o contactá a soporte.'},500);
  }
});
