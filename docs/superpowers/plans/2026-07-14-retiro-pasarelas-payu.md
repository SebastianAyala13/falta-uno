# Retiro de pasarelas + andamiaje PayU — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Retirar todo el código de Mercado Pago, Lemon Squeezy y Wompi; dejar la app funcional en solo-efectivo con un seam de PayU listo (config + edge functions stub + columna DB genérica), y una migración que limpia el esquema.

**Architecture:** Swap con limpieza. Se preserva la forma del flujo (medio `online`, checkout que recomputa el monto en el servidor, webhook como único escritor del estado final) y se cambia el proveedor concreto Wompi → PayU. El esquema DB ya es casi agnóstico de proveedor; el único rastro específico (`retiros.mp_payout_ref`) se renombra a genérico.

**Tech Stack:** Expo SDK 57 / RN 0.86 / TypeScript, NativeWind, Supabase (Postgres + RLS + Edge Functions Deno), migraciones con Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-07-14-retiro-pasarelas-payu-design.md`

## Global Constraints

- **Invariante de pagos (duro):** el cliente NUNCA marca `aprobado`. Efectivo → `pendiente` (partido) / `confirmada` (reserva) desde el cliente; el estado final online lo escribe SOLO el webhook del servidor tras validar la firma. Secretos solo en Edge Functions, jamás con prefijo `EXPO_PUBLIC_`.
- **Dualidad demo/backend:** el path de efectivo funciona sin backend. El online se gatea por `PAYU_CONFIGURADO`.
- **Copy visible sin em-dash (—).** Guion `-` o coma. Preservar acentos y voseo del código existente.
- **Export web debe compilar** (leer `EXPO_PUBLIC_*` con `?.trim() || fallback` donde aplique).
- **No hay test suite.** La "verificación" de cada tarea son los gates del repo: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec expo export --platform web`, `pnpm db:reset` (migración), y grep de regresión. Reemplazan los pasos TDD del skill.

## File Structure

- `constants/config.ts` — hub de tipos/flags de pago (Modify)
- `lib/payments.ts` — invoca la edge function de checkout (Modify)
- `lib/canchas.ts`, `lib/store.ts` — comentarios (Modify)
- `types/database.ts` — tipo `Retiro`, comentario (Modify)
- `app/checkout/[id].tsx`, `app/cancha/[id]/reservar.tsx`, `app/cancha/finanzas.tsx` — pantallas (Modify)
- `supabase/functions/{create-checkout,lemonsqueezy-webhook,wompi-crear-transaccion,wompi-webhook}/` — (Delete)
- `supabase/functions/payu-crear-transaccion/index.ts`, `supabase/functions/payu-webhook/index.ts` — (Create)
- `supabase/migrations/<timestamp>_retiro_pasarelas_payu.sql` — (Create)
- `docs/PAYU-SETUP.md` (Create), `docs/WOMPI-SETUP.md` (Delete), `README.md`, `CLAUDE.md` (Modify)

---

## Task 1: Capa cliente (TypeScript)

Migración de tipos + copy en todo el código de la app. Debe terminar tsc-verde: por eso los archivos acoplados al tipo (`MedioPagoId`/`provider`/flags) van juntos.

**Files:**
- Modify: `constants/config.ts`, `lib/payments.ts`, `lib/canchas.ts`, `lib/store.ts`, `types/database.ts`, `app/checkout/[id].tsx`, `app/cancha/[id]/reservar.tsx`, `app/cancha/finanzas.tsx`

**Interfaces:**
- Produces: `PAYU_CONFIGURADO: boolean`, `type MedioPagoId = 'efectivo' | 'online'`, `MedioPago.provider: 'payu' | 'efectivo'`. Task 2 (edge functions) consume el nombre `payu-crear-transaccion` que `payments.ts` invoca. Task 3 (migración) consume el nombre de columna `payout_ref` que `types/database.ts` usa.

- [ ] **Step 1: `constants/config.ts` — flags.** Eliminar los bloques `LEMONSQUEEZY_CONFIGURADO` (~L63-67) y `WOMPI_CONFIGURADO` (~L70-75). En su lugar:

