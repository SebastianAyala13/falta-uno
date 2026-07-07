# Marketplace de Canchas — Fase 1 · Plan de Implementación

> **For agentic workers:** implementar tarea por tarea. Cada tarea termina con
> un entregable verificable. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Agregar el rol "cancha" a Falta Uno con perfil, agenda, reservas
pagables en efectivo, ledger de saldo y blindaje legal/seguridad — todo lo que
sale a tiendas SIN depender de Mercado Pago.

**Architecture:** Nuevas tablas Supabase con RLS; capa de datos `lib/canchas.ts`
al estilo del store existente (Supabase-backed con fallback); navegación por rol
(`profiles.roles`); pantallas nuevas bajo `app/cancha/*` y `app/canchas`. La capa
de pagos online queda abstraída y apagada (solo efectivo en Fase 1).

**Tech Stack:** Expo SDK 54, Expo Router, NativeWind, zustand, Supabase (Postgres
RLS, Storage, Realtime), react-native-maps.

## Global Constraints

- Mantener **Expo SDK 54** (compat Expo Go en el iPhone del usuario). No subir SDK.
- **Verificación** de cada tarea: `npx tsc --noEmit` limpio y, en tareas de UI,
  `npx expo export --platform android` EXIT=0. No hay test runner unitario.
- **Seguridad:** RLS en toda tabla nueva; ningún secreto ni dato bancario en el
  cliente; escrituras de saldo/estado sensibles solo server-side.
- **schema.sql es idempotente** (usar `if not exists` / `drop policy if exists`).
- Copy en **español rioplatense-colombiano** como el resto de la app.
- Commits frecuentes, uno por tarea. Co-author: `Claude Opus 4.8 (1M context)`.

---

### Task 1: Esquema de base de datos + RLS

**Files:**
- Modify: `supabase/schema.sql` (agregar sección "MARKETPLACE DE CANCHAS")

**Interfaces — Produces:** tablas `canchas`, `cancha_disponibilidad`, `reservas`,
`movimientos_cancha`, `retiros`, `membresias_cancha`; columna `profiles.roles text[]`;
bucket storage `canchas`.

- [ ] **Step 1:** Agregar `alter table profiles add column if not exists roles text[] not null default '{jugador}';`
- [ ] **Step 2:** Crear las 6 tablas del spec §4 con sus `check` y el índice único
  `reservas (cancha_id, fecha, hora_inicio)`.
- [ ] **Step 3:** `enable row level security` en las 6 tablas + políticas del spec §5
  (canchas lectura pública / escritura dueño; disponibilidad lectura pública /
  escritura dueño; reservas lectura jugador-o-dueño, insert jugador estado
  'pendiente'; movimientos/retiros/membresias lectura y solicitud solo dueño).
- [ ] **Step 4:** Trigger `fn_saldo_no_negativo` opcional + función
  `saldo_cancha(cancha_id) returns int` (sum de movimientos) con `security definer`.
- [ ] **Step 5:** Crear bucket storage `canchas` (público lectura) + policy de subida
  solo autenticado dueño (o vía SQL `storage.objects`).
- [ ] **Step 6:** Verificar idempotencia releyendo el archivo; commit.
  Verificación real la corre el usuario en el SQL Editor (Success, no rows).

---

### Task 2: Tipos TypeScript

**Files:**
- Modify: `types/database.ts`

**Interfaces — Produces:** `Cancha`, `CanchaDisponibilidad`, `Reserva`,
`MovimientoCancha`, `Retiro`, `MembresiaCancha`, `Amenidades`; entradas en
`Database['public']['Tables']`; `Profile.roles?: string[]`.

- [ ] **Step 1:** Definir interfaces exportadas para cada tabla (campos del spec §4).
- [ ] **Step 2:** `Amenidades` como interface de booleanos (duchas, banos, tienda,
  cafeteria, gradas, parqueadero, cubierta_lluvia, iluminacion, alquiler_implementos,
  wifi, arbitro).
- [ ] **Step 3:** Agregar `roles?: string[]` a `Profile`.
- [ ] **Step 4:** Registrar las tablas nuevas en `Database` (Row/Insert/Update).
- [ ] **Step 5:** `npx tsc --noEmit` limpio; commit.

---

### Task 3: Config — amenidades, roles, comisión

**Files:**
- Modify: `constants/config.ts`

**Interfaces — Produces:** `AMENIDADES` (catálogo id+label+icon), `ROLES`,
`COMISION_CANCHA_DEFAULT`, `MEMBRESIA` (precio/plan), `MERCADOPAGO_CONFIGURADO`.

- [ ] **Step 1:** `AMENIDADES: {id,label,icon}[]` con las 11 amenidades.
- [ ] **Step 2:** `COMISION_CANCHA_DEFAULT = 0.10`; `MERCADOPAGO_CONFIGURADO =
  !!process.env.EXPO_PUBLIC_MERCADOPAGO_ENABLED`.
