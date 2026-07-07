# Falta Uno · Marketplace de Canchas — Diseño

**Fecha:** 2026-07-07
**Estado:** Aprobado (diseño). Pendiente: implementación por fases.
**Modelo:** Marketplace con custodia de fondos (Falta Uno recauda y desembolsa).

---

## 1. Objetivo

Agregar un **rol "cancha" (venue)** a Falta Uno. Las canchas publican su perfil
(amenidades, fotos, formatos), gestionan una **agenda/calendario**, reciben
**reservas** pagadas, acumulan **saldo** y **piden desembolsos** cuando quieran.
Falta Uno cobra al jugador, retiene el saldo de la cancha y le envía su parte,
con **membresías** que eximen de comisión.

Debe funcionar en **iOS (Expo Go / App Store) y Android (Play Store)**, con
**blindaje legal (Ley 1581, mandato de recaudo, cancelaciones)** y
**ciberseguridad** (RLS, secretos solo en Edge Functions, webhooks firmados,
recomputo server-side, anti-doble-reserva, sin datos bancarios en el cliente).

## 2. Decisiones (confirmadas con el usuario)

- **Dinero:** todo por la app. Falta Uno recauda (cuenta de recaudo), lleva el
  saldo de cada cancha y desembolsa a pedido. **Membresías** → 0% de comisión.
- **PSP:** **Mercado Pago** (Colombia) — cobro + payouts/dispersión.
- **Cuenta:** un mismo `profile` puede ser **jugador y/o dueño de cancha**
  (roles combinables; un dueño puede tener varias canchas).
- **Reservas:** la cancha publica **slots** (horarios con precio); el jugador
  reserva y paga; opción **"partido abierto"** que se publica en el feed/muro
  existente para que otros se sumen.
- **Implementación:** con **Fable 5**. Estrategia **por fases** con la capa de
  pagos abstraída detrás de Edge Functions (sandbox hasta que MP esté vivo).

## 3. Alcance por fases

**Fase 1 — Sale a tiendas SIN depender de Mercado Pago:**
rol cancha, registro/perfil de cancha, amenidades, galería de fotos, agenda,
disponibilidad/slots, reservas con **pago en efectivo / "pagar en la cancha"**,
opción de partido abierto, panel del dueño, **ledger informativo** (saldo
calculado de reservas confirmadas). Todo con RLS y legal.

**Fase 2 — Al activar la cuenta Mercado Pago:**
cobro online de reservas, comisión automática, **retiros reales** (payouts),
**membresías** (suscripción → 0% comisión). Se "enciende" con
`EXPO_PUBLIC_MERCADOPAGO_ENABLED` + secretos en Edge Functions, sin re-publicar
lógica de la app.

**Responsabilidad del usuario (no lo hace el código):** abrir/activar la cuenta
Mercado Pago (marketplace/split + payouts), contratos con canchas, y validar
obligaciones tributarias (retenciones/facturación) con un contador.

## 4. Modelo de datos (Supabase — nuevas tablas, todas con RLS)

### 4.1 Roles
`profiles` gana:
- `roles text[] not null default '{jugador}'` — puede incluir `'cancha'`.
- (Se mantiene compatibilidad: perfiles existentes = solo jugador.)

### 4.2 `canchas`
```
id uuid pk, owner_id uuid -> profiles(id),
nombre, direccion, zona, ciudad default 'Pereira',
lat double precision, lng double precision,
descripcion text, telefono text,
formatos text[]  -- ['5v5','7v7','11v11']
amenidades jsonb -- { duchas, banos, tienda, cafeteria, gradas, parqueadero,
                 --   cubierta_lluvia, iluminacion, alquiler_implementos, wifi, arbitro }
fotos text[]     -- galería (URLs de Supabase Storage)
foto_portada text,
estado text check in ('activa','pausada') default 'activa',
comision_pct numeric default 0.10,   -- comisión por reserva (si no hay membresía)
mp_account_ref text,                 -- id de la cuenta MP de la cancha (para payout)
created_at timestamptz
```