```ts
/**
 * `true` cuando PayU está habilitado para esta build. PayU es el PSP colombiano
 * (Nequi, PSE, tarjeta). La llave privada NUNCA va en el cliente: vive en las
 * Edge Functions (`payu-crear-transaccion`, `payu-webhook`), sin prefijo EXPO_PUBLIC_.
 */
export const PAYU_CONFIGURADO = !!process.env.EXPO_PUBLIC_PAYU_ENABLED;
```

- [ ] **Step 2: `constants/config.ts` — tipo + interfaz + array de medios.** Reemplazar `MedioPagoId`, la interfaz `MedioPago` y el array `MEDIOS_PAGO` (~L79-135) por:

```ts
/**
 * `provider` marca quién procesa el pago: 'payu' abre un checkout externo real
 * confirmado por webhook en el servidor; 'efectivo' es acuerdo con el organizador.
 */
export type MedioPagoId = 'efectivo' | 'online';

export interface MedioPago {
  id: MedioPagoId;
  nombre: string;
  detalle: string;
  icon: string;
  provider: 'payu' | 'efectivo';
  instantaneo: boolean;
}

export const MEDIOS_PAGO: MedioPago[] = [
  {
    id: 'efectivo',
    nombre: 'Efectivo en cancha',
    detalle: 'Le pagás al organizador al llegar',
    icon: 'cash',
    provider: 'efectivo',
    instantaneo: false,
  },
  {
    id: 'online',
    nombre: 'Nequi, PSE o tarjeta',
    detalle: 'Pago seguro con PayU',
    icon: 'card',
    provider: 'payu',
    instantaneo: true,
  },
];
```

- [ ] **Step 3: `constants/config.ts` — activos.** Reemplazar `MEDIOS_PAGO_ACTIVOS` (~L137-148) por:

```ts
/**
 * Medios de pago ACTIVOS en producción.
 *
 * "Efectivo" está siempre (pago real al organizador en la cancha). "Online"
 * (PayU) aparece solo cuando `EXPO_PUBLIC_PAYU_ENABLED` está seteada: es un
 * checkout REAL procesado por PayU y confirmado por webhook en el servidor.
 * Nunca mostramos un pago simulado que finja "Aprobado": eso es causa de rechazo
 * en App Store (2.1) y Google Play.
 */
export const MEDIOS_PAGO_ACTIVOS: MedioPago[] = MEDIOS_PAGO.filter(
  (m) => m.id === 'efectivo' || (m.id === 'online' && PAYU_CONFIGURADO),
);
```

- [ ] **Step 4: `constants/config.ts` — membresía + MP.** En el comentario de `MEMBRESIA` (~L170) cambiar "Fase 2 (Mercado Pago)" → "(PayU)". Eliminar por completo el bloque `MERCADOPAGO_CONFIGURADO` con su comentario (~L178-184).

- [ ] **Step 5: `lib/payments.ts`.** Cambiar las 2 invocaciones `'wompi-crear-transaccion'` → `'payu-crear-transaccion'`. En `procesarPago`, el throw: `'Este medio se paga online con Wompi, no desde la app.'` → `'Este medio se paga online con PayU, no desde la app.'`. En los comentarios de cabecera y de las dos funciones, reemplazar toda mención de "Wompi" por "PayU" y `supabase/functions/wompi-webhook` → `supabase/functions/payu-webhook`.

- [ ] **Step 6: `lib/canchas.ts`.** Comentario de cabecera (~L7): "el cobro online (Mercado Pago) llega en Fase 2." → "el cobro online (PayU) llega en Fase 2."

- [ ] **Step 7: `lib/store.ts`.** Comentario (~L100): "la que se envió al checkout de Lemon Squeezy" → "la que se envió al checkout de PayU".

- [ ] **Step 8: `types/database.ts`.** En la interfaz `Retiro` (~L132) renombrar el campo `mp_payout_ref: string | null;` → `payout_ref: string | null;`. En el comentario de `Pago` (~L268) "real-ready para Wompi" → "real-ready para PayU".

- [ ] **Step 9: `app/checkout/[id].tsx`.** L56: `medio.provider === 'wompi'` → `medio.provider === 'payu'`. Comentarios del bloque online (~L64-66): reemplazar "Wompi"/"wompi-webhook" por "PayU"/"payu-webhook". `Procesando` (~L191): `'Te llevamos al pago seguro de Wompi en tu navegador.'` → `'Te llevamos al pago seguro de PayU en tu navegador.'`

