# Cumplimiento App Store + Play Store — Falta Uno

> Auditoría del código al 25 de junio de 2026. Revisa: chat, muro social, pagos, fotos, cuentas, eliminar cuenta, permisos, manifiestos.

## Veredicto rápido

La app **NO está lista para enviar todavía**. Lo reglamentario de config (eliminar cuenta, privacy manifest, páginas legales, recuperar contraseña) ya está. Pero hay **3 bloqueantes que causan rechazo casi seguro** en ambas tiendas, todos derivados de tener **chat + muro público** (contenido generado por usuarios, UGC) con **edad mínima 13**.

| Estado | Cantidad |
|---|---|
| 🔴 Bloqueante (rechazo casi seguro) | 3 |
| 🟡 Riesgo / a confirmar | 4 |
| 🟢 Ya cumple | 8 |

---

## 🔴 Bloqueantes — hay que resolver antes de enviar

### 1. UGC sin moderación (Apple 1.2 / Google UGC) — el más grave
La app tiene **chat de partido** (`app/chat/[id].tsx`) y **muro público** (`app/(tabs)/muro.tsx`, `crear-post.tsx`) donde los usuarios publican texto y comentarios. La búsqueda en todo el código **no encontró nada** de reportar, bloquear ni filtrar contenido.

Apple actualizó la Guideline 1.2 en junio 2026 dejándolo más estricto. Ambas tiendas exigen **las 4 cosas** para apps con UGC:

1. **Filtro de contenido objetable** (lista de palabras prohibidas o moderación).
2. **Botón de reportar** contenido/usuario, con acción en ≤24h.
3. **Bloquear usuarios** abusivos.
4. **EULA** que prohíba expresamente contenido objetable y abuso (aceptado por el usuario).

> **Sin esto Apple rechaza con 1.2 y Google con "User Generated Content policy".** Es el motivo #1 de rechazo de apps sociales.

**Qué hacer (mínimo viable):**
- Agregar en cada post/comentario/mensaje un menú "⋯ → Reportar" y "Bloquear a este usuario".
- Una tabla `reportes` y `bloqueos` en Supabase + ocultar contenido de usuarios bloqueados.
- Filtro básico de groserías/insultos al publicar.
- Checkbox de aceptación de Términos en el registro (ver punto 2).

### 2. No se aceptan Términos ni EULA en el registro
`app/(auth)/register.tsx` pide nombre, correo, posición, nivel, celular y contraseña — pero **no hay casilla de "Acepto Términos y Política de Privacidad"** ni mención de tolerancia cero a contenido abusivo. Es requisito directo de la 1.2 y de Google.

**Qué hacer:** checkbox obligatorio con enlaces a `/terminos` y `/privacidad` antes de crear la cuenta.

### 3. Pagos simulados que dicen "Aprobado"
`lib/payments.ts` **siempre devuelve `aprobado`** para Nequi/PSE/Tarjeta sin pasarela real (es un mock con `setTimeout`). Apple (2.1) y Google rechazan funciones placeholder o no funcionales, y un comprobante de pago falso es especialmente sensible.

**Qué hacer — elegí una:**
- **(A) Recomendada para v1:** dejar solo **"Efectivo — le pagás al organizador en la cancha"** (ese flujo sí es real) y ocultar Nequi/PSE/Tarjeta hasta integrar Wompi. Pasás revisión sin backend de pagos.
- **(B)** Integrar Wompi de verdad (pasarela real con llave en backend) antes de enviar.

> Nota buena: la **comisión "Servicio Falta Uno"** sobre un partido presencial es un **servicio del mundo real**, exento de IAP de Apple y de Play Billing. Eso está bien — no necesitás compras dentro de la app.

---

## 🟡 Riesgos / a confirmar

