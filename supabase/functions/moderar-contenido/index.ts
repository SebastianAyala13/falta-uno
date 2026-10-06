import { createClient } from 'jsr:@supabase/supabase-js@2';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if (req.method!=='POST') return json({error:'Método no permitido'},405);
  try {
    const authorization=req.headers.get('Authorization');
    if (!authorization) return json({error:'No autorizado'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if (authError || !user) return json({error:'No autorizado'},401);
    const {data:admin,error:roleError}=await userClient.rpc('is_admin');
    if (roleError || !admin) return json({error:'No autorizado'},403);
    let body;
    try { body=await req.json(); } catch { return json({error:'Solicitud inválida'},400); }
    if (!body || typeof body!=='object' || Array.isArray(body)) return json({error:'Solicitud inválida'},400);
    const {reporte,estado,eliminar}=body;
    if (typeof reporte!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reporte)
      || !['resuelto','descartado'].includes(estado) || typeof eliminar!=='boolean') return json({error:'Solicitud inválida'},400);
    if (eliminar) {
      const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const {data:files,error}=await service.rpc('archivos_reporte',{p_reporte:reporte});
      if (error) throw error;
      const buckets=new Map<string,string[]>();
      for (const file of files ?? []) buckets.set(file.bucket_id,[...(buckets.get(file.bucket_id) ?? []),file.name]);
      for (const [bucket,paths] of buckets) {
        for (let i=0;i<paths.length;i+=100) {
          const {error:removeError}=await service.storage.from(bucket).remove(paths.slice(i,i+100));
          if (removeError) throw removeError;
        }
      }
    }
    // Preserve caller identity: SQL independently revalidates is_admin().
    const {error}=await userClient.rpc('admin_resolver_reporte',{p_reporte:reporte,p_estado:estado,p_eliminar:eliminar});
    if (error) throw error;
    return json({ok:true});
  } catch (error) {
    console.error('moderar-contenido: operación incompleta');
    return json({error:'No pudimos completar la moderación. Reintentá.'},500);
  }
});