### 4.3 `cancha_disponibilidad` (plantilla de horarios recurrentes)
```
id, cancha_id -> canchas, dia_semana int (0-6),
hora_apertura time, hora_cierre time,
duracion_min int default 60, precio int,
activo boolean default true
```
Los **slots reservables** se derivan de esta plantilla + reservas existentes.

### 4.4 `reservas`
```
id, cancha_id -> canchas, jugador_id -> profiles,
fecha date, hora_inicio time, hora_fin time,
precio int, comision int default 0,
estado text check in ('pendiente','confirmada','cancelada','completada') default 'pendiente',
pago_id uuid null, partido_id uuid null -> partidos (si es partido abierto),
medio text,  -- 'efectivo' | 'online'
referencia text,
created_at timestamptz,
unique (cancha_id, fecha, hora_inicio)   -- ANTI-DOBLE-RESERVA
```

### 4.5 `movimientos_cancha` (ledger — fuente de verdad del saldo)
```
id, cancha_id -> canchas,
tipo text check in ('ingreso_reserva','comision','retiro','ajuste'),
monto int,          -- con signo (+ ingreso, - comision/retiro)
reserva_id uuid null, retiro_id uuid null,
descripcion text,
created_at timestamptz
```
`saldo(cancha) = sum(monto)` sobre movimientos de esa cancha.

### 4.6 `retiros` (desembolsos)
```
id, cancha_id -> canchas, monto int,
estado text check in ('solicitado','procesando','pagado','rechazado') default 'solicitado',
mp_payout_ref text, motivo_rechazo text,
solicitado_at timestamptz default now(), procesado_at timestamptz
```

### 4.7 `membresias_cancha`
```
id, cancha_id -> canchas, plan text,
estado text check in ('activa','vencida','cancelada'),
vigente_hasta date, mp_preapproval_ref text,
created_at timestamptz
```
Membresía activa ⇒ la comisión de reserva se calcula a 0.

## 5. Seguridad (RLS + hardening)

- **canchas:** lectura pública (para que jugadores las vean); insert/update/delete
  solo `owner_id = auth.uid()`.
- **cancha_disponibilidad:** lectura pública; escritura solo del dueño de la cancha.
- **reservas:** lectura solo del jugador (`jugador_id = auth.uid()`) o del dueño de
  la cancha; insert solo `jugador_id = auth.uid()` y estado `'pendiente'`; el
  paso a `'confirmada'` con pago online lo hace **solo el webhook** (service_role).
- **movimientos_cancha / retiros / membresias:** lectura y solicitud solo del
  dueño de la cancha; los movimientos de `ingreso/comision` y el paso de retiro a
  `pagado` los escribe **solo el servidor** (Edge Function / webhook).
- **Anti-doble-reserva:** índice único `(cancha_id, fecha, hora_inicio)` +
  inserción que falla limpia si el slot ya está tomado.
- **Saldo/retiros server-authoritative:** el monto de cada movimiento y la
  validación "saldo suficiente" para un retiro se recomputan en el servidor.
- **Secretos de Mercado Pago solo en Edge Functions.** El cliente nunca ve llaves
  privadas ni datos bancarios. El destino del payout es la cuenta MP de la cancha
  (`mp_account_ref`), no una cuenta bancaria almacenada.
- **Webhooks de MP:** verificación de firma + idempotencia (índice único por
  referencia), igual patrón que `lemonsqueezy-webhook`.
- **Storage:** bucket de fotos de cancha con políticas (subida solo del dueño).

## 6. Edge Functions (Deno, Fase 2)

- `mp-crear-pago` (JWT): crea la preferencia/checkout de MP para una reserva,
  con `external_reference` = referencia de la reserva. Monto recomputado del slot.
- `mp-webhook` (`--no-verify-jwt`, firma MP): al confirmarse el pago, marca la
  reserva `confirmada`, inserta `ingreso_reserva` (+precio) y `comision`
  (−comisión, 0 si membresía) en el ledger. Idempotente.
