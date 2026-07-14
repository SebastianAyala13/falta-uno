# Retiro de pasarelas (MP / Lemon Squeezy / Wompi) + andamiaje PayU — Diseño

**Fecha:** 2026-07-14
**Estado:** aprobado (pendiente review del spec escrito)

## Goal

Retirar todo el código de las tres pasarelas actuales (Mercado Pago, Lemon Squeezy y
Wompi), dejar la app **funcional en solo-efectivo**, y montar un **seam de PayU** listo
(config + wiring + edge functions stub + columna DB genérica) que se enciende con un flag
y credenciales cuando llegue el momento. PayU será la pasarela definitiva.

## Architecture

El repo ya está consolidado sobre **Wompi** para el path online (partidos y reservas de
cancha). Lemon Squeezy quedó como código muerto (2 edge functions + flag + provider
vestigial) y Mercado Pago nunca se construyó (solo un flag y copy "Próximamente"). El
esquema de base de datos ya es casi **agnóstico de proveedor**: las columnas `medio`,
`estado` y `referencia` en `pagos`/`reservas` sirven igual para cualquier PSP; el único
rastro específico es `retiros.mp_payout_ref`.

La estrategia es un **swap con limpieza**: se preserva la forma del flujo (medio `online`,
función de checkout que recomputa el monto en el servidor, webhook que es el ÚNICO que
escribe el estado final) pero se cambia el proveedor concreto de Wompi a PayU, y se
elimina todo lo que nombra a los tres proveedores retirados.

## Tech Stack

Expo SDK 57 / RN 0.86 / TypeScript, NativeWind, Supabase (Postgres + RLS + Edge Functions
Deno), migraciones versionadas con el CLI de Supabase.

## Global Constraints

- **Invariante de pagos (duro):** el cliente **nunca** marca un pago `aprobado`. Efectivo
  queda `pendiente` (partido) / `confirmada` (reserva) desde el cliente; el estado final
  online (`aprobado`/`confirmada`) lo escribe **solo** el webhook del servidor tras validar
  la firma del evento. Las llaves secretas viven solo en las Edge Functions, nunca con
  prefijo `EXPO_PUBLIC_`.
- **Dualidad demo/backend:** el path de efectivo funciona sin backend (mock/AsyncStorage).
  El online se gatea por `PAYU_CONFIGURADO`.
- **Copy visible sin em-dash (—).** Guion medio `-` o coma. (El en-dash `–` de rangos
  horarios preexistente es aceptable.)
- **Export web debe seguir compilando** (leer `EXPO_PUBLIC_*` con `?.trim() || fallback`).
- **Verificación** (no hay test suite): `pnpm exec tsc --noEmit` + `pnpm lint` +
  `pnpm exec expo export --platform web`.

## Decisiones confirmadas

1. **Columna DB:** `retiros.mp_payout_ref` → **`payout_ref`** (genérico, reutilizable por
   PayU). No `payu_payout_ref`.
2. **Medios simplificados:** `MedioPagoId` se recorta a **`'efectivo' | 'online'`**. Se
   eliminan las 3 entradas muertas `nequi`/`pse`/`tarjeta` de `MEDIOS_PAGO` y se aprieta el
   CHECK `pagos_medio_check` a `('efectivo','online')`.
3. **PayU como stub sin credenciales:** las edge functions `payu-*` existen con el esqueleto
   de la firma pero devuelven "Pasarela no configurada" hasta que se seteen los secretos.
   En el build shippeado, `EXPO_PUBLIC_PAYU_ENABLED` está **apagado** → `MEDIOS_PAGO_ACTIVOS`
   solo tiene efectivo → **la app es solo-efectivo** y el stub ni se invoca.

---

## Cambios por área

### A. `constants/config.ts`

- **Eliminar** los flags `LEMONSQUEEZY_CONFIGURADO`, `WOMPI_CONFIGURADO`,
  `MERCADOPAGO_CONFIGURADO` y sus comentarios.
- **Agregar** `export const PAYU_CONFIGURADO = !!process.env.EXPO_PUBLIC_PAYU_ENABLED;`
  (leído como booleano; el gateo por credenciales reales vive en la edge function).
- `MedioPagoId`: de `'nequi' | 'pse' | 'tarjeta' | 'efectivo' | 'online'` a
  **`'efectivo' | 'online'`**.