- [ ] **Step 10: `app/cancha/[id]/reservar.tsx`.** Import (L14): `WOMPI_CONFIGURADO` → `PAYU_CONFIGURADO`. Usos: L53 (`useState(WOMPI_CONFIGURADO ? 'online' : 'efectivo')`), L82 (`medio === 'online' && WOMPI_CONFIGURADO`), L242 (`{WOMPI_CONFIGURADO ? (`) → todos a `PAYU_CONFIGURADO`. Copy: L88 comment "Wompi la confirma" → "PayU la confirma"; L137 comment "hasta que Wompi confirme" → "hasta que PayU confirme"; L155 `'Tu cupo se confirma apenas Wompi verifique el pago...'` → `'...apenas PayU verifique el pago...'`; L241 comment "online con Wompi" → "online con PayU"; L275 `'Pago seguro con Wompi (Nequi, PSE o tarjeta). Tu cupo se confirma al pagar.'` → `'Pago seguro con PayU (Nequi, PSE o tarjeta). Tu cupo se confirma al pagar.'`

- [ ] **Step 11: `app/cancha/finanzas.tsx`.** Import (L23): `MERCADOPAGO_CONFIGURADO` → `PAYU_CONFIGURADO`. L268: `{MERCADOPAGO_CONFIGURADO ? (` → `{PAYU_CONFIGURADO ? (`. L327: `'refleja los pagos online (próximamente con Mercado Pago).'` → `'refleja los pagos online (próximamente con PayU).'`

- [ ] **Step 12: Verificar tipos.** Run: `pnpm exec tsc --noEmit`. Expected: sin errores. (Si aparece un uso residual de `MedioPagoId` con `nequi/pse/tarjeta`, o de `mp_payout_ref`, corregirlo.)

- [ ] **Step 13: Verificar lint.** Run: `pnpm lint`. Expected: limpio.

- [ ] **Step 14: Verificar export web.** Run: `pnpm exec expo export --platform web`. Expected: build sin errores.

- [ ] **Step 15: Grep de regresión (capa cliente).** Run (PowerShell o Grep tool): buscar `wompi|Wompi|WOMPI|mercado|Mercado|MERCADO|lemon|Lemon|LEMON|mp_payout_ref|LEMONSQUEEZY_CONFIGURADO|WOMPI_CONFIGURADO|MERCADOPAGO_CONFIGURADO` en `app/ lib/ constants/ types/`. Expected: 0 ocurrencias.

- [ ] **Step 16: Commit.**

```bash
git add constants/config.ts lib/payments.ts lib/canchas.ts lib/store.ts types/database.ts "app/checkout/[id].tsx" "app/cancha/[id]/reservar.tsx" app/cancha/finanzas.tsx
git commit -m "refactor(pagos): capa cliente Wompi/MP/LS -> PayU (solo-efectivo + seam)"
```

---

## Task 2: Edge functions (borrar 4, crear 2 stubs PayU)

Deno; fuera del scope de tsc/lint del repo (`eslint.config.js` ignora `supabase/functions/**`). Verificación por inspección de contrato + grep.

**Files:**
- Delete: `supabase/functions/create-checkout/`, `supabase/functions/lemonsqueezy-webhook/`, `supabase/functions/wompi-crear-transaccion/`, `supabase/functions/wompi-webhook/`
- Create: `supabase/functions/payu-crear-transaccion/index.ts`, `supabase/functions/payu-webhook/index.ts`

**Interfaces:**
- Consumes: `payments.ts` invoca `payu-crear-transaccion` con body `{ tipo:'partido'|'reserva', partidoId?, reservaId?, referencia, email? }` y espera `{ url }`.

- [ ] **Step 1: Borrar las 4 funciones retiradas.**

```bash
git rm -r supabase/functions/create-checkout supabase/functions/lemonsqueezy-webhook supabase/functions/wompi-crear-transaccion supabase/functions/wompi-webhook
```

- [ ] **Step 2: Crear `supabase/functions/payu-crear-transaccion/index.ts`** con este contenido completo:

