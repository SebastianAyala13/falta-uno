# Conectar pagos online con Rapyd — Falta Uno

> Rapyd es el PSP sucesor de PayU en LatAm (adquisición del GPO, 2025). Procesa el pago
> online (tarjeta, PSE, efectivo) del cupo de un partido y de la reserva de una cancha.
> El efectivo **no** depende de esto y sigue funcionando. Online arranca **apagado** y
> solo se enciende cuando termines estos pasos.

## Arquitectura (cómo funciona)
1. La app llama a la Edge Function **`rapyd-crear-checkout`** (con el token del usuario).
2. La función **recomputa el monto desde la BD** (nunca confía en el cliente), firma la
   request con HMAC y crea un *Hosted Checkout* en Rapyd (`POST /v1/checkout`).
3. Rapyd devuelve un **`redirect_url`**; la app lo abre en el navegador (`expo-web-browser`).
4. El usuario paga. Rapyd manda un webhook `PAYMENT_COMPLETED` a **`rapyd-webhook`**.
5. `rapyd-webhook` **verifica la firma** y recién ahí marca el pago `aprobado` / la reserva
   `confirmada`. **El cliente nunca marca un pago como aprobado.**

## Lo que necesitás hacer (en orden)

### 1. Credenciales (Rapyd dashboard → Developers → API access control)
- Copiá tu **Access key** y **Secret key**. Empezá con las de **Sandbox** (modo prueba).
- **No** agregues IP whitelist (dejá "all allowed"), o bloquearás las llamadas del servidor.

### 2. Setear los secretos en Supabase
En el dashboard de Supabase → Edge Functions → Secrets (o `supabase secrets set`):
```
RAPYD_ACCESS_KEY   = <tu access key>
RAPYD_SECRET_KEY   = <tu secret key>
RAPYD_BASE_URL     = https://sandboxapi.rapyd.net        # sandbox (prod: https://api.rapyd.net)
RAPYD_WEBHOOK_URL  = https://gwkzcjgsuxgqejaukbse.supabase.co/functions/v1/rapyd-webhook
RAPYD_COMPLETE_URL = https://<tu-sitio>/pago-ok.html     # opcional, página de retorno
RAPYD_CANCEL_URL   = https://<tu-sitio>/pago-cancelado.html  # opcional
```
> ⚠️ `RAPYD_WEBHOOK_URL` debe coincidir **carácter por carácter** con la URL que registres
> en Rapyd (paso 4): entra en el cálculo de la firma del webhook.

### 3. Desplegar las dos funciones (Supabase dashboard o CLI)
```
supabase functions deploy rapyd-crear-checkout
supabase functions deploy rapyd-webhook --no-verify-jwt
```
(`--no-verify-jwt` en el webhook: Rapyd no manda token de Supabase; la autenticidad se
valida con la firma del evento.)

### 4. Registrar el webhook (Rapyd dashboard → Developers → Webhooks → Management)
- **Callback URL:** `https://gwkzcjgsuxgqejaukbse.supabase.co/functions/v1/rapyd-webhook`
- **Evento:** `PAYMENT_COMPLETED` (como mínimo).

### 5. Encender el flag en el build
En EAS (mobile) y Dokploy (web), agregá la variable:
```
EXPO_PUBLIC_PAGOS_ONLINE = 1
```
Recién ahí aparece la opción "Tarjeta, PSE o efectivo" en la app. Sin ella, solo se ve efectivo.

## Cómo probamos en sandbox (antes de producción)
Para que yo pruebe el checkout end-to-end contra el sandbox de Rapyd, pasame tus llaves de
**sandbox** de forma segura: guardalas en un archivo local que ya dejé **gitignored**:
`supabase/.env.rapyd`
```
RAPYD_ACCESS_KEY=<sandbox access key>
RAPYD_SECRET_KEY=<sandbox secret key>
RAPYD_BASE_URL=https://sandboxapi.rapyd.net
RAPYD_WEBHOOK_URL=http://localhost:54321/functions/v1/rapyd-webhook
```
Con eso corro `supabase functions serve rapyd-crear-checkout --env-file supabase/.env.rapyd`
y confirmo que Rapyd devuelve un `redirect_url` real, y verifico la firma del webhook.

## Producción (go-live)
- Rapyd exige verificación del comercio (KYB) para pasar a producción — puede tardar días.
- Al aprobar: cambiá `RAPYD_BASE_URL` a `https://api.rapyd.net` y usá las llaves **live**.
- El **efectivo** ya cumple para lanzar; online se puede sumar después sin bloquear el lanzamiento.

## Métodos de pago en Colombia (Rapyd)
Tarjeta, **PSE** (~⅓ de las compras online), y **efectivo** (vouchers), todo en **COP**.
