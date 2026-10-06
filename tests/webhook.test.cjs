const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {loadTs}=require('./load-ts.cjs');
const env={RAPYD_ACCESS_KEY:'test-access',RAPYD_SECRET_KEY:'test-secret',RAPYD_WEBHOOK_URL:'https://example.test/webhook',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-service'};
function fixture(error=null){
 let handler;const calls=[];const previous=global.Deno;
 global.Deno={env:{get:key=>env[key]},serve:fn=>{handler=fn;}};
 try{loadTs('supabase/functions/rapyd-webhook/index.ts',{'jsr:@supabase/supabase-js@2':{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{confirmado:true},error};}})}});}finally{global.Deno=previous;}
 return {calls,invoke:async req=>{const old=global.Deno;global.Deno={env:{get:key=>env[key]}};try{return await handler(req);}finally{global.Deno=old;}}};
}
function request(data={},signature){const body=JSON.stringify({type:'PAYMENT_COMPLETED',data:{merchant_reference_id:'REF',amount:12000,currency:'COP',...data}});const salt='test-salt',timestamp='1791244800';const hex=createHmac('sha256',env.RAPYD_SECRET_KEY).update(env.RAPYD_WEBHOOK_URL+salt+timestamp+env.RAPYD_ACCESS_KEY+env.RAPYD_SECRET_KEY+body).digest('hex');return new Request(env.RAPYD_WEBHOOK_URL,{method:'POST',body,headers:{salt,timestamp,signature:signature??Buffer.from(hex).toString('base64')}});}
test('webhook rejects invalid signatures without database writes',async()=>{const f=fixture();assert.equal((await f.invoke(request({},'invalid'))).status,401);assert.equal(f.calls.length,0);});
test('webhook rejects wrong currency and fractional amounts',async()=>{const f=fixture();assert.equal((await f.invoke(request({currency:'USD'}))).status,400);assert.equal((await f.invoke(request({amount:12000.5}))).status,400);assert.equal(f.calls.length,0);});
test('signed webhook invokes one atomic transaction with exact amount',async()=>{const f=fixture();assert.equal((await f.invoke(request())).status,200);assert.deepEqual(f.calls,[{name:'confirmar_pago_online',args:{p_referencia:'REF',p_monto:12000,p_moneda:'COP',p_proveedor_pago_id:null}}]);});
test('failed transaction returns a retryable response',async()=>{const f=fixture({message:'transaction failed'});const old=console.error;console.error=()=>{};try{assert.equal((await f.invoke(request())).status,500);}finally{console.error=old;}});

test('webhook preserves provider payment ID for late refund reconciliation',async()=>{const f=fixture();assert.equal((await f.invoke(request({id:'payment-test'}))).status,200);assert.equal(f.calls[0].args.p_proveedor_pago_id,'payment-test');});