```ts
// Edge Function: payu-crear-transaccion
// Arma el pago del Web Checkout de PayU para el cupo de un partido o la reserva
// de una cancha. El MONTO se recomputa en el servidor desde la BD (nunca se
// confía en el cliente) y la FIRMA se calcula acá con el ApiKey que vive SOLO en
// la Edge Function.
//
// STUB: sin los secretos PAYU_* seteados, devuelve "Pasarela no configurada".
// PayU WebCheckout es un form POST; al conectar credenciales hay que cerrar el
// detalle del envío (ver docs/PAYU-SETUP.md).
//
// Deploy:  supabase functions deploy payu-crear-transaccion
// Secretos (supabase secrets set ...):
//   PAYU_API_KEY, PAYU_MERCHANT_ID, PAYU_ACCOUNT_ID,
//   PAYU_CHECKOUT_URL (opcional; default sandbox), PAYU_RESPONSE_URL (opcional)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const md5hex = (s: string): string => createHash('md5').update(s).digest('hex');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'No autorizado' }, 401);

    const apiKey = Deno.env.get('PAYU_API_KEY');
    const merchantId = Deno.env.get('PAYU_MERCHANT_ID');
    const accountId = Deno.env.get('PAYU_ACCOUNT_ID');
    if (!apiKey || !merchantId || !accountId) {
      return json({ error: 'Pasarela no configurada' }, 500);
    }
    const checkoutUrl =
      Deno.env.get('PAYU_CHECKOUT_URL') ||
      'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/';
    const responseUrl =
      Deno.env.get('PAYU_RESPONSE_URL') || 'https://sebastianayala13.github.io/falta-uno-legal';

    const { tipo, partidoId, reservaId, referencia, email } = await req.json();
    if (typeof referencia !== 'string' || !referencia) {
      return json({ error: 'Referencia inválida' }, 400);
    }

    // Monto recomputado SIEMPRE desde la BD (anti-tampering)
    let amount = 0;
    if (tipo === 'partido') {
      if (typeof partidoId !== 'string' || !partidoId) return json({ error: 'partidoId inválido' }, 400);
      const { data: p, error } = await userClient
        .from('partidos')
        .select('precio')
        .eq('id', partidoId)
        .single();
      if (error || !p) return json({ error: 'Partido no encontrado' }, 404);
      amount = p.precio + Math.round(p.precio * COMISION_SERVICIO);
    } else if (tipo === 'reserva') {
      if (typeof reservaId !== 'string' || !reservaId) return json({ error: 'reservaId inválido' }, 400);
      const { data: r, error } = await userClient
        .from('reservas')
        .select('precio, jugador_id')
        .eq('id', reservaId)
        .single();
      if (error || !r) return json({ error: 'Reserva no encontrada' }, 404);
      if (r.jugador_id !== user.id) return json({ error: 'No autorizado' }, 403);
      amount = r.precio; // el jugador paga el precio del turno; la comisión sale del ledger de la cancha
    } else {
      return json({ error: 'Tipo inválido' }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Monto inválido' }, 400);

    // Firma de PayU: MD5(ApiKey~merchantId~referenceCode~amount~currency).
    // amount va como entero COP (sin decimales) en el WebCheckout.
    const currency = 'COP';
    const signature = md5hex(`${apiKey}~${merchantId}~${referencia}~${amount}~${currency}`);

    // Campos firmados del WebCheckout de PayU. OJO: PayU espera un form POST a
    // `checkoutUrl`. Este stub arma la estructura firmada y devuelve el gateway
    // con los parámetros; el cierre del envío (form POST / página puente) se
    // valida al conectar credenciales reales (ver docs/PAYU-SETUP.md).
    const fields: Record<string, string> = {
      merchantId,
      accountId,
      description: tipo === 'partido' ? 'Cupo de partido - Falta Uno' : 'Reserva de cancha - Falta Uno',
      referenceCode: referencia,
      amount: String(amount),
      tax: '0',
      taxReturnBase: '0',
      currency,
      signature,
      buyerEmail: email ?? '',
      responseUrl,
      confirmationUrl: `${supaUrl}/functions/v1/payu-webhook`,
      test: '1',
    };

    const qs = Object.entries(fields)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${checkoutUrl}?${qs}`;

    return json({ url });
  } catch (e) {
    console.error('payu-crear-transaccion:', e);
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 3: Crear `supabase/functions/payu-webhook/index.ts`** con este contenido completo:

```ts
// Edge Function: payu-webhook
// Recibe la confirmación de PayU (form-urlencoded). El estado 'aprobado' (pago de
// partido) o 'confirmada' (reserva de cancha) SOLO se escribe acá, tras verificar
// la firma con PAYU_API_KEY. Nunca se confía en el cliente.
//
// STUB: sin PAYU_API_KEY seteada, devuelve "Webhook no configurado".
//
// Deploy (sin verificación de JWT: PayU no manda token de Supabase; la
// autenticidad se valida con la firma del evento):
//   supabase functions deploy payu-webhook --no-verify-jwt
// Secretos:  PAYU_API_KEY
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen en el entorno.)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

/** Comisión de servicio sobre el cupo de partido (sync con constants/config.ts). */
const COMISION_SERVICIO = 0.08;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const md5hex = (s: string): string => createHash('md5').update(s).digest('hex');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const apiKey = Deno.env.get('PAYU_API_KEY');
    if (!apiKey) return json({ error: 'Webhook no configurado' }, 500);

    const form = await req.formData();
    const merchantId = String(form.get('merchant_id') ?? '');
    const referencia = String(form.get('reference_sale') ?? '');
    const value = String(form.get('value') ?? '');
    const currency = String(form.get('currency') ?? '');
    const statePol = String(form.get('state_pol') ?? '');
    const sign = String(form.get('sign') ?? '');

    // Firma PayU: MD5(ApiKey~merchant_id~reference_sale~new_value~currency~state_pol).
    // new_value: PayU formatea el value con una regla de decimales (si el segundo
    // decimal es 0, usa 1 decimal). Se computan ambas variantes y se acepta
    // cualquiera. Validar contra la doc de PayU al conectar credenciales.
    const num = Number(value);
    const v1 = num.toFixed(1);
    const v2 = num.toFixed(2);
    const esperado1 = md5hex(`${apiKey}~${merchantId}~${referencia}~${v1}~${currency}~${statePol}`);
    const esperado2 = md5hex(`${apiKey}~${merchantId}~${referencia}~${v2}~${currency}~${statePol}`);
    const firmaOk =
      sign.toLowerCase() === esperado1.toLowerCase() ||
      sign.toLowerCase() === esperado2.toLowerCase();
    if (!sign || !firmaOk) return json({ error: 'Firma inválida' }, 401);

    // state_pol 4 = APPROVED. Cualquier otro estado se ignora.
    if (statePol !== '4') return json({ ok: true, ignorado: statePol });
    if (!referencia) return json({ error: 'Sin referencia' }, 400);

    const amountInt = Math.round(num);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ¿Es un pago de partido? (pagos.referencia)
    const { data: pago } = await admin
      .from('pagos')
      .select('id, partido_id, jugador_id, monto, estado')
      .eq('referencia', referencia)
      .maybeSingle();

    if (pago) {
      if (pago.estado === 'aprobado') return json({ ok: true, duplicado: true });
      if (Math.round(pago.monto) !== amountInt) {
        console.error('payu-webhook: monto no coincide (pago)', referencia, pago.monto, amountInt);
        return json({ ok: true, alerta: 'monto no coincide' });
      }
      await admin.from('pagos').update({ estado: 'aprobado' }).eq('id', pago.id);

      // Asegurar inscripción (el trigger fn_sync_cupos ocupa el cupo)
      const { data: yaInscrito } = await admin
        .from('partido_jugadores')
        .select('id')
        .eq('partido_id', pago.partido_id)
        .eq('jugador_id', pago.jugador_id)
        .maybeSingle();
      if (!yaInscrito) {
        const { data: perfil } = await admin
          .from('profiles')
          .select('posicion')
          .eq('id', pago.jugador_id)
          .maybeSingle();
        const { error: errIns } = await admin.from('partido_jugadores').insert({
          partido_id: pago.partido_id,
          jugador_id: pago.jugador_id,
          posicion: perfil?.posicion ?? 'Mediocampista',
          confirmado: true,
        });
        if (errIns && errIns.code !== '23505') throw errIns;
      }
      return json({ ok: true, tipo: 'partido' });
    }

    // ¿Es una reserva de cancha? (reservas.referencia)
    const { data: reserva } = await admin
      .from('reservas')
      .select('id, cancha_id, precio, comision, estado')
      .eq('referencia', referencia)
      .maybeSingle();

    if (reserva) {
      if (reserva.estado === 'confirmada') return json({ ok: true, duplicado: true });
      if (Math.round(reserva.precio) !== amountInt) {
        console.error('payu-webhook: monto no coincide (reserva)', referencia, reserva.precio, amountInt);
        return json({ ok: true, alerta: 'monto no coincide' });
      }
      await admin.from('reservas').update({ estado: 'confirmada' }).eq('id', reserva.id);

      // Ledger de la cancha: ingreso por la reserva y comisión de Falta Uno
      const comision = reserva.comision ?? Math.round(reserva.precio * COMISION_SERVICIO);
      await admin.from('movimientos_cancha').insert([
        {
          cancha_id: reserva.cancha_id,
          tipo: 'ingreso_reserva',
          monto: reserva.precio,
          reserva_id: reserva.id,
          descripcion: 'Ingreso por reserva (PayU)',
        },
        {
          cancha_id: reserva.cancha_id,
          tipo: 'comision',
          monto: -Math.abs(comision),
          reserva_id: reserva.id,
          descripcion: 'Comisión Falta Uno',
        },
      ]);
      return json({ ok: true, tipo: 'reserva' });
    }

    return json({ ok: true, ignorado: 'referencia desconocida' });
  } catch (e) {
    console.error('payu-webhook:', e);
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 4: Grep de regresión (funciones).** Buscar `wompi|Wompi|mercado|Mercado|lemon|Lemon` en `supabase/functions/`. Expected: 0 ocurrencias. Confirmar que solo quedan `payu-crear-transaccion`, `payu-webhook`, `delete-user`.

- [ ] **Step 5: (Opcional) `deno check`.** Si `deno` está disponible: `deno check supabase/functions/payu-crear-transaccion/index.ts supabase/functions/payu-webhook/index.ts`. Si no, saltar (Deno no es parte del pipeline del repo).

- [ ] **Step 6: Commit.**

```bash
git add supabase/functions
git commit -m "feat(pagos): edge functions PayU (stub) + baja de wompi/lemonsqueezy/create-checkout"
```

---

## Task 3: Migración de limpieza de esquema

**Files:**
- Create: `supabase/migrations/<timestamp>_retiro_pasarelas_payu.sql`

- [ ] **Step 1: Generar la migración.** Run: `pnpm db:new retiro_pasarelas_payu`. Esto crea `supabase/migrations/<timestamp>_retiro_pasarelas_payu.sql` vacío.

- [ ] **Step 2: Escribir el SQL** en el archivo generado:

```sql
-- Retiro de pasarelas (MP/Lemon Squeezy/Wompi) -> PayU: limpieza de esquema.

-- 1) Columna de retiro agnóstica de proveedor (era 'mp_payout_ref' por Mercado Pago).
ALTER TABLE "public"."retiros" RENAME COLUMN "mp_payout_ref" TO "payout_ref";

