#!/usr/bin/env node

/**
 * Configura Auth del proyecto de Supabase en la nube (Management API).
 *
 * Arregla de una vez las tres cosas que rompen el registro en producción:
 *   1. El límite de 2 correos/hora del SMTP que trae Supabase por defecto, que
 *      hace fallar "Crear cuenta" con `over_email_send_rate_limit`.
 *   2. El Site URL apuntando a localhost: el enlace del correo de confirmación
 *      no lleva a ningún lado usable.
 *   3. La lista de redirecciones permitidas, que debe incluir el deep link
 *      `faltauno://reset` que usa resetPasswordForEmail en lib/auth.tsx.
 *
 * Uso:
 *   # ver la configuración actual, sin tocar nada
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configurar-auth.js --ver
 *
 *   # modo pruebas: apaga la confirmación por correo (registro instantáneo)
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configurar-auth.js --sin-confirmacion
 *
 *   # modo producción: SMTP propio + confirmación encendida + límite a 30/hora
 *   SUPABASE_ACCESS_TOKEN=sbp_... SMTP_HOST=smtp.resend.com SMTP_USER=resend \
 *   SMTP_PASS=re_... SMTP_FROM=no-reply@sudominio.com \
 *   node scripts/configurar-auth.js --con-smtp
 *
 * El token se saca en https://supabase.com/dashboard/account/tokens
 * (o se deja en .supabase-deploy.env, que ya está en .gitignore).
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SITIO = 'https://falta-uno.kodarify.com';
// Glob de redirecciones permitidas: la web y el esquema nativo de la app.
const REDIRECCIONES = [`${SITIO}/**`, 'faltauno://**'].join(',');

/** Lee un .env sencillo (KEY=valor) y lo vuelca en un objeto. */
function leerEnv(archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return {};
  const vars = {};
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

const env = { ...leerEnv('.env'), ...leerEnv('.supabase-deploy.env'), ...process.env };

const token = (env.SUPABASE_ACCESS_TOKEN || '').trim();
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN (empieza con sbp_).');
  console.error('Sacalo en https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

// El "project ref" es el subdominio de la URL de Supabase.
const url = (env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const ref = (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!ref) {
  console.error('No pude deducir el project ref de EXPO_PUBLIC_SUPABASE_URL en .env');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

/** Campos que nos importan, para mostrar antes/después. */
const INTERESANTES = [
  'site_url',
  'uri_allow_list',
  'mailer_autoconfirm',
  'external_email_enabled',
  'smtp_host',
  'smtp_admin_email',
  'rate_limit_email_sent',
  'disable_signup',
];

function resumen(config) {
  const out = {};
  for (const k of INTERESANTES) out[k] = config[k];
  return out;
}

async function pedir(metodo, cuerpo) {
  const res = await fetch(API, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`${metodo} ${res.status} ${res.statusText}\n${texto}`);
  }
  return JSON.parse(texto);
}

function armarCambios(modo) {
  // Común a los dos modos: a dónde vuelve el usuario desde los correos.
  const cambios = { site_url: SITIO, uri_allow_list: REDIRECCIONES };

  if (modo === '--sin-confirmacion') {
    // El usuario queda confirmado al registrarse: no se envía correo, no hay
    // cuota que gastar. lib/auth.tsx ya crea el perfil con la sesión inmediata.
    cambios.mailer_autoconfirm = true;
    return cambios;
  }

  // --con-smtp: correo propio, confirmación encendida y límite razonable.
  const faltan = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].filter((k) => !env[k]);
  if (faltan.length) {
    console.error(`Para --con-smtp faltan estas variables: ${faltan.join(', ')}`);
    process.exit(1);
  }
  cambios.mailer_autoconfirm = false;
  cambios.external_email_enabled = true;
  cambios.smtp_host = env.SMTP_HOST;
  cambios.smtp_port = Number(env.SMTP_PORT || 587);
  cambios.smtp_user = env.SMTP_USER;
  cambios.smtp_pass = env.SMTP_PASS;
  cambios.smtp_admin_email = env.SMTP_FROM;
  cambios.smtp_sender_name = env.SMTP_SENDER_NAME || 'Falta Uno';
  cambios.rate_limit_email_sent = Number(env.RATE_LIMIT_EMAIL || 30);
  return cambios;
}

(async () => {
  const modo = process.argv[2] || '--ver';
  const validos = ['--ver', '--sin-confirmacion', '--con-smtp'];
  if (!validos.includes(modo)) {
    console.error(`Modo desconocido: ${modo}\nUsá uno de: ${validos.join(' | ')}`);
    process.exit(1);
  }

  console.log(`Proyecto: ${ref}\n`);
  const antes = await pedir('GET');
  console.log('── Antes ──');
  console.log(resumen(antes));

  if (modo === '--ver') {
    console.log('\n(solo lectura, no se cambió nada)');
    return;
  }

  const cambios = armarCambios(modo);
  // La contraseña del SMTP no se imprime.
  const visible = { ...cambios };
  if (visible.smtp_pass) visible.smtp_pass = '***';
  console.log('\n── Aplicando ──');
  console.log(visible);

  await pedir('PATCH', cambios);

  // Releemos para confirmar que quedó, en vez de confiar en el 200 del PATCH.
  const despues = await pedir('GET');
  console.log('\n── Después ──');
  console.log(resumen(despues));

  const ok = Object.keys(cambios)
    .filter((k) => k !== 'smtp_pass')
    .every((k) => String(despues[k]) === String(cambios[k]));
  console.log(ok ? '\nListo: la configuración quedó aplicada.' : '\nOJO: algún campo no quedó como se pidió, revisá el panel.');
  if (!ok) process.exitCode = 1;
})().catch((e) => {
  // exitCode en vez de exit(): en Windows, cortar el proceso con el fetch todavía
  // abierto dispara un assert de libuv y enmascara el código de salida real.
  console.error(`\nFalló: ${e.message}`);
  process.exitCode = 1;
});
