import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'node:crypto';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method!=='POST') return json({error:'Método no permitido'},405);
  const secret=Deno.env.get('CONCILIACION_JOB_SECRET');
  const given=new TextEncoder().encode(req.headers.get('Authorization') ?? '');
  const expected=new TextEncoder().encode(`Bearer ${secret}`);
  if(!secret || given.length!==expected.length || !timingSafeEqual(given,expected)) return json({error:'No autorizado'},401);
  try{
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:expired,error}=await db.rpc('caducar_pagos_pendientes',{p_limite:100});
    if(error) throw new Error('caducidad');
    // Explicit activation after sandbox certification; expiry remains available.
    if(Deno.env.get('RAPYD_REEMBOLSOS_ACTIVOS')!=='true') return json({ok:true,caducados:expired,reembolsos:'desactivados'});
    const access=Deno.env.get('RAPYD_ACCESS_KEY'),key=Deno.env.get('RAPYD_SECRET_KEY');
    if(!access || !key) throw new Error('configuracion');
    const base=Deno.env.get('RAPYD_BASE_URL') || 'https://sandboxapi.rapyd.net';
    if(!['https://sandboxapi.rapyd.net','https://api.rapyd.net'].includes(base)) throw new Error('endpoint');
    const {data:job,error:claimError}=await db.rpc('tomar_reembolso');
    if(claimError) throw new Error('claim');
    if(!job) return json({ok:true,caducados:expired,reembolso:'sin_pendientes'});
    let status='revision_manual',refundId:string|null=job.proveedor_reembolso_id,errorCode:string|null=null;
    try{
      if(!job.proveedor_pago_id || !/^[a-zA-Z0-9_-]{1,150}$/.test(job.proveedor_pago_id)) throw new Error('falta_pago_proveedor');
      if(refundId && !/^[a-zA-Z0-9_-]{1,150}$/.test(refundId)) throw new Error('referencia_proveedor_invalida');
      const method=refundId?'get':'post';
      const path=refundId?`/v1/refunds/${refundId}`:'/v1/refunds';
      const body=refundId?'':JSON.stringify({payment:job.proveedor_pago_id,amount:job.monto});
      const salt=crypto.randomUUID().replace(/-/g,''),timestamp=Math.floor(Date.now()/1000).toString();
      const signature=btoa(createHmac('sha256',key).update(method+path+salt+timestamp+access+key+body).digest('hex'));
      const response=await fetch(base+path,{method:method.toUpperCase(),headers:{'Content-Type':'application/json',access_key:access,salt,timestamp,signature,idempotency:job.id},...(body?{body}:{}),signal:AbortSignal.timeout(20000)});
      const out=await response.json();
      if(!response.ok || out?.status?.status!=='SUCCESS') throw new Error('respuesta_proveedor');
      const data=out.data;
      if(!data?.id || (refundId && data.id!==refundId) || data.payment!==job.proveedor_pago_id || Number(data.amount)!==job.monto || data.currency!=='COP') throw new Error('reembolso_no_coincide');
      refundId=data.id;
      // Only actual completed provider status closes the debt; accepted POST does not.
      if(data.status==='COM') status='reembolsado';
      else if(['PEN','NEW'].includes(data.status)) status='proveedor_pendiente';
      else throw new Error('estado_proveedor_requiere_revision');
    }catch{
      errorCode='Verificar reembolso en proveedor antes de reintentar';
      // Network ambiguity is never blindly retried. The job stays visible to admins.
    }
    const {error:saveError}=await db.rpc('registrar_reembolso',{p_id:job.id,p_token:job.lease_token,p_estado:status,p_proveedor_id:refundId,p_error:errorCode});
    if(saveError) throw new Error('persistencia');
    return json({ok:true,caducados:expired,reembolso:status});
  }catch{
    console.error('conciliar-pagos: operación incompleta');
    return json({error:'No se pudo completar la conciliación'},500);
  }
});
