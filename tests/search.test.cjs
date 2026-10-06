const {test}=require('node:test');const assert=require('node:assert/strict');const {loadTs}=require('./load-ts.cjs');
const {patronBusqueda,buscarPartidos}=loadTs('lib/partidos.ts',{'@/lib/supabase':{supabaseConfigurado:true,supabase:{from(){const chain=new Proxy({},{get:(_,key)=>key==='then'?resolve=>resolve({data:[],error:{message:'offline'}}):()=>chain});return chain;}}}});
test('search escapes PostgREST syntax and SQL wildcards while preserving literal text',()=>{const pattern=patronBusqueda('A, or(id.gt.0) "50%_\\"');assert.equal(JSON.parse(pattern),'%A, or(id.gt.0) "50\\%\\_\\\\"%');});
test('failed filtered search rejects instead of showing a successful empty result',async()=>{await assert.rejects(buscarPartidos({texto:'Cancha'}),/offline/);});