- `MedioPago.provider`: de `'wompi' | 'efectivo' | 'lemonsqueezy'` a **`'payu' | 'efectivo'`**.
- `MEDIOS_PAGO`: quedan solo las entradas `efectivo` (provider `efectivo`) y `online`
  (provider `payu`, detalle `"Pago seguro con PayU"`). Se borran `nequi`/`pse`/`tarjeta`.
- `MEDIOS_PAGO_ACTIVOS`: gatear con `PAYU_CONFIGURADO`
  (`m.id === 'efectivo' || (m.id === 'online' && PAYU_CONFIGURADO)`).
- `MEMBRESIA` y el comentario de comisión de cancha: "Fase 2 (Mercado Pago)" → "(PayU)".

### B. `lib/`

- **`lib/payments.ts`**
  - `crearCheckoutOnline` y `crearCheckoutReserva`: invocar **`payu-crear-transaccion`**
    en vez de `wompi-crear-transaccion`.
  - `procesarPago`: mensaje de throw "se paga online con Wompi" → "con PayU".
  - Comentarios: reemplazar toda mención a Wompi por PayU (incluida la referencia a
    `supabase/functions/wompi-webhook` → `payu-webhook`).
- **`lib/canchas.ts`**: comentario de cabecera "el cobro online (Mercado Pago) llega en
  Fase 2" → "(PayU)".
- **`lib/store.ts`**: comentario que menciona "checkout de Lemon Squeezy" → PayU.

### C. Pantallas (`app/`)

- **`app/checkout/[id].tsx`**
  - Cálculo de comisión: `medio.provider === 'wompi'` → `medio.provider === 'payu'`.
  - Comentarios del bloque online (Wompi) → PayU.
  - Copy de `Procesando`: "Te llevamos al pago seguro de Wompi..." → "...de PayU...".
- **`app/cancha/[id]/reservar.tsx`**
  - `WOMPI_CONFIGURADO` → `PAYU_CONFIGURADO` (import + usos en líneas de estado inicial,
    `pagaOnline`, render del bloque de medio).
  - Toda la copy Wompi → PayU (incl. "Pago seguro con Wompi (Nequi, PSE o tarjeta)..." →
    "Pago seguro con PayU. Tu cupo se confirma al pagar.").
- **`app/cancha/finanzas.tsx`**
  - `MERCADOPAGO_CONFIGURADO` → `PAYU_CONFIGURADO`.
  - "refleja los pagos online (próximamente con Mercado Pago)" → "(próximamente con PayU)".

### D. Tipos (`types/database.ts`)

- `Retiro.mp_payout_ref` → **`payout_ref`** (mismo tipo `string | null`).
- Comentario "procesamiento simulado, real-ready para Wompi" → PayU.

### E. Edge Functions (`supabase/functions/`)

- **Borrar** los directorios: `create-checkout/`, `lemonsqueezy-webhook/`,
  `wompi-crear-transaccion/`, `wompi-webhook/`.
- **Crear** (stubs modelados sobre los de Wompi):
  - **`payu-crear-transaccion/index.ts`**: mismo contrato de entrada
    (`{ tipo: 'partido' | 'reserva', partidoId?, reservaId?, referencia, email? }`), CORS,
    auth por header, **monto recomputado desde la BD** (anti-tampering, idéntico a Wompi:
    partido = precio + comisión 8%; reserva = precio del turno). Arma la **firma MD5 de
    PayU** `md5(ApiKey~merchantId~referenceCode~amount~currency)` con los secretos
    `PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_RESPONSE_URL`. Si faltan los
    secretos → `{ error: 'Pasarela no configurada' }` (501/500). El detalle final del
    WebCheckout de PayU (que es un form POST, no una URL GET como Wompi) queda documentado
    como pendiente para cuando haya credenciales; el stub devuelve la estructura firmada.
  - **`payu-webhook/index.ts`**: recibe la confirmación de PayU (form-urlencoded), verifica
    la firma `md5(ApiKey~merchant_id~reference_sale~new_value~currency~state_pol)`, y solo
    con `state_pol === '4'` (APPROVED) escribe el estado final. **Misma lógica de negocio
    que `wompi-webhook`**: busca por `referencia` primero en `pagos` (→ `aprobado` +
    asegurar inscripción en `partido_jugadores`), si no en `reservas` (→ `confirmada` +
    doble asiento en `movimientos_cancha`: `ingreso_reserva` y `comision`). Chequeo de monto
    anti-tampering e idempotencia (no reprocesar si ya está aprobado/confirmada). Gated por
    `PAYU_API_KEY`. La descripción del movimiento "Ingreso por reserva (Wompi)" → "(PayU)".
