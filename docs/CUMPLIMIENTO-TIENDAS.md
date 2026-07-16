# Cumplimiento App Store + Play Store — Falta Uno

> Auditoría del código al **16 de julio de 2026**. Cubre: chat, muro social, pagos, fotos, cuentas,
> eliminar cuenta, permisos, moderación UGC, manifiestos.
> _(La versión anterior, del 25-jun, listaba 3 bloqueantes de código; todos se resolvieron — ver historial.)_

## Veredicto rápido

**El código ya no tiene bloqueantes de tienda.** Los 3 bloqueantes de la auditoría anterior
(UGC sin moderación accionable, sin aceptación de Términos/EULA, pagos falsos "Aprobado") están
**resueltos**. Lo que falta para *enviar* es **trabajo de consola/cuenta** (fuera del repo): keys,
despliegues, cuestionarios de las tiendas y assets.

| Estado | Cantidad |
|---|---|
| 🔴 Bloqueante de **código** | 0 |
| 🟠 Bloqueante de **consola/cuenta** (solo lo hace el dueño) | 6 |
| 🟡 Riesgo / a confirmar | 3 |
| 🟢 Ya cumple (código) | 12 |

---

## 🟢 Resuelto en código (antes bloqueante)

### UGC con moderación **accionable** (Apple 1.2 / Google UGC)
La app tiene chat de partido y muro público. Ahora cumple las 4 exigencias:
1. **Filtro** de contenido objetable al publicar (groserías/insultos).
2. **Reportar** contenido/usuario (`components/ModeracionBoton.tsx`, tabla `reportes` con `estado`).
3. **Bloquear** usuarios — persistido en la tabla `bloqueos` (fuente de verdad del servidor al
   hidratar) y el contenido del bloqueado se oculta (posts, comentarios, muro).
4. **EULA / tolerancia cero** aceptada en el registro.

El panel de admin (`app/admin/reportes.tsx`) **actúa** sobre los reportes en ≤24h: eliminar el
contenido y **suspender** al autor, vía las RPC `admin_resolver_reporte` y `admin_suspender_usuario`
(SECURITY DEFINER, migración `20260715120000_moderacion_accionable.sql`). La suspensión se hace
efectiva en el cliente (cierre de sesión en `lib/auth.tsx`) **y** a nivel de base de datos con un
trigger que rechaza inserts de suspendidos en posts/comentarios/mensajes/partidos
(`20260716120000_trigger_bloquear_suspendidos.sql`).

### Aceptación de Términos + edad mínima (age-gate 13+)
`app/(auth)/register.tsx` exige una casilla obligatoria: "Confirmo que tengo 13 años o más" +
aceptación de Términos y Política de Privacidad (con enlaces) antes de crear la cuenta.

### Pagos: solo efectivo, sin "Aprobado" falso
El cliente **nunca** marca un pago `aprobado`. El efectivo queda `pendiente` (Falta Uno no custodia
dinero). Los pagos online (PayU) son un flujo *stub* apagado tras `EXPO_PUBLIC_PAYU_ENABLED` +
secretos `PAYU_*`; `aprobado` solo lo escribe el webhook del servidor. No hay comprobantes falsos.

### Sin contenido ficticio (Apple 2.1)
Se quitaron rosters y estadísticas inventadas: los cupos ajenos se muestran anónimos ("Cuadrado"),
el invitado arranca en cero, y no hay tarjetas de membresía "Próximamente" muertas.

### Invitado solo-lectura
El modo invitado puede explorar pero no escribir: los 7 CTA (crear partido, publicar, comentar,
reservar, calificar, registrar cancha, checkout) piden crear una cuenta real.

---

## 🟠 Bloqueantes de consola / cuenta (solo el dueño puede hacerlos)

Ninguno es programar; son pasos en Supabase / EAS / consolas de las tiendas.

1. **Google Maps Android API key** — `app.json` tiene el placeholder `TU_GOOGLE_MAPS_ANDROID_API_KEY`.
   Sin ella el mapa sale gris **en Android** (en iOS usa Apple Maps y funciona sin key). Crear en
   Google Cloud (Maps SDK for Android), restringir a `com.faltauno.app` + SHA-1, y reemplazar.
