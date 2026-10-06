const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTs}=require('./load-ts.cjs');
const id='00000000-0000-0000-0000-000000000001';
function fixture({isAdmin=true,user={id:'moderator'},authError=null,roleError=null,removeError=null,resolveError=null,files=[{bucket_id:'media',name:'author/photo.jpg'}]}={}){
 let handler;const calls=[];
 const env={SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};
 const userClient={auth:{getUser:async()=>({data:{user},error:authError})},rpc:async(name,args)=>{calls.push({userRpc:name,args});return {data:name==='is_admin'?isAdmin:null,error:name==='is_admin'?roleError:resolveError};}};
 const service={rpc:async(name,args)=>{calls.push({serviceRpc:name,args});return {data:files,error:null};},storage:{from:bucket=>({remove:async paths=>{calls.push({bucket,paths});return {error:removeError};}})}};
 const old=global.Deno;global.Deno={serve:f=>{handler=f}};
 try{loadTs('supabase/functions/moderar-contenido/index.ts',{'jsr:@supabase/supabase-js@2':{createClient:(_url,key)=>key==='service'?service:userClient}});}finally{global.Deno=old;}
 return {calls,invoke:async({method='POST',authorization='Bearer token',body={reporte:id,estado:'resuelto',eliminar:true},raw}={})=>{
  const prev=global.Deno,logger=console.error;global.Deno={env:{get:k=>env[k]}};console.error=()=>{};
  try{return await handler(new Request('https://example.test/moderar',{method,headers:{...(authorization?{Authorization:authorization}:{}),'Content-Type':'application/json'},...(['GET','OPTIONS'].includes(method)?{}:{body:raw??JSON.stringify(body)})}));}finally{global.Deno=prev;console.error=logger;}
 }};
}
test('only admins can remove reported files or resolve moderation reports',async()=>{const f=fixture({isAdmin:false});assert.equal((await f.invoke()).status,403);assert.equal(f.calls.filter(c=>c.serviceRpc||c.bucket).length,0);});
test('moderation deletes reported image before resolving with caller identity',async()=>{const f=fixture();assert.equal((await f.invoke()).status,200);assert.deepEqual(f.calls.at(-1),{userRpc:'admin_resolver_reporte',args:{p_reporte:id,p_estado:'resuelto',p_eliminar:true}});assert.deepEqual(f.calls[2],{bucket:'media',paths:['author/photo.jpg']});});
test('failed image removal keeps report pending rather than claiming success',async()=>{const f=fixture({removeError:{message:'storage failed'}});assert.equal((await f.invoke()).status,500);assert.equal(f.calls.filter(c=>c.userRpc==='admin_resolver_reporte').length,0);});
test('moderation rejects missing/expired auth and disallowed HTTP methods before service access',async()=>{
 const missing=fixture();assert.equal((await missing.invoke({authorization:null})).status,401);assert.equal(missing.calls.length,0);
 const expired=fixture({user:null,authError:{message:'expired'}});assert.equal((await expired.invoke()).status,401);assert.equal(expired.calls.length,0);
 const method=fixture();assert.equal((await method.invoke({method:'GET'})).status,405);assert.equal((await method.invoke({method:'OPTIONS'})).status,200);assert.equal(method.calls.length,0);
});
test('moderation rejects malformed requests without removing objects',async()=>{
 for(const request of [{raw:'{'},{body:null},{body:[]},{body:{reporte:'invalid',estado:'resuelto',eliminar:true}},{body:{reporte:id,estado:'resuelto',eliminar:'true'}},{body:{reporte:id,estado:'unknown',eliminar:true}}]){
  const f=fixture();assert.equal((await f.invoke(request)).status,400);assert.equal(f.calls.filter(c=>c.serviceRpc||c.bucket).length,0);
 }
});
test('moderation refuses role lookup failure without service access',async()=>{const f=fixture({roleError:{message:'offline'}});assert.equal((await f.invoke()).status,403);assert.equal(f.calls.filter(c=>c.serviceRpc||c.bucket).length,0);});
test('discarding without deletion never invokes Storage',async()=>{const f=fixture();assert.equal((await f.invoke({body:{reporte:id,estado:'descartado',eliminar:false}})).status,200);assert.equal(f.calls.filter(c=>c.serviceRpc||c.bucket).length,0);});
test('moderation batches owned objects and propagates final SQL failure',async()=>{
 const files=Array.from({length:205},(_,n)=>({bucket_id:'media',name:`author/${n}.jpg`}));files.push({bucket_id:'canchas',name:'author/court.jpg'});
 const f=fixture({files,resolveError:{message:'retry'}});assert.equal((await f.invoke()).status,500);
 assert.deepEqual(f.calls.filter(c=>c.bucket).map(c=>c.paths.length),[100,100,5,1]);assert.equal(f.calls.at(-1).userRpc,'admin_resolver_reporte');
});
