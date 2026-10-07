const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTs}=require('./load-ts.cjs');
async function anonymous(name,configured=true){
 const env={SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',CONCILIACION_JOB_SECRET:'fixture-job',RAPYD_ACCESS_KEY:'fixture-access',RAPYD_SECRET_KEY:'fixture-key',RAPYD_WEBHOOK_URL:'https://example.test/webhook'};
 if(!configured){delete env.RAPYD_ACCESS_KEY;delete env.RAPYD_SECRET_KEY;delete env.RAPYD_WEBHOOK_URL;}
 const prevD=global.Deno,prevF=global.fetch;let handler,dbCalls=0,httpCalls=0;
 global.Deno={env:{get:key=>env[key]},serve:f=>handler=f};
 global.fetch=async()=>{httpCalls++;throw new Error('Unexpected external request');};
 try{
  loadTs(`supabase/functions/${name}/index.ts`,{'jsr:@supabase/supabase-js@2':{createClient:()=>{dbCalls++;throw new Error('Unexpected DB access');}}});
  const response=await handler(new Request(`https://example.test/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
  return {status:response.status,dbCalls,httpCalls};
 }finally{global.Deno=prevD;global.fetch=prevF;}
}
for(const name of ['rapyd-crear-checkout','rapyd-webhook','conciliar-pagos','moderar-contenido','delete-user']){
 test(`${name}: anonymous POST is 401 without database or external traffic`,async()=>{assert.deepEqual(await anonymous(name),{status:401,dbCalls:0,httpCalls:0});});
}
test('unconfigured webhook is 500 and performs no database/provider access',async()=>{assert.deepEqual(await anonymous('rapyd-webhook',false),{status:500,dbCalls:0,httpCalls:0});});
