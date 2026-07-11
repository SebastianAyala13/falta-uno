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
import dns from 'node:dns/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';

/** Resuelve un host a IP con reintentos (Supabase a veces tiene DNS flaky). */
async function resolveHost(host, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const { address } = await dns.lookup(host);
      return address;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw last;
}

/** DER -> PEM. */
function certToPem(raw) {
  return `-----BEGIN CERTIFICATE-----\n${raw.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
}

/**
 * Obtiene la CA raíz que presenta el servidor Postgres (Trust-On-First-Use).
 * Postgres no habla TLS directo: primero se negocia con un SSLRequest y recién
 * ahí se sube a TLS sobre el mismo socket. Este socket NO transmite datos de la
 * app: solo lee la cadena de certificados para FIJAR la CA y verificar contra
 * ella la conexión real (que sí usa rejectUnauthorized:true).
 */
function fetchRootCa(host, port, servername = host) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port }, () => {
      const req = Buffer.alloc(8);
      req.writeInt32BE(8, 0); // longitud
      req.writeInt32BE(80877103, 4); // código SSLRequest de Postgres
      sock.write(req);
    });
    sock.once('data', (resp) => {
      if (resp[0] !== 0x53 /* 'S' */) {
        sock.end();
        return reject(new Error('el servidor Postgres no ofrece SSL'));
      }
      const tlsSock = tls.connect({ socket: sock, servername, rejectUnauthorized: false }, () => {
        let cert = tlsSock.getPeerCertificate(true);
        const visto = new Set();
        while (
          cert?.issuerCertificate &&
          cert.fingerprint256 &&
          !visto.has(cert.fingerprint256) &&
          cert.issuerCertificate.fingerprint256 !== cert.fingerprint256
        ) {
          visto.add(cert.fingerprint256);
          cert = cert.issuerCertificate;
        }
        const pem = cert?.raw ? certToPem(cert.raw) : null;
        tlsSock.end();
        pem ? resolve(pem) : reject(new Error('no se pudo leer la CA del servidor'));
      });
      tlsSock.on('error', reject);
    });
    sock.on('error', reject);
  });
}

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
    // Resolvemos la IP una vez (DNS de Supabase a veces es flaky) y conectamos a
    // la IP con SNI/verificación por hostname. TLS verificado: fijamos la CA (de
    // SUPABASE_CA_CERT si la diste, o la que presenta el servidor vía TOFU) y
    // exigimos rejectUnauthorized para la conexión real. Nunca datos sin verificar.
    const u = new URL(env.SUPABASE_DB_URL);
    const host = u.hostname;
    const port = Number(u.port || 5432);
    const ip = await resolveHost(host);
    const ca = env.SUPABASE_CA_CERT ? readFileSync(env.SUPABASE_CA_CERT, 'utf8') : await fetchRootCa(ip, port, host);
    const client = new pg.Client({
      host: ip,
      port,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'postgres',
      ssl: { ca, rejectUnauthorized: true, servername: host },
    });
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
