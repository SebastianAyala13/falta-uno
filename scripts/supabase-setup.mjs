#!/usr/bin/env node
/**
 * Migración/deploy automático a Supabase — un solo comando.
 *
 *   node scripts/supabase-setup.mjs [--schema] [--functions] [--secrets]
 *   (sin flags = hace todo lo que tenga credenciales para hacer)
 *
 * Lee credenciales de `.supabase-deploy.env` (gitignoreado, NUNCA se commitea).
 * Ver `.supabase-deploy.env.example` para el formato.
 *
 * - schema:    aplica supabase/schema.sql al Postgres (idempotente, re-ejecutable).
 * - functions: despliega las Edge Functions (wompi + delete-user) con el CLI.
 * - secrets:   carga los secretos de Wompi con `supabase secrets set --env-file`
 *              (así los valores NUNCA aparecen en la línea de comandos ni en logs).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REF = 'gwkzcjgsuxgqejaukbse';
const ENV_FILE = '.supabase-deploy.env';
const SCHEMA = 'supabase/schema.sql';
const FUNCS_WEBHOOK = ['wompi-webhook']; // van con --no-verify-jwt
const FUNCS_JWT = ['wompi-crear-transaccion', 'delete-user'];
const SECRET_KEYS = ['WOMPI_PUBLIC_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET', 'WOMPI_REDIRECT_URL'];

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnv(ENV_FILE), ...process.env };
const args = process.argv.slice(2);
const todo = args.length === 0;
const want = (f) => todo || args.includes(f);

const sh = (cmd, cmdArgs, extraEnv = {}) =>
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', shell: true, env: { ...env, ...extraEnv } });

let hizoAlgo = false;

// ── 1. SCHEMA ────────────────────────────────────────────────────────────────
if (want('--schema')) {
  if (!env.SUPABASE_DB_URL) {
    console.log('⏭️  schema: falta SUPABASE_DB_URL en ' + ENV_FILE + ' — lo salto.');
  } else {
    const { default: pg } = await import('pg');
    const sql = readFileSync(SCHEMA, 'utf8');
    // TLS verificado (nada de rejectUnauthorized:false). El pooler de Supabase
    // (aws-*.pooler.supabase.com) tiene cert público de confianza. Si usás la
    // conexión directa, bajá la CA de Supabase y apuntá SUPABASE_CA_CERT a ella.
    const ssl = env.SUPABASE_CA_CERT
      ? { ca: readFileSync(env.SUPABASE_CA_CERT, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: true };
    const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl });
    await client.connect();
    try {
      await client.query(sql);
      console.log('✅ schema.sql aplicado a Supabase');
    } finally {
      await client.end();
    }
    hizoAlgo = true;
  }
}

// ── 2. FUNCTIONS ─────────────────────────────────────────────────────────────
if (want('--functions')) {
  if (!env.SUPABASE_ACCESS_TOKEN) {
    console.log('⏭️  functions: falta SUPABASE_ACCESS_TOKEN — lo salto.');
  } else {
    for (const fn of FUNCS_JWT) {
      console.log(`🚀 deploy ${fn}`);
      sh('pnpm', ['dlx', 'supabase', 'functions', 'deploy', fn, '--project-ref', REF]);
    }
    for (const fn of FUNCS_WEBHOOK) {
      console.log(`🚀 deploy ${fn} (--no-verify-jwt)`);
      sh('pnpm', ['dlx', 'supabase', 'functions', 'deploy', fn, '--no-verify-jwt', '--project-ref', REF]);
    }
    hizoAlgo = true;
  }
}

// ── 3. SECRETS ───────────────────────────────────────────────────────────────
if (want('--secrets')) {
  const presentes = SECRET_KEYS.filter((k) => env[k]);
  if (!env.SUPABASE_ACCESS_TOKEN || presentes.length === 0) {
    console.log('⏭️  secrets: falta SUPABASE_ACCESS_TOKEN o llaves de Wompi — lo salto.');
  } else {
    // Archivo temporal para --env-file (los valores no van por argv/logs). Va en
    // un directorio temporal propio (0700) y el archivo en 0600, así ningún otro
    // usuario local puede leer los secretos durante el instante que existe.
    const dir = mkdtempSync(join(tmpdir(), 'supa-'));
    const tmp = join(dir, 'secrets.env');
    writeFileSync(tmp, presentes.map((k) => `${k}=${env[k]}`).join('\n') + '\n', { mode: 0o600 });
    try {
      console.log(`🔐 cargando secretos: ${presentes.join(', ')}`);
      sh('pnpm', ['dlx', 'supabase', 'secrets', 'set', '--env-file', tmp, '--project-ref', REF]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    hizoAlgo = true;
  }
}

if (!hizoAlgo) {
  console.log(`\nNada para hacer. Completá ${ENV_FILE} (ver ${ENV_FILE}.example) y volvé a correr.`);
  process.exit(1);
}
console.log('\n✨ Listo.');