- **Nota:** estas funciones se **despliegan desde el dashboard de Supabase**, no por
  CLI/CI. Borrar los archivos locales no las desactiva en prod (ver Caveats).

### F. Base de datos (`supabase/migrations/`)

Nueva migración `supabase db new retiro_pasarelas_payu` con:

```sql
-- Columna de retiro agnóstica de proveedor
ALTER TABLE "public"."retiros" RENAME COLUMN "mp_payout_ref" TO "payout_ref";

-- Los medios granulares de Wompi nunca se escribieron; la app solo guarda
-- 'efectivo' u 'online'. Apretamos el CHECK.
ALTER TABLE "public"."pagos" DROP CONSTRAINT "pagos_medio_check";
ALTER TABLE "public"."pagos" ADD CONSTRAINT "pagos_medio_check"
  CHECK ("medio" = ANY (ARRAY['efectivo'::"text", 'online'::"text"]));
```

Seguridad: el rename es no destructivo (la columna solo vive en el tipo, sin lógica que la
lea/escriba hoy). El CHECK apretado es seguro porque ninguna fila usa `nequi/pse/tarjeta`
(la app nunca los escribió). Validar local con `pnpm db:reset` antes de mergear.

### G. Docs

- **`docs/WOMPI-SETUP.md`** → renombrar a **`docs/PAYU-SETUP.md`**, reescrito como runbook
  stub: secretos que faltan (`PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`,
  `PAYU_RESPONSE_URL`, y para el webhook), pasos de firma/deploy, y el TODO del form POST del
  WebCheckout.
- **`README.md`**: borrar la sección "Pagos con Lemon Squeezy"; actualizar los bullets de
  pagos (Checkout, Seguridad & Pagos, checklist de tiendas) a "efectivo + PayU (próximamente)".
- **`CLAUDE.md`**: actualizar el párrafo de Payments (hoy nombra "Lemon Squeezy for partidos,
  Mercado Pago for canchas" y lista las edge functions `create-checkout`,
  `lemonsqueezy-webhook`, `wompi-*`) → PayU + la nueva lista `payu-crear-transaccion`,
  `payu-webhook`, `delete-user`.

---

## Fuera de alcance

- Credenciales reales de PayU, cuenta/merchant, y el cierre fino de la firma y del form POST
  del WebCheckout (se hace cuando el negocio tenga la cuenta PayU).
- Desactivar/desplegar funciones en el dashboard de Supabase y `unset` de secretos viejos
  (es acción manual del usuario, documentada en Caveats).
- Retiros automáticos vía PayU payouts y activación de la membresía "Cancha Pro" (siguen
  como "Próximamente"; la columna `payout_ref` queda lista).

## Caveats operativos

- **Edge functions gestionadas en el dashboard:** tras mergear, el usuario debe quitar en el
  dashboard de Supabase las funciones `wompi-crear-transaccion`, `wompi-webhook`,
  `create-checkout`, `lemonsqueezy-webhook`, hacer `unset` de los secretos `WOMPI_*` /
  `LEMONSQUEEZY_*`, y desplegar las `payu-*` cuando haya credenciales.
- **La migración corre en prod al mergear** (CI `supabase db push`, sin staging). Probar
  local con `pnpm db:reset` primero.
- **Post-retiro, el build es solo-efectivo** hasta setear `EXPO_PUBLIC_PAYU_ENABLED` + los
  secretos de PayU.

## Verificación

1. `pnpm exec tsc --noEmit` — sin errores de tipo (clave: `MedioPagoId`, `provider`,
   `payout_ref`).
2. `pnpm lint` — limpio.
3. `pnpm exec expo export --platform web` — build web sin blanquear.
4. `pnpm db:reset` — la migración aplica sobre el baseline + seed sin error.
5. Grep de regresión: cero ocurrencias de `wompi|Wompi|WOMPI|mercado|Mercado|lemon|Lemon|
   mp_payout_ref|LEMONSQUEEZY_CONFIGURADO|WOMPI_CONFIGURADO|MERCADOPAGO_CONFIGURADO` en
   `app/ lib/ constants/ types/ supabase/ docs/ README.md CLAUDE.md` (salvo, si acaso, specs
   históricos que se dejan como registro).