- [ ] **Step 3:** `MEMBRESIA = { precioMensual, nombre }` (placeholder de precio a
  confirmar con el usuario; usar 49900 COP como default documentado).
- [ ] **Step 4:** `npx tsc --noEmit`; commit.

---

### Task 4: Capa de datos `lib/canchas.ts`

**Files:**
- Create: `lib/canchas.ts`

**Interfaces — Produces:**
- `useCanchasStore` (zustand) o funciones async: `crearCancha`, `actualizarCancha`,
  `misCanchas(ownerId)`, `getCancha(id)`, `listarCanchas(filtros)`.
- `setDisponibilidad(canchaId, slots)`, `getDisponibilidad(canchaId)`,
  `slotsDelDia(canchaId, fecha)` (deriva libres de plantilla − reservas).
- `crearReserva(...)` (async, respeta índice único → error "slot ocupado"),
  `misReservas(jugadorId)`, `reservasDeCancha(canchaId, fecha?)`.
- `saldoCancha(canchaId)`, `movimientos(canchaId)`, `solicitarRetiro(canchaId, monto)`.

**Consumes:** `supabase`, tipos de Task 2, config de Task 3.

- [ ] **Step 1:** CRUD de `canchas` (Supabase, patrón write-through como `store.ts`).
- [ ] **Step 2:** Disponibilidad + `slotsDelDia` (genera turnos por `duracion_min`
  entre apertura y cierre; excluye los ya reservados de `reservas`).
- [ ] **Step 3:** `crearReserva` inserta `reservas` estado 'pendiente' (efectivo →
  'confirmada'); maneja error `23505` como "ese horario ya está tomado".
- [ ] **Step 4:** Ledger read (`saldoCancha` via RPC `saldo_cancha` o sum client-side
  de movimientos leídos) + `solicitarRetiro` inserta en `retiros` estado 'solicitado'.
- [ ] **Step 5:** `npx tsc --noEmit`; commit.

---

### Task 5: Roles — registro, switch de rol, agregar rol

**Files:**
- Modify: `lib/auth.tsx` (roles en signUp/updateProfile), `app/(auth)/register.tsx`
  (selector jugador/cancha), `app/(tabs)/perfil.tsx` (switch de modo + "agregar rol")

**Interfaces — Consumes:** `Profile.roles`. **Produces:** `useRolActivo()` hook o
estado en store para saber si la UI está en modo jugador o cancha.

- [ ] **Step 1:** `register.tsx`: toggle "Soy jugador" / "Tengo una cancha"; si
  cancha, `roles` incluye `'cancha'` y tras registro navega al alta de cancha.
- [ ] **Step 2:** `auth.tsx`: persistir `roles` en el insert de perfil; método
  `agregarRol(rol)` que hace update.
- [ ] **Step 3:** `perfil.tsx`: si el perfil tiene ambos roles, mostrar switch
  "Modo jugador ⇄ Modo cancha"; si solo jugador, botón "Registrar mi cancha".
- [ ] **Step 4:** Estado de rol activo en zustand (persistido). `npx tsc --noEmit`; commit.

---

### Task 6: Navegación por rol + rutas nuevas

**Files:**
- Modify: `app/_layout.tsx` (registrar rutas `cancha/*`, `canchas`, `mis-reservas`)
- Create: `app/cancha/_layout.tsx` (si se usa un grupo), rutas placeholder

**Interfaces — Consumes:** rol activo de Task 5.

- [ ] **Step 1:** Registrar en el `Stack` las pantallas nuevas con sus animaciones.
- [ ] **Step 2:** En `(tabs)/_layout.tsx`, cuando el modo activo es "cancha",
  renderizar el tab-set de cancha (Panel, Agenda, Mi cancha, Finanzas); si es
  jugador, el actual. (Condicional por rol activo.)
- [ ] **Step 3:** `npx tsc --noEmit` + `npx expo export --platform android`; commit.

---

### Task 7: Alta / edición de cancha (Mi cancha)

**Files:**
- Create: `app/cancha/editar.tsx`, `components/AmenidadPicker.tsx`,
  `components/GaleriaFotos.tsx`

**Interfaces — Consumes:** `crearCancha`/`actualizarCancha`, `AMENIDADES`,
`elegirImagen` (`lib/images.ts` ya existe), Supabase Storage.

- [ ] **Step 1:** Formulario: nombre, dirección, zona, mapa (react-native-maps),
  formatos, teléfono, descripción.
