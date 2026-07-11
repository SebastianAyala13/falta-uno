# Onboarding de Cancha (wizard multi-paso) — Diseño

**Fecha:** 2026-07-11
**Estado:** Aprobado por el dueño. No-breaking.
**Objetivo:** Registro guiado y fácil de un **establecimiento con N canchas**,
reutilizando el modelo actual (cada cancha reservable = una fila `canchas`).

## 1. Modelo (no-breaking)
No se refactoriza la base. El wizard junta los datos del **establecimiento** una
vez y crea **una fila `canchas` por cada cancha física**, copiando en cada fila los
datos compartidos (dirección, zona, ciudad, lat/lng, teléfono, amenidades) + lo
propio de cada cancha (nombre, formato, fotos, precio). Reservas/agenda/panel/admin
siguen operando igual. Los horarios del establecimiento se replican como
`cancha_disponibilidad` de cada cancha (con su precio).

## 2. Wizard — `app/cancha/registrar.tsx` (multi-paso, fácil de usar)
Barra de progreso + botón Atrás/Siguiente. Pasos:
1. **Ubicación** (`components/UbicacionPicker`): móvil = mapa interactivo
   (`react-native-maps`) con pin arrastrable + **dirección automática**
   (`expo-location` reverseGeocode). Web = botón "Usar mi ubicación"
   (`navigator.geolocation`) + **dirección editable**. Zona (chips) + ciudad.
2. **¿Cuántas canchas?** (stepper numérico 1-10).
3. **Por cada cancha**: nombre ("Cancha 1" por defecto), **tipo** (5v5/7v7/11v11),
   **precio por turno**, **duración** (60/90 min).
4. **Fotos por cancha** (galería a Storage, reutiliza `subirFotoCancha`).
5. **¿Ya tenés partidos agendados?** Sí → al finalizar redirige a la **agenda**
   para cargarlos · No → sigue.
6. **Zonas / servicios**: amenidades (duchas, baños, tienda, cafetería, gradas,
   parqueadero, techada, iluminación, wifi, árbitro) + **tipo de acceso**
   (privado / público / en la calle).
7. **Horarios**: apertura/cierre por día (toggle por día).
8. **Contacto (WhatsApp)** + **política de cancelación** (ventana) + **aceptación
   legal** (mandato de recaudo + T&C) → crea las N canchas + su disponibilidad.

Al terminar: `router.replace('/cancha/panel')` (o `/cancha/agenda` si eligió "sí
tengo partidos").

## 3. Datos de desembolso → en el panel del dueño (Finanzas)
NO va en el onboarding. En `app/cancha/finanzas.tsx` se agrega una sección
**"Datos para recibir tu plata"**: banco, tipo de cuenta (ahorros/corriente/Nequi/
Daviplata), número, titular, documento. Se guarda en una tabla nueva
`datos_desembolso` (una por dueño). La Plataforma Madre (admin) los ve para procesar
los retiros.

## 4. Cambios de datos
- **Schema**: nueva tabla `datos_desembolso` (owner_id único, banco, tipo_cuenta,
  numero, titular, documento, timestamps). RLS: el dueño hace CRUD de lo suyo;
  admin lo lee (`is_admin()`). Reusa el resto del schema tal cual.
- **Tipos**: `DatosDesembolso`.
- **Config**: `BANCOS` (lista CO), `TIPOS_ACCESO` (privado/público/calle),
  `DURACIONES_TURNO` (60/90).
- **lib/canchas.ts**: `crearEstablecimiento(ownerId, data)` (crea N canchas +
  disponibilidad, atómico-ish); `getDatosDesembolso(ownerId)`,
  `guardarDatosDesembolso(ownerId, data)`.
- **Dep nueva**: `expo-location` (via `expo install`).

## 5. Ruteo (no rompe lo existente)
- `register.tsx` (dueño nuevo) y perfil "Registrá tu cancha" → `/cancha/registrar`
  (antes iban a `/cancha/editar`).
- `editar.tsx` se mantiene para **editar una cancha existente** (desde el panel).
- Registrar rutas nuevas en `app/_layout.tsx`.

## 6. Seguridad / cuidado
- Datos de desembolso: RLS estricta (dueño + admin). Nada sensible en el cliente
  fuera de RLS.
- `expo-location` pide permiso; si el usuario niega, cae a dirección manual.
- Mantener ambos caminos (nativo/web) funcionando.

## 7. Verificación
`tsc`, `eslint`, `expo export web`. Aplicar schema con `pnpm supa:setup --schema`.
Manual: registrar un establecimiento con 2 canchas (web y móvil), ver que aparezcan
en Buscar canchas y en el panel; cargar datos de desembolso en Finanzas.

## 8. Fuera de alcance (después)
Agrupar canchas con `establecimiento_id`; edición del establecimiento completo
(hoy se edita cancha por cancha); dispersión automática Wompi.