2. **Desplegar la Edge Function `delete-user`** en el dashboard de Supabase. Si no, "Eliminar cuenta"
   falla → rechazo por Apple 5.1.1(v) / Google.
3. **Variables de entorno de producción en EAS** (`EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL`) en el environment `production`, para que
   el build móvil no salga en modo demo y los enlaces legales resuelvan.
4. **Hostear las 3 páginas legales del marketplace** (mandato-recaudo, terminos-marketplace,
   cancelaciones) donde apunte `SITE_URL`, o subirlas al mirror; hoy dan 404 en el fallback.
5. **Cuentas de tienda:** Apple Developer ($99) + Google Play ($25).
6. **Cuestionarios y assets:** App Privacy (Apple) / Data Safety (Google) / Content Rating /
   Age Rating (17+ en Apple por UGC), capturas, ficha, y **closed testing de Play (12 testers / 14 días)**.

---

## 🟡 Riesgos / a confirmar

- **Rotar los secretos de producción expuestos.** Se pegaron llaves de prod en una sesión anterior;
  hay que rotarlas en Supabase. `.supabase-deploy.env` debe seguir en `.gitignore` (verificado).
- **`delete-user` no borra archivos de Storage** (avatares/fotos quedan huérfanos). No bloquea
  revisión, pero conviene ampliarlo para higiene de datos (Ley 1581 / derecho de supresión).
- **Notificaciones (Android 13+).** `expo-notifications` requiere `POST_NOTIFICATIONS`; el plugin lo
  maneja. Declararlo en Data Safety si se manda push.

---

## 🟢 Ya cumple (config y plataforma)

- ✅ **Eliminar cuenta** en la app + Edge Function `delete-user` (falta desplegarla — punto 2).
- ✅ **Recuperar contraseña** (`recuperar.tsx` + `resetPasswordForEmail`).
- ✅ **Privacy Manifest iOS** completo en `app.json`.
- ✅ **Permisos mínimos:** solo fotos. No pide ubicación del dispositivo.
- ✅ **Login propio** (email/contraseña) — no exige Sign in with Apple (4.8).
- ✅ **Aviso de pago transparente** ("Falta Uno no custodia tu dinero").
- ✅ **Páginas legales** privacidad/términos/eliminar-cuenta con datos reales (Vasecom S.A.S.,
  NIT 902.072.598) y enlaces **relativos** (no rompen si cambia el dominio).
- ✅ **Cifrado declarado** (`ITSAppUsesNonExemptEncryption: false`).
- ✅ **`eas.json`** con `environment: production` en el perfil de producción.
- ✅ **Migraciones versionadas** aplicadas por CI (`db push` al mergear a main) + validadas en local.

---

## Requisitos técnicos de plataforma (2026)

**Google Play**
- Cuenta personal nueva: **closed testing con 12 testers opt-in por 14 días** continuos antes de producción.
- **Target API 35 hoy**; desde **31-ago-2026** obligatorio **API 36 (Android 16)**.
- Subir **.aab** (App Bundle), no APK.
- Antes de aprobar: URL de privacidad, **Data Safety**, **Content Rating**, **Target Audience**,
  credenciales de prueba en *App access*.

**Apple App Store**
- Build con **Xcode 26 / SDK iOS 18+**.
- **App Privacy** ("nutrition labels") completo.
- **Age Rating** 17+ por UGC.
- Datos de demo para el revisor + descripción de que hay chat/muro.

---

## Plan de acción priorizado (lo que queda)

**Código:** ✅ sin bloqueantes. Follow-ups opcionales de hardening: Storage cleanup en `delete-user`.

**Consola / cuenta (en orden):**
1. Rotar secretos de prod expuestos.
2. Desplegar `delete-user`.
3. Env vars de producción en EAS.
4. Google Maps Android key.
5. Hostear las 3 legales del marketplace (o setear `SITE_URL`).
6. Cuentas Apple + Google.
7. App Privacy / Data Safety / Content Rating / Age Rating.
8. Capturas + ficha + closed testing de Play.