- `mp-retiro` (JWT): valida saldo suficiente, crea `retiros` en `procesando`,
  dispara el payout de MP a `mp_account_ref`, registra movimiento `retiro`.
- `mp-membresia-webhook`: activa/renueva/vence membresías (preapproval de MP).

Todas leen `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` del entorno
de Functions (`supabase secrets set ...`), nunca del cliente.

## 7. App — navegación por rol

`profiles.roles` decide el set de pestañas. Un **switch en Perfil** alterna
"Modo jugador ⇄ Modo cancha" cuando el usuario tiene ambos roles.

### 7.1 Registro
Pantalla de registro con selector **"Soy jugador" / "Tengo una cancha"**. Si elige
cancha: alta del perfil de cancha (paso siguiente) + aceptación del **mandato de
recaudo** y T&C de marketplace. Se puede agregar el otro rol luego desde Perfil.

### 7.2 Modo cancha (dueño) — nuevas pantallas
- **Panel** (`/cancha`): saldo, reservas de hoy, próximas, % ocupación.
- **Agenda** (`/cancha/agenda`): calendario de reservas por día; bloquear/abrir
  horarios; ver estado de cada slot.
- **Mi cancha** (`/cancha/editar`): amenidades, fotos, formatos, dirección/mapa,
  disponibilidad y precios.
- **Finanzas** (`/cancha/finanzas`): saldo, historial (ledger), **solicitar
  retiro**, estado de retiros, membresía.

### 7.3 Modo jugador — nuevo
- **Buscar canchas** (`/canchas`): lista + mapa, filtros (amenidad, formato, precio).
- **Perfil de cancha** (`/cancha/[id]`): fotos, amenidades, mapa, horarios.
- **Reservar** (`/cancha/[id]/reservar`): elegir slot → pagar (efectivo/online) →
  opción "partido abierto" (crea un `partido` ligado a la reserva, visible en el feed).
- **Mis reservas** (`/mis-reservas`).

## 8. UX / mejoras recomendadas (incluidas)

- **Onboarding de cancha** con checklist (fotos, horarios, amenidades) y % de perfil.
- **Reseñas/rating de cancha** (reusa el sistema de calificaciones existente).
- **"Cierra pronto" / disponibilidad de hoy** en la búsqueda de canchas.
- **Notificaciones**: al dueño cuando entra una reserva / retiro procesado; al
  jugador recordatorio de su reserva (reusa `lib/notifications`).
- **Estados vacíos y skeletons** consistentes con el resto de la app.
- **Política de cancelación configurable** por la cancha (ventana + reembolso).
- **Mapa** con la ubicación (reusa `react-native-maps` ya integrado).

## 9. Legal (borradores a incluir)

- **Mandato de recaudo**: la cancha autoriza a Falta Uno a recaudar en su nombre y
  desembolsar el saldo (menos comisión) a su cuenta MP.
- **T&C de marketplace** + **política de cancelaciones/reembolsos**.
- Actualizar **Política de Privacidad** (datos de canchas/dueños) — Ley 1581.
- **Nota tributaria** (advisory): retenciones/facturación → contador. La app
  guarda el registro de movimientos para soporte contable.

## 10. Verificación

`npx tsc --noEmit`, `npx expo export --platform android` (y iOS), `npx expo-doctor`.
Pruebas manuales: crear cancha, publicar horarios, reservar (efectivo), ver saldo
subir, solicitar retiro (sandbox), alternar rol jugador/cancha, partido abierto en
el feed. RLS: verificar que un dueño no lee reservas/saldo de otra cancha.

## 11. Fuera de alcance (YAGNI por ahora)

- Facturación electrónica automática (DIAN) — se deja el registro para el contador.
- App nativa separada para canchas — se usa el mismo binario con rol.
- Precios dinámicos / promociones automáticas.
