# Respuestas de privacidad para las tiendas — Falta Uno

> Derivado del código al **16-jul-2026**. Son las respuestas exactas para **Google Play Data Safety**
> y **Apple App Privacy**, más Content/Age Rating. Copiá tal cual; donde hay un criterio, lo marco con ⚠️.
>
> **Base (qué recoge la app móvil, según el código):**
> - Perfil: **nombre, correo, celular, ciudad** (texto que el usuario escribe), **posición y nivel** de juego, **roles**.
> - **Contenido del usuario:** fotos de cancha (`expo-image-picker`), **chat** de partido, **posts y comentarios** del muro, calificaciones.
> - **Identificador de dispositivo:** token de push (`expo-notifications`).
> - **NO** recoge ubicación del dispositivo en móvil (el picker nativo no usa GPS; solo el build **web** ofrece geolocalización opcional del navegador para fijar una cancha).
> - **NO** hay analítica, tracking, ni SDKs de publicidad. **NO** recoge datos financieros (efectivo; si se activa PayU, el pago ocurre en el checkout externo de PayU, que recoge esos datos, no Falta Uno).
> - Cifrado en tránsito (HTTPS/Supabase). Eliminación de cuenta disponible (Edge Function `delete-user`).

---

## 1) Google Play — Data Safety

**Preguntas generales**
- ¿Recopila o comparte datos de usuario? → **Sí, recopila.**
- ¿Los datos se cifran en tránsito? → **Sí.**
- ¿El usuario puede pedir que se eliminen sus datos? → **Sí** (desde la app: Perfil → Eliminar cuenta).
- ¿Recopila datos de menores? → la app es 13+; declarar según tu Target Audience (ver §3).

**Tipos de datos — marcar "Collected", NO "Shared"** (Supabase/Expo son *procesadores*, no compartición a terceros; no vendés datos). Para todos: **linked to the user = Sí**, y salvo que se diga, **purpose = App functionality**.

| Categoría Google | Tipo | Recopila | Propósito |
|---|---|---|---|
| Personal info | **Name** | Sí | App functionality, Account management |
| Personal info | **Email address** | Sí | App functionality, Account management |
| Personal info | **Phone number** | Sí | App functionality |
| Personal info | **User IDs** | Sí | App functionality (id de perfil) |
| ⚠️ Personal info | **Address / City** | Sí | App functionality — ciudad autodeclarada. _(Google no tiene "ciudad" exacta; declararla como Personal info. **No** marques "Location", porque no hay ubicación de dispositivo en móvil.)_ |
| Photos and videos | **Photos** | Sí | App functionality (fotos de cancha) |
| Messages | **Other in-app messages** | Sí | App functionality (chat + muro) |
| App activity | **Other user-generated content** | Sí | App functionality (posts, comentarios, calificaciones, posición/nivel) |
| Device or other IDs | **Device or other IDs** | Sí | App functionality (token de push para notificaciones) |

**NO marcar:** Location (Approximate/Precise), Financial info, Health, Contacts, Calendar, Web browsing, Installed apps, Tracking. _(La geolocalización del navegador en el build **web** no aplica a Data Safety de la app Android; queda cubierta por la Política de Privacidad.)_

---

## 2) Apple — App Privacy (Nutrition Labels)

**¿Tracking?** → **No** (no hay ATT, ni SDKs de ads/analítica). Al final marcá **"Data Not Used to Track You"**.

Para cada tipo: **Linked to You = Sí**, **Used for Tracking = No**, **Purpose = App Functionality** (salvo lo indicado).

| Categoría Apple | Data type | Notas |
|---|---|---|
| **Contact Info** | Name | Cuenta/perfil |
| **Contact Info** | Email Address | Cuenta/login |
| **Contact Info** | Phone Number | Perfil |
| **User Content** | Photos or Videos | Fotos de cancha |
| **User Content** | Other User Content | Chat, posts del muro, comentarios, calificaciones |
| **Identifiers** | User ID | id de perfil |
| **Identifiers** | Device ID | Token de push (notificaciones) |
| ⚠️ **Location** | — | **No declarar.** El picker nativo no usa GPS. _(La app iOS no pide permiso de ubicación.)_ |

**NO declarar:** Health, Financial Info, Location, Browsing History, Search History, Sensitive Info, Contacts, Diagnostics (no hay crash SDK), Usage Data (no hay analítica).

**Otros campos de App Store Connect**
- **Account deletion:** Sí, dentro de la app (requisito 5.1.1(v)) — ruta: Perfil → Eliminar cuenta.
- **Encryption (ITSAppUsesNonExemptEncryption):** `false` (ya declarado en `app.json`).

---

## 3) Content Rating / Age Rating

**Google Play — Content Rating (cuestionario IARC)**
- Categoría: **Social / Comunicación**.
- ¿Los usuarios interactúan/comunican? → **Sí** (chat + muro).
- ¿Comparten contenido generado por usuarios? → **Sí**, con **moderación** (reportar/bloquear/filtro/panel accionable — ver `CUMPLIMIENTO-TIENDAS.md`).
- ¿Comparte ubicación del usuario con otros? → **No** (se muestran canchas, no la ubicación del usuario).
- Sin violencia, sexo, drogas, apuestas con dinero real, ni compras dentro de la app.

**Apple — Age Rating**
- Con UGC/chat sin filtro humano permanente, Apple sube la clasificación: apuntá a **17+**.
- "Unrestricted Web Access" → No. "User-Generated Content" → Sí (con moderación declarada).

**Target Audience (Google)**
- Edad mínima **13**. Elegí rangos de edad **desde 13**; **no** marques "dirigida a niños" (no es Families).

---

## 4) Recordatorio importante antes del build de revisión

⚠️ El contenido **semilla** de prod (partidos, canchas, muro con nombres como "Andrés Restrepo") es genial para las **demos**, pero Apple 2.1 / Google penalizan **contenido de relleno** en el build que revisan. Antes de **enviar** (no antes del demo), o bien:
- reemplazá la semilla por datos reales de usuarios beta, **o**
- limpiala y dejá que el revisor vea estados vacíos legítimos + los datos de demo que le pases en las notas de revisión.

---

## Fuentes en el código (para verificar)
- Datos de perfil: `lib/auth.tsx` (`signUp`), `app/(auth)/register.tsx`.
- Fotos: `lib/canchas.ts` (`subirFotoCancha`, bucket `canchas`), `expo-image-picker`.
- Push: `lib/notifications.ts` (`expo-notifications`).
- Sin ubicación nativa: `components/UbicacionPicker.tsx` (nativo, sin GPS) vs `.web.tsx` (geolocalización solo web).
- Eliminación: `supabase/functions/delete-user`.
- Sin analítica/tracking: no hay dependencias de analytics/ads en `package.json`.
