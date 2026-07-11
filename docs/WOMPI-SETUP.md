# Vincular Wompi — runbook (Falta Uno)

Todo el código ya está listo y en `main`. Faltan solo pasos que necesitan **tus
llaves de Wompi** y **tu login de Supabase** (por eso los corrés vos: los secretos
no deben pasar por el chat). Hacelo **primero en SANDBOX** (llaves `..._test_`) y
cuando funcione cambiás a producción.

> Proyecto Supabase: `gwkzcjgsuxgqejaukbse`
> URL del webhook (la vas a necesitar en el paso 4):
> **`https://gwkzcjgsuxgqejaukbse.supabase.co/functions/v1/wompi-webhook`**

---

## 1. Sacar las llaves en Wompi
En **comercios.wompi.co** → menú **Desarrollo** (barra izquierda):
- **Llave pública** (`pub_test_...` en sandbox / `pub_prod_...` en prod)
- **Secreto de integridad** (Integrity)
- **Secreto de eventos** (Events) — está en la sección **Eventos**

(Para probar sin plata real usá el **ambiente de pruebas / sandbox** de Wompi.)

## 2. Login + link del CLI de Supabase
En la terminal, dentro de `C:\Users\sebas\falta-uno`:
```
pnpm dlx supabase login           # abre el navegador, autorizás
pnpm dlx supabase link --project-ref gwkzcjgsuxgqejaukbse
```

## 3. Desplegar las 2 Edge Functions
```
pnpm dlx supabase functions deploy wompi-crear-transaccion --project-ref gwkzcjgsuxgqejaukbse
pnpm dlx supabase functions deploy wompi-webhook --no-verify-jwt --project-ref gwkzcjgsuxgqejaukbse
```
(`--no-verify-jwt` en el webhook porque Wompi no manda token de Supabase; la
autenticidad se valida con el checksum del evento.)

## 4. Cargar los secretos (tus llaves de Wompi)
```
pnpm dlx supabase secrets set --project-ref gwkzcjgsuxgqejaukbse \
  WOMPI_PUBLIC_KEY=pub_test_TU_LLAVE \
  WOMPI_INTEGRITY_SECRET=TU_INTEGRITY_SECRET \
  WOMPI_EVENTS_SECRET=TU_EVENTS_SECRET \
  WOMPI_REDIRECT_URL=https://sebastianayala13.github.io/falta-uno-legal
```

## 5. Registrar el webhook en Wompi
En **Desarrollo → Eventos**, configurá la URL de eventos:
```
https://gwkzcjgsuxgqejaukbse.supabase.co/functions/v1/wompi-webhook
```
Wompi enviará `transaction.updated` cuando un pago llegue a estado final.

## 6. Encender el medio online en la app
En tu `.env` (local) agregá:
```
EXPO_PUBLIC_WOMPI_ENABLED=1
```
Reiniciá el server (`pnpm web` / `pnpm start`). Para la **web en Dokploy**, poné
`EXPO_PUBLIC_WOMPI_ENABLED=1` en los **Build-time Arguments** (no en runtime).

## 7. Probar en sandbox
- Andá a un partido → **Unirme y pagar** → elegí **Nequi/PSE/tarjeta** →
  se abre el checkout de Wompi (usá las tarjetas/datos de prueba de la doc de Wompi).
- Al aprobar el pago, el **webhook** marca el pago `aprobado` y te inscribe.
  Para reservas de cancha: la reserva pasa a `confirmada` y se llena el **ledger**
  (ingreso + comisión) → lo ves en la **Plataforma Madre** (GMV, pagos).
- Verificá en Supabase → Functions → Logs de `wompi-webhook` si algo no cuadra.

## Seguridad (ya implementada)
- Las llaves privadas/integrity/events viven **solo en las Edge Functions**
  (nunca en la app ni con prefijo `EXPO_PUBLIC_`).
- El monto se **recomputa en el servidor** (anti-tampering) y el estado `aprobado`/
  `confirmada` lo escribe **solo el webhook** tras verificar el checksum. El cliente
  nunca marca un pago aprobado.

## Desembolsos a canchas
Por ahora se hacen desde la **Plataforma Madre** (admin marca "pagado" tras
transferir). La **dispersión automática** con "Pagos a Terceros" de Wompi es una
fase siguiente (requiere aprobación del comercio + datos bancarios de la cancha).