-- 2) Los medios granulares de Wompi (nequi/pse/tarjeta) nunca se escribieron; la
--    app solo guarda 'efectivo' u 'online'. Apretamos el CHECK.
ALTER TABLE "public"."pagos" DROP CONSTRAINT "pagos_medio_check";
ALTER TABLE "public"."pagos" ADD CONSTRAINT "pagos_medio_check"
  CHECK ("medio" = ANY (ARRAY['efectivo'::"text", 'online'::"text"]));
```

- [ ] **Step 3: Probar la migración.** Si el stack local está disponible: `pnpm db:start` (si no está arriba) y `pnpm db:reset`. Expected: re-aplica baseline + esta migración + seed sin error. Si no hay Docker/stack local, hacer sanity-check del SQL (nombres de tabla/columna/constraint contra el baseline) y anotar que `db:reset` no se corrió.

- [ ] **Step 4: Commit.**

```bash
git add supabase/migrations
git commit -m "feat(db): migracion de limpieza (mp_payout_ref->payout_ref, medio check a efectivo/online)"
```

---

## Task 4: Documentación

**Files:**
- Create: `docs/PAYU-SETUP.md`
- Delete: `docs/WOMPI-SETUP.md`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Crear `docs/PAYU-SETUP.md`** con este contenido:

```markdown
# Pagos online con PayU (setup)

