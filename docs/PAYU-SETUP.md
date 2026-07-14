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