- [ ] **Step 2:** `AmenidadPicker` (grid de toggles con iconos).
- [ ] **Step 3:** `GaleriaFotos` (subir varias a Storage bucket `canchas`).
- [ ] **Step 4:** Editor de disponibilidad (días + apertura/cierre/duración/precio).
- [ ] **Step 5:** Guardar → `crearCancha`/`actualizarCancha`; `tsc` + `export`; commit.

---

### Task 8: Panel + Agenda de la cancha

**Files:**
- Create: `app/(tabs)/cancha-panel.tsx` (Panel), `app/cancha/agenda.tsx`

**Interfaces — Consumes:** `saldoCancha`, `reservasDeCancha`, `misCanchas`.

- [ ] **Step 1:** Panel: saldo, reservas de hoy, próximas, % ocupación (cards).
- [ ] **Step 2:** Agenda: selector de día + lista de slots con estado
  (libre/reservado/bloqueado); acción bloquear/abrir.
- [ ] **Step 3:** `tsc` + `export`; commit.

---

### Task 9: Finanzas de la cancha

**Files:**
- Create: `app/(tabs)/cancha-finanzas.tsx`

**Interfaces — Consumes:** `saldoCancha`, `movimientos`, `solicitarRetiro`,
`membresias` (estado).

- [ ] **Step 1:** Card de saldo + botón "Solicitar retiro" (valida saldo > 0).
- [ ] **Step 2:** Historial (ledger) con tipos e importes.
- [ ] **Step 3:** Estado de retiros + tarjeta de membresía (Fase 1: informativa,
  "Próximamente" para el cobro online).
- [ ] **Step 4:** `tsc` + `export`; commit.

---

### Task 10: Jugador — buscar canchas, perfil, reservar, mis reservas

**Files:**
- Create: `app/canchas.tsx` (buscar), `app/cancha/[id].tsx` (perfil),
  `app/cancha/[id]/reservar.tsx`, `app/mis-reservas.tsx`
- Modify: `app/(tabs)/index.tsx` (entrada "Canchas") o `buscar.tsx`

**Interfaces — Consumes:** `listarCanchas`, `getCancha`, `slotsDelDia`,
`crearReserva`, `misReservas`; integración con `crearPartido` (partido abierto).

- [ ] **Step 1:** Lista/mapa de canchas + filtros (amenidad/formato/precio).
- [ ] **Step 2:** Perfil de cancha: galería, amenidades (iconos), mapa, horarios.
- [ ] **Step 3:** Reservar: elegir día/slot → pagar (efectivo) → toggle "partido
  abierto" (crea `partido` ligado y lo publica en el feed) → comprobante.
- [ ] **Step 4:** Mis reservas (lista con estado). `tsc` + `export`; commit.

---

### Task 11: Legal + consentimiento

**Files:**
- Create: `legal/mandato-recaudo.html`, `legal/terminos-marketplace.html`,
  `legal/cancelaciones.html`
- Modify: alta de cancha (Task 7) para aceptar mandato+T&C; `constants/config.ts`
  (URLs legales de canchas)

**Interfaces — Consumes:** patrón de `legal/*.html` existente.

- [ ] **Step 1:** Redactar los 3 HTML (Vasecom S.A.S., Ley 1581, recaudo, reembolsos).
- [ ] **Step 2:** Checkbox de aceptación (con versión/fecha) al registrar cancha.
- [ ] **Step 3:** `tsc`; commit.

---

### Task 12: Verificación integral + push

- [ ] **Step 1:** `npx tsc --noEmit` limpio.
- [ ] **Step 2:** `npx expo export --platform android` EXIT=0.
- [ ] **Step 3:** `npx expo-doctor` (18/18).
- [ ] **Step 4:** Repaso manual del flujo (crear cancha → publicar horarios →
  reservar efectivo → saldo sube → solicitar retiro → alternar rol).
- [ ] **Step 5:** Commit final + `git push`.

---

## Fase 2 (plan aparte, al activar Mercado Pago)

Edge Functions `mp-crear-pago`, `mp-webhook`, `mp-retiro`, `mp-membresia-webhook`;
`lib/mercadopago.ts` cliente; encender comisión, cobro online, retiros reales y
membresías (0% comisión). Se documentará en
`docs/superpowers/plans/2026-07-07-canchas-marketplace-fase2.md` cuando la cuenta
MP esté lista.

## Self-Review

- **Cobertura del spec:** roles (T5), datos+RLS (T1/T2), amenidades (T3/T7),
  agenda/slots (T4/T8), reservas+partido abierto (T4/T10), saldo/ledger (T4/T9),
  retiros (T4/T9), legal (T11), seguridad (T1). Pagos online/membresía cobro →
  Fase 2 (documentado). ✔
- **Placeholders:** precio de membresía marcado como default a confirmar. ✔
- **Consistencia de tipos:** nombres de funciones de `lib/canchas.ts` usados igual
  en Tasks 7-10. ✔