PayU es la pasarela de pagos de Falta Uno (PSP colombiano: Nequi, PSE, tarjeta).
El pago online abre un checkout externo y se confirma **en el servidor** vía
webhook. La llave privada nunca va en el cliente.

> **Estado:** andamiaje (stub). Las edge functions `payu-crear-transaccion` y
> `payu-webhook` existen con el esqueleto de la firma pero devuelven "no
> configurada" hasta setear los secretos. Con el flag apagado, la app es
> solo-efectivo.

## Activar

1. **Cuenta PayU:** obtené `apiKey`, `merchantId` y `accountId` (COP) desde el panel.
2. **Secretos del backend** (solo en Edge Functions, nunca en la app):
   ```bash
   supabase secrets set PAYU_API_KEY=... PAYU_MERCHANT_ID=... PAYU_ACCOUNT_ID=... \
     PAYU_CHECKOUT_URL=https://checkout.payulatam.com/ppp-web-gateway-payu/ \
     PAYU_RESPONSE_URL=https://TU-DOMINIO/legal
   ```
3. **Desplegar las funciones** (el webhook sin verificación de JWT: PayU se
   autentica con la firma, no con token de Supabase):
   ```bash
   supabase functions deploy payu-crear-transaccion
   supabase functions deploy payu-webhook --no-verify-jwt
   ```
