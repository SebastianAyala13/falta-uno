const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');

function fixture(options = {}) {
  const { error = null, thrown = null, env = {}, clientError = null } = options;
  const data = Object.hasOwn(options, 'data') ? options.data : true;
  const settings = {
    SALUD_MONITOR_SECRET: 'health-test-key', CONCILIACION_JOB_SECRET: 'job-test-key',
    SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-test-key', ...env,
  };
  const calls = [];
  let handler;
  const previous = global.Deno;
  global.Deno = { serve: fn => { handler = fn; } };
  try {
    loadTs('supabase/functions/estado-salud/index.ts', {
      'jsr:@supabase/supabase-js@2': { createClient: (...args) => {
        calls.push({ client: args });
        if (clientError) throw clientError;
        return { rpc: name => {
          calls.push({ rpc: name });
          return { abortSignal: async signal => {
            assert.ok(signal instanceof AbortSignal);
            if (thrown) throw thrown;
            return { data, error };
          } };
        } };
      } },
    });
  } finally { global.Deno = previous; }
  return { calls, invoke: async ({ key = 'health-test-key', method = 'GET' } = {}) => {
    const prev = global.Deno;
    global.Deno = { env: { get: name => settings[name] } };
    try {
      return await handler(new Request('https://example.test/functions/v1/estado-salud', {
        method, headers: key === null ? {} : { 'X-Salud-Key': key },
      }));
    } finally { global.Deno = prev; }
  } };
}

async function expectResponse(response, status, ok) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { ok });
}

for (const [label, key] of [['absent', null], ['empty', ''], ['incorrect', 'wrong-key'], ['job key', 'job-test-key']]) {
  test(`health rejects ${label} key before accessing the database`, async () => {
    const f = fixture();
    await expectResponse(await f.invoke({ key }), 401, false);
    assert.deepEqual(f.calls, []);
  });
}
for (const secret of [undefined, '', '   ']) {
  test(`health fails closed with ${JSON.stringify(secret)} configuration`, async () => {
    const f = fixture({ env: { SALUD_MONITOR_SECRET: secret } });
    await expectResponse(await f.invoke(), 401, false);
    assert.deepEqual(f.calls, []);
  });
}
test('health rejects accidental reuse of the reconciliation secret', async () => {
  const f = fixture({ env: { CONCILIACION_JOB_SECRET: 'health-test-key' } });
  await expectResponse(await f.invoke(), 401, false);
  assert.deepEqual(f.calls, []);
});
test('healthy RPC returns exactly one boolean and uses only the health RPC', async () => {
  const f = fixture();
  await expectResponse(await f.invoke(), 200, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].rpc, 'estado_salud');
});
test('alarm RPC returns exactly ok false with status 503', async () => {
  await expectResponse(await fixture({ data: false }).invoke(), 503, false);
});
test('database errors and thrown exceptions never disclose details or return 500', async () => {
  for (const options of [
    { data: true, error: { message: 'private database detail' } },
    { thrown: new Error('private database detail') },
    { clientError: new Error('private configuration detail') },
  ]) await expectResponse(await fixture(options).invoke(), 503, false);
});
test('missing database settings return only ok false', async () => {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const f = fixture({ env: { [name]: '' } });
    await expectResponse(await f.invoke(), 503, false);
    assert.deepEqual(f.calls, []);
  }
});
test('only a literal RPC boolean true can declare health', async () => {
  for (const data of [null, undefined, 'true', 1, [], { ok: true, private: 'detail' }]) {
    await expectResponse(await fixture({ data }).invoke(), 503, false);
  }
});
test('authenticated non-GET requests are rejected without database access', async () => {
  const f = fixture();
  await expectResponse(await f.invoke({ method: 'POST' }), 405, false);
  assert.deepEqual(f.calls, []);
});