- **Edad 13 + chat social = más escrutinio.** Con menores y chat, Apple pide controles reforzados y la clasificación por edad sube. Reconsiderá **18** salvo que implementes moderación sólida (punto 1). En las tiendas hay que declarar correctamente la audiencia (Apple Age Rating con "Unrestricted Web/UGC"; Google "Target Audience" + "Families"/contenido infantil si incluís <13).
- **Link de privacidad hardcodeado.** `app/(tabs)/perfil.tsx` abre `https://faltauno.app/privacidad`. Si hosteás en otra URL, el botón lleva a un 404 → Apple rechaza por enlace roto. Hay que poner la URL real.
- **Eliminar cuenta en modo demo no borra backend.** En `lib/auth.tsx`, sin Supabase configurado, `eliminarCuenta` solo limpia el dispositivo. Para revisión debés enviar el build con Supabase real para que la Edge Function `delete-user` borre de verdad. Verificá que esté **desplegada** (`supabase functions deploy delete-user`).
- **Notificaciones (Android 13+).** `expo-notifications` requiere permiso `POST_NOTIFICATIONS`. El plugin lo maneja, pero confirmá que en el build el permiso aparezca y que el flujo de pedirlo exista. Declaralo en Data Safety si mandás push.

---

## 🟢 Ya cumple

- ✅ **Eliminar cuenta** en la app (`Perfil → Eliminar cuenta`) + Edge Function `delete-user` (Apple 5.1.1(v) y Google).
- ✅ **Recuperar contraseña** (`recuperar.tsx` + `resetPasswordForEmail`).
- ✅ **Privacy Manifest iOS** completo en `app.json` (UserDefaults, FileTimestamp, BootTime, DiskSpace con razones).
- ✅ **Permisos mínimos:** solo fotos (`READ_MEDIA_IMAGES` / `NSPhotoLibraryUsageDescription`). **No** usa ubicación del dispositivo (el mapa usa coords estáticas en `geo.ts`), así que no hace falta permiso de ubicación.
- ✅ **Login propio** (email/contraseña). Al no usar login de terceros, **no** se exige Sign in with Apple (4.8).
- ✅ **Aviso de pago transparente** ("Falta Uno no custodia tu dinero") en checkout y legales.
- ✅ **Páginas legales** privacidad/términos/eliminar-cuenta (Ley 1581 Colombia) — faltan rellenar placeholders y hostear.
- ✅ **Cifrado declarado** (`ITSAppUsesNonExemptEncryption: false`).
- ✅ **Modo invitado** (`signInAsGuest`) — útil para que el revisor entre sin crear cuenta.

---

## Requisitos técnicos de plataforma (2026)

**Google Play**
- Cuenta personal nueva: **closed testing con 12 testers opt-in por 14 días** continuos antes de producción.
- **Target API 35 hoy**; desde **31-ago-2026** obligatorio **API 36 (Android 16)**.
- Subir **.aab** (App Bundle), no APK.
- Antes de aprobar: URL de privacidad, **Data Safety**, **Content Rating**, **Target Audience**, credenciales de prueba en *App access*.

**Apple App Store**
- Build con **Xcode 26 / SDK iOS 18+** (obligatorio en 2026).
- **App Privacy** ("nutrition labels") completo.
- **Age Rating** con el nuevo sistema (13+/16+/18+); UGC sin moderar sube la clasificación.
- Datos de demo para el revisor + descripción de que hay chat/muro.

---

## Plan de acción priorizado

**Para pasar revisión (bloqueantes):**
1. Implementar reportar + bloquear + filtro básico en chat y muro.
2. Checkbox de aceptación de Términos/Privacidad en el registro.
3. Dejar solo pago en efectivo (o integrar Wompi real).
4. Decidir edad final (18 recomendado si no hay moderación robusta).

**Datos a rellenar (no es programar):**
5. Placeholders en `legal/*.html`: nombre legal, correo, fecha, URL, edad, días.
6. URL real de privacidad en `perfil.tsx`.
7. Google Maps API key en `app.json`.
8. `.env` con credenciales Supabase reales.

**Consolas (fuera del repo):**
9. Crear cuentas Apple ($99) y Google ($25).
10. Hostear las 3 páginas legales.
11. Desplegar `delete-user`.
12. Llenar App Privacy / Data Safety / Content Rating.
13. Capturas, ficha y clasificación por edad.
