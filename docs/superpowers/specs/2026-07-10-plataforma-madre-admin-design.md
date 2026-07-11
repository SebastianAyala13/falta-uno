# Falta Uno · Plataforma Madre (Admin) — Diseño

**Fecha:** 2026-07-10
**Estado:** Aprobado (Fase A del roadmap de plataforma). Prioridad elegida por el dueño.
**Objetivo:** Consola donde el dueño y su equipo ven TODO y operan la plataforma —
en especial el **control del flujo de plata** (aprobar/procesar retiros de canchas).

---

## 1. Decisiones

- **Vive en la misma app** (React Native Web + Expo Router), no un proyecto aparte —
  mismo Supabase, mismo deploy, **todo sincronizado**. Se usa principalmente desde
  **web** (desktop) por el equipo.
- **Rol `admin`** en `profiles.roles`. El primer admin se setea a mano en Supabase
  (SQL). La app muestra la sección admin solo si el rol activo lo incluye.
- **Lecturas** de todo vía RLS con `is_admin()` (además de las policies de dueño).
- **Escrituras sensibles** (procesar retiro = mover plata; moderar) vía funciones
  `security definer` que verifican `is_admin()` internamente — server-authoritative,
  sin exponer service_role al cliente y sin requerir desplegar Edge Functions.

## 2. Modelo de datos (cambios en schema.sql)

- `profiles.roles` puede incluir `'admin'` (ya existe la columna array).
- **`is_admin()`** `returns boolean` `security definer`:
  `select exists(select 1 from profiles p where p.id = auth.uid() and 'admin' = any(p.roles))`.
- **RLS de lectura admin** (se AGREGA a las policies existentes; RLS es OR) en:
  `profiles, canchas, cancha_disponibilidad, reservas, pagos, retiros,
  movimientos_cancha, membresias_cancha, reportes, partidos, calificaciones,
  partido_jugadores, posts, comentarios` → `for select using (is_admin())`.
- **`admin_procesar_retiro(p_retiro uuid, p_estado text, p_motivo text)`**
  `security definer`: exige `is_admin()`; setea `retiros.estado` a `'pagado'` o
  `'rechazado'` + `procesado_at`; si `'pagado'`, inserta en `movimientos_cancha`
  un movimiento `retiro` (−monto) para bajar el saldo de la cancha. Atómico.
- **`admin_set_estado_cancha(p_cancha uuid, p_estado text)`** `security definer`
  (activar/pausar una cancha).
- **`admin_ajuste_saldo(p_cancha uuid, p_monto int, p_desc text)`** `security definer`
  (crédito/débito manual al ledger de una cancha, tipo `ajuste`).
- **Vista `admin_metricas`** (o consultas en `lib/admin.ts`): totales de usuarios,
  canchas, reservas, pagos aprobados (GMV), retiros pendientes — global y por ciudad.

## 3. Seguridad

- `is_admin()` es la única puerta; se evalúa server-side en cada policy/función.
- Ningún secreto ni service_role en el cliente. Las escrituras sensibles pasan por
  funciones `security definer` que revalidan `is_admin()` (no basta con la RLS de
  lectura). El procesar-retiro es atómico (estado + ledger en una sola función).
- Se mantiene el invariante de pagos: el cliente nunca marca `aprobado`; el admin
  solo puede procesar **retiros** (desembolsos), no fabricar ingresos.

## 4. App — navegación y pantallas (bajo `app/admin/`)

Gate: si `profile.roles` incluye `'admin'`, en Perfil aparece "Panel de control
(Admin)" → `/admin`. Todas las rutas admin verifican el rol y muestran "sin acceso"
si no.

- **`/admin` (Resumen):** tarjetas de métricas (usuarios, canchas, reservas, GMV,
  retiros pendientes), desglose por ciudad, accesos rápidos a cada sección.
- **`/admin/retiros` (crítico):** cola de retiros `solicitado` → **Aprobar (pagado)**
  / **Rechazar** (con motivo) vía `admin_procesar_retiro`. Historial de procesados.
- **`/admin/canchas`:** todas las canchas; ver saldo; **activar/pausar**; ajuste de
  saldo manual.
- **`/admin/reservas`:** listado global con filtros (ciudad, estado, fecha).
- **`/admin/pagos`:** listado global de pagos (medio, estado, monto).
- **`/admin/usuarios`:** listado + búsqueda; ver detalle (rol, ciudad, actividad).
- **`/admin/reportes`:** reportes de moderación (contenido objetable) para revisar.

Layout web-first: tablas con `overflow-x:auto`, filtros arriba, estados con chips de
color. Reusa componentes existentes (Screen, Colors, FadeIn, EmptyState).

## 5. Data layer — `lib/admin.ts`

`esAdmin(profile)`, `metricas()`, `listarUsuarios(q?)`, `listarCanchasAdmin()`,
`listarReservasAdmin(filtros)`, `listarPagosAdmin()`, `retirosPendientes()`,
`procesarRetiro(id, estado, motivo)`, `setEstadoCancha(id, estado)`,
`ajusteSaldo(canchaId, monto, desc)`, `reportesAdmin()`. Todo Supabase + guard
`supabaseConfigurado`.

## 6. Cómo el dueño se vuelve admin (documentar)

En Supabase → SQL Editor:
`update public.profiles set roles = array_append(roles,'admin') where email = 'TU_EMAIL';`

## 7. Verificación

`pnpm exec tsc --noEmit`, `node ./node_modules/eslint/bin/eslint.js .`,
`expo export --platform web`. Manual: como admin, ver métricas, procesar un retiro
de prueba (saldo baja), pausar una cancha, ver listados.

## 8. Fuera de alcance (siguientes fases)

Payout automático real por Mercado Pago (Fase B/paga), torneos (Fase C), web pública
de canchas (Fase D), SMTP/rate-limit de producción (Fase B).
