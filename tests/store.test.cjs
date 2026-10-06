const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');

async function fixture({ backend = false, execute = () => ({ data: [], error: null }) } = {}) {
  const requests = [];
  const client = {
    from(table) {
      const request = { table, calls: [] };
      const chain = new Proxy({}, {
        get(_target, name) {
          if (name === 'then') return (resolve, reject) => {
            requests.push(request);
            return Promise.resolve().then(() => execute(request)).then(resolve, reject);
          };
          return (...args) => { request.calls.push([name, ...args]); return chain; };
        },
      });
      return chain;
    },
    rpc(name, args) { requests.push({ rpc: name, args }); return Promise.resolve(execute({ rpc: name, args })); },
  };
  const storage = new Map();
  const { useStore } = loadTs('lib/store.ts', {
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async key => { storage.delete(key); },
    },
    '@/constants/colors': { setActiveColors() {} },
    '@/constants/themes': { DEFAULT_THEME_ID: 'estadio' },
    '@/lib/supabase': { supabase: client, supabaseConfigurado: backend },
  });
  await useStore.persist.rehydrate();
  const partido = {
    id: 'p', organizador_id: 'organizador', cancha: 'Cancha', zona: 'Centro',
    fecha: '2099-10-05', hora: '20:00', precio: 10000, formato: '5v5', nivel: 'Casual',
    cupos_totales: 2, cupos_ocupados: 1, created_at: '2026-10-05T00:00:00Z',
  };
  useStore.setState({ partidos: [partido], inscritos: [], pagos: [] });
  return { store: useStore, requests, partido };
}

test('cash enrollment charges the displayed price, with zero commission', async () => {
  const { store } = await fixture();
  const pago = await store.getState().inscribirse('p', 'jugador', 'efectivo', 'pendiente');
  assert.equal(pago.monto, 10000);
  assert.equal(pago.comision, 0);
});

test('double tap/retry does not create a second payment or consume another place', async () => {
  const { store } = await fixture();
  const first = await store.getState().inscribirse('p', 'jugador', 'efectivo', 'pendiente');
  const again = await store.getState().inscribirse('p', 'jugador', 'efectivo', 'pendiente');
  assert.equal(again.id, first.id);
  assert.equal(store.getState().pagos.length, 1);
  assert.equal(store.getState().partidos[0].cupos_ocupados, 2);
});

test('full matches and client-supplied approvals are rejected', async () => {
  const { store, partido } = await fixture();
  store.setState({ partidos: [{ ...partido, cupos_ocupados: 2 }] });
  await assert.rejects(store.getState().inscribirse('p', 'jugador', 'efectivo', 'pendiente'), /lleno/);
  store.setState({ partidos: [partido] });
  await assert.rejects(store.getState().inscribirse('p', 'jugador', 'online', 'aprobado'), /servidor|pendiente/);
});

test('backend query errors preserve existing data and remain visible', async () => {
  const { store, partido } = await fixture({ backend: true, execute: () => ({ data: null, error: { message: 'offline' } }) });
  await store.getState().hidratar('jugador');
  assert.deepEqual(store.getState().partidos, [partido]);
  assert.equal(store.getState().hidratado, false);
  assert.ok(store.getState().errorCarga);
});

test('concurrent hydration is shared and fresh reads are cached, forced refresh still loads', async () => {
  const { store, requests } = await fixture({ backend: true });
  await Promise.all([store.getState().hidratar('jugador'), store.getState().hidratar('jugador')]);
  const count = requests.length;
  assert.equal(requests.filter(r => r.table === 'partidos' && r.calls.some(c => c[0] === 'gte')).length, 1);
  await store.getState().hidratar('jugador');
  assert.equal(requests.length, count);
  await store.getState().hidratar('jugador', true);
  assert.ok(requests.length > count);
  assert.equal(requests.filter(r => r.table === 'comentarios' || r.table === 'post_likes').length, 0);
});

test('logout invalidates pending reads and clears private state', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { store } = await fixture({ backend: true, execute: () => pending });
  store.getState().reiniciarSesion('jugador');
  const loading = store.getState().hidratar('jugador');
  await new Promise(resolve => setImmediate(resolve));
  store.getState().reiniciarSesion(null);
  release({ data: [], error: null });
  await loading;
  assert.equal(store.getState().hidratado, false);
  assert.equal(store.getState().usuarioId, null);
  assert.deepEqual(store.getState().pagos, []);
  assert.deepEqual(store.getState().inscritos, []);
});

test('failed remote enrollment never manufactures a local receipt', async () => {
  const { store } = await fixture({ backend: true, execute: () => ({ data: null, error: { message: 'payment failed' } }) });
  await assert.rejects(store.getState().inscribirse('p', 'jugador', 'efectivo', 'pendiente'));
  assert.equal(store.getState().pagos.length, 0);
  assert.equal(store.getState().inscritos.length, 0);
});

test('likes, comments, ratings and moderation do not claim success after a server rejection', async () => {
  const {store} = await fixture({backend:true,execute:() => ({data:null,error:{message:'permission denied'}})});
  store.setState({posts:[{id:'7c10b45d-4084-4665-8525-e62c1b6dd581',likes:[],tipo:'pregunta',like_count:0}],
    partidos:[{id:'p',fecha:'2020-10-05',hora:'20:00',organizador_id:'org'}],inscritos:['p']});
  await assert.rejects(store.getState().toggleLike('7c10b45d-4084-4665-8525-e62c1b6dd581','jugador'));
  await assert.rejects(store.getState().comentar('uuid-post',{id:'jugador',nombre:'Jugador'},'Hola'));
  await assert.rejects(store.getState().calificarPartido('p','jugador',{estrellas:5,organizador_estrellas:5,hubo_no_show:false,comentario:''}));
  await assert.rejects(store.getState().bloquearUsuario('otro','jugador'));
  await assert.rejects(store.getState().reportarContenido({tipo:'post',contenido_id:'uuid-post',autor_id:'otro',reportado_por:'jugador',motivo:'spam',texto:'Hola'}));
  assert.equal(store.getState().posts[0].like_count,0);
  assert.deepEqual(store.getState().comentarios,{});
  assert.deepEqual(store.getState().calificaciones,[]);
  assert.deepEqual(store.getState().bloqueados,[]);
  assert.deepEqual(store.getState().reportes,[]);
});

test('remote comment uses the database ID rather than an unreportable local ID', async () => {
  const row={id:'database-comment-id',post_id:'uuid-post',autor_id:'jugador',texto:'Hola',created_at:'2026-10-05T20:00:00Z'};
  const {store}=await fixture({backend:true,execute:()=>({data:row,error:null})});
  await store.getState().comentar('uuid-post',{id:'jugador',nombre:'Jugador'},'Hola');
  assert.equal(store.getState().comentarios['uuid-post'][0].id,'database-comment-id');
});

test('repeated local exits do not decrement capacity twice; organizers cannot leave their own place', async () => {
  const {store,partido}=await fixture();
  await store.getState().inscribirse('p','jugador','efectivo','pendiente');
  await store.getState().salirse('p','jugador');
  await store.getState().salirse('p','jugador');
  assert.equal(store.getState().partidos[0].cupos_ocupados,1);
  store.setState({partidos:[{...partido,organizador_id:'jugador'}],inscritos:['p']});
  await assert.rejects(store.getState().salirse('p','jugador'),/organizador/);
});