4. **Registrar la URL de confirmación** en PayU:
   `https://TU-PROYECTO.supabase.co/functions/v1/payu-webhook`.
5. **Activar el medio en la app:** en `.env`, `EXPO_PUBLIC_PAYU_ENABLED=1`.

## Pendiente al conectar credenciales

- **Form POST del WebCheckout:** PayU espera un `POST` de formulario a
  `PAYU_CHECKOUT_URL`. `payu-crear-transaccion` hoy devuelve el gateway con los
  campos firmados como query string (best-effort). Validar/cerrar el envío real
  (form POST o página puente) contra la doc vigente de PayU.
- **Regla de decimales de la firma del webhook** (`new_value`): confirmar el
  formato exacto contra la doc de PayU (el stub acepta 1 o 2 decimales).
```

- [ ] **Step 2: Borrar el runbook viejo.** Run: `git rm docs/WOMPI-SETUP.md`.

- [ ] **Step 3: `README.md`.** Borrar la sección "💳 Pagos con Lemon Squeezy" completa. En los bullets de pagos (Checkout, "Seguridad & Pagos", checklist de tiendas) reemplazar "Lemon Squeezy"/"Wompi" por "PayU (próximamente)" y quitar la nota de merchant-of-record de Lemon Squeezy. Mantener el mensaje de "efectivo en cancha, sin custodia de dinero".

- [ ] **Step 4: `CLAUDE.md`.** En el párrafo "Payments (hard invariant)" reemplazar "Lemon Squeezy for partidos, Mercado Pago for canchas" por "PayU (Colombian PSP) for both partidos and canchas". En la lista de `supabase/functions/` reemplazar `create-checkout`, `lemonsqueezy-webhook`, `wompi-crear-transaccion`, `wompi-webhook` por `payu-crear-transaccion`, `payu-webhook` (dejando `delete-user`).

- [ ] **Step 5: Grep de regresión (docs).** Buscar `wompi|Wompi|WOMPI|mercado pago|Mercado Pago|mercadopago|lemon|Lemon|LEMON` en `README.md CLAUDE.md docs/` (excluyendo `docs/superpowers/specs/` y `docs/superpowers/plans/`, que son registro histórico). Expected: 0 ocurrencias.

- [ ] **Step 6: Commit.**

```bash
git add docs/PAYU-SETUP.md README.md CLAUDE.md
git commit -m "docs(pagos): runbook PayU + limpiar README/CLAUDE de wompi/mercado/lemon"
```

---

## Self-Review (post-plan)

- **Cobertura del spec:** A(config)=T1 · B(lib)=T1 · C(pantallas)=T1 · D(tipos)=T1 · E(edge fns)=T2 · F(migración)=T3 · G(docs)=T4. ✅
- **Consistencia de tipos:** `PAYU_CONFIGURADO`, `MedioPagoId='efectivo'|'online'`, `provider='payu'|'efectivo'`, `payout_ref` usados igual en todos los pasos. `payu-crear-transaccion` (nombre de fn) coincide entre `payments.ts` (T1) y la función creada (T2). `payout_ref` coincide entre `types` (T1) y la migración (T3). ✅
- **Placeholders:** el único TODO es el cierre del form POST de PayU (pendiente intencional de credenciales, documentado en PAYU-SETUP). ✅
