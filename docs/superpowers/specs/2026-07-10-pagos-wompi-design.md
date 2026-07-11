# Falta Uno · Pagos con Wompi (unificado) — Diseño

**Fecha:** 2026-07-10
**Estado:** Aprobado. Reemplaza Lemon Squeezy (partidos) y el placeholder de
Mercado Pago (canchas) por **un solo PSP colombiano: Wompi**.

## 1. Por qué Wompi
Local (Bancolombia), COP nativo, **Nequi / PSE / tarjetas / Bancolombia**, Web
Checkout (redirect), webhooks firmados, sandbox, y **dispersiones (Pagos a
Terceros)** para pagarle a las canchas. Un solo proveedor para cobrar y desembolsar.

## 2. Datos exactos de la API (confirmados en docs.wompi.co)
- **Checkout (redirect):** `https://checkout.wompi.co/p/?public-key=…&currency=COP&amount-in-cents=…&reference=…&signature:integrity=…&redirect-url=…&customer-data:email=…`
- **Firma de integridad** (server-side): `SHA256("<reference><amountInCents><currency><integritySecret>")` (hex). Con expiración: `…<currency><expiration><integritySecret>`.
- **Webhook (Eventos):** POST `{ event, data, environment, signature:{ properties, checksum }, timestamp, sent_at }`. `event = "transaction.updated"` cuando la transacción llega a estado final (APPROVED/DECLINED/VOIDED/ERROR).
- **Checksum:** `SHA256( <valores de data en el orden de signature.properties> + <timestamp> + <events_secret> )`. Debe devolver HTTP 200.

## 3. Arquitectura (server-authoritative, misma que Lemon Squeezy)
- **Secretos SOLO en Edge Functions** (`WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`,
  `WOMPI_EVENTS_SECRET`, opcional `WOMPI_PRIVATE_KEY`, `WOMPI_REDIRECT_URL`). El
  cliente nunca ve las secretas ni arma la firma.
- El **monto se recomputa en el servidor** desde la BD (nunca se confía en el cliente).
- El estado `aprobado`/`confirmada` lo escribe **solo el webhook** tras verificar el checksum.
- **Idempotencia** por `referencia` (índice único en pagos; chequeo en reservas).

### 3.1 `wompi-crear-transaccion` (JWT)
Input `{ tipo:'partido'|'reserva', partidoId?, reservaId?, referencia, email? }`.
Verifica el usuario (JWT) y que sea dueño del pago/reserva. Recomputa el monto:
- partido → `precio + round(precio*0.08)` (comisión de servicio sobre el cupo).
- reserva → `precio` del slot (la comisión de la cancha se descuenta en el ledger, no se le suma al jugador).
Calcula la firma de integridad y devuelve `{ url }` del checkout.

### 3.2 `wompi-webhook` (`--no-verify-jwt`, verifica checksum)
Verifica el checksum. Si `transaction.updated` + `status === 'APPROVED'`:
- Busca `pagos` por `referencia` → **flujo partido**: valida monto (== transaction.amount_in_cents), marca `aprobado`, asegura `partido_jugadores`. Idempotente.
- Si no, busca `reservas` por `referencia` → **flujo cancha**: valida monto, marca `confirmada`, inserta ledger `ingreso_reserva (+precio)` y `comision (-comision)`. Idempotente (no re-inserta si ya confirmada).

## 4. Cliente
- `constants/config.ts`: `WOMPI_CONFIGURADO = !!process.env.EXPO_PUBLIC_WOMPI_ENABLED`;
  el medio `online` pasa a `provider:'wompi'`, detalle "Nequi, PSE o tarjeta".
  `MEDIOS_PAGO_ACTIVOS` muestra 'online' cuando `WOMPI_CONFIGURADO`.
- `lib/payments.ts`: `crearCheckoutOnline` invoca `wompi-crear-transaccion`
  (tipo 'partido'). Nuevo `crearCheckoutReserva` (tipo 'reserva').
- `app/checkout/[id].tsx` (partidos): ya tiene la rama online; solo cambia el provider.
- `app/cancha/[id]/reservar.tsx`: agrega opción de pago **online (Wompi)** además de efectivo; crea la reserva 'pendiente' y abre el checkout.

## 5. Dispersiones (payout a canchas)
La aprobación de retiros ya existe en la Plataforma Madre (manual). La **dispersión
automática de Wompi** (Pagos a Terceros) se integra en una fase siguiente (requiere
habilitación comercial de Wompi + guardar datos bancarios de la cancha de forma
segura). Por ahora: admin marca 'pagado' tras transferir.

## 6. Lo que necesita el dueño
Cuenta en **comercios.wompi.co** → llaves (pública/privada), integrity secret y
events secret. Configurar el webhook apuntando a la URL de `wompi-webhook`.
`supabase functions deploy` de las dos funciones + `supabase secrets set`. Probar
en **sandbox** antes de producción. Encender con `EXPO_PUBLIC_WOMPI_ENABLED`.

## 7. Verificación
`tsc`, `eslint`, `expo export web`. Sandbox: pagar un cupo y una reserva de prueba,
ver el webhook marcar aprobado/confirmada y el ledger llenarse; ver el ingreso en
la Plataforma Madre.
