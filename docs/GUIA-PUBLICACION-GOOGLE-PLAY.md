# Guía de publicación en Google Play — Falta Uno

> Paso a paso con las **respuestas exactas** para Falta Uno en cada formulario.
> Titular: **Vasecom S.A.S.** (NIT 902.072.598) · Soporte: vasecom22@gmail.com
> Privacidad: https://sebastianayala13.github.io/falta-uno-legal/privacidad.html

---

## Resumen del recorrido (orden recomendado)

1. Crear cuenta de desarrollador (US$25) y verificar identidad.
2. Conseguir la **Google Maps API key** (la app la necesita para compilar Android).
3. Generar el **.aab** con EAS Build.
4. Crear la app en Play Console y llenar **App content** (privacidad, Data Safety, Content Rating, Target Audience, Ads).
5. Completar la **ficha de tienda** (textos, ícono, capturas).
6. **Prueba cerrada**: 12 testers, 14 días continuos.
7. Solicitar acceso a producción y enviar.

> ⏱️ Realista: 1-2 días de trámite + **14 días** de la prueba cerrada obligatoria antes de poder publicar.

---

## 1. Crear la cuenta de desarrollador

1. Entrá a https://play.google.com/console con la cuenta Google de Vasecom.
2. Elegí tipo de cuenta: **Organización** (porque publicás como Vasecom S.A.S.).
3. Pagá la cuota única de **US$25**.
4. **Verificación de identidad/empresa**: Google pide documento del NIT y datos de Vasecom. Puede tardar de horas a días. Hacelo apenas crees la cuenta para no perder tiempo.

> Como cuenta de **organización**, te puede pedir un **D-U-N-S number** de Vasecom. Si no lo tenés, se solicita gratis (tarda días) — empezá esto ya.

---

## 2. Google Maps API key (Android) — necesaria para compilar

La app usa mapas; sin la key, el build de Android falla o el mapa sale gris.

1. Andá a https://console.cloud.google.com → creá un proyecto (ej. "Falta Uno").
2. **APIs & Services → Library** → activá **Maps SDK for Android**.
3. **Credentials → Create credentials → API key**.
4. Restringí la key: **Application restriction = Android apps**, agregá el package `com.faltauno.app` y la huella SHA-1 de tu keystore (la da EAS con `eas credentials`). **API restriction = Maps SDK for Android**.
5. Pegá la key en `app.json` → `android.config.googleMaps.apiKey` (reemplazá `TU_GOOGLE_MAPS_ANDROID_API_KEY`). Commit + push.

---

## 3. Generar el .aab con EAS Build

Google exige **Android App Bundle (.aab)**, no APK.

1. Instalá EAS: `npm install -g eas-cli` y `eas login`.
2. En la carpeta del proyecto: `eas init` (vincula el projectId; edita `app.json` solo).
3. Verificá que `eas.json` tenga un perfil `production` que genere app-bundle.
4. Compilá: `eas build -p android --profile production`.
5. Al terminar, descargá el **.aab** desde el link que te da EAS.

> Target API: Expo SDK 54 apunta a **API 35** (válido hoy). Desde el **31-ago-2026** Google exigirá **API 36**; si publicás después, actualizá Expo.

---

## 4. App content (lo más importante para no ser rechazado)

En Play Console → tu app → **Policy → App content**. Hay que completar cada sección:

### 4.1 Política de privacidad
Pegá: `https://sebastianayala13.github.io/falta-uno-legal/privacidad.html`

### 4.2 Data safety (declaración de datos) — respuestas para Falta Uno

**¿Tu app recopila o comparte datos de usuario?** → **Sí**.
**¿Los datos están cifrados en tránsito?** → **Sí** (HTTPS/Supabase).
**¿Los usuarios pueden pedir que se eliminen sus datos?** → **Sí** (in-app: Perfil → Eliminar cuenta, y por correo).

**Tipos de datos que recopila** (marcá estos):

| Categoría | Tipo | ¿Recopila? | ¿Comparte? | Propósito | ¿Obligatorio? |
|---|---|---|---|---|---|
| Info personal | Nombre | Sí | No | Funcionalidad de la app, Gestión de cuenta | Obligatorio |
| Info personal | Correo electrónico | Sí | No | Funcionalidad, Gestión de cuenta | Obligatorio |
| Info personal | Número de teléfono | Sí | No | Funcionalidad, Gestión de cuenta | Opcional |
| Fotos y videos | Fotos | Sí | No | Funcionalidad de la app | Opcional |
| Mensajes | Mensajes en la app (chat) | Sí | No | Funcionalidad de la app | Opcional |
| Actividad en la app | Otro contenido generado por el usuario (posts, comentarios) | Sí | No | Funcionalidad de la app | Opcional |
| IDs | ID de usuario | Sí | No | Funcionalidad, Gestión de cuenta | Obligatorio |

> "Compartir" en Google = enviar a **terceros para su propio uso**. Supabase es tu **proveedor/procesador**, así que **NO** cuenta como compartir. Por eso todo va en "Recopila: Sí / Comparte: No".
> No marques ubicación precisa (la ciudad es un dato que el usuario escribe, no GPS). No marques datos financieros (no procesás pagos).

### 4.3 Content rating (clasificación IARC) — respuestas para Falta Uno

Cuestionario (Play Console → App content → Content rating). Categoría sugerida: **Social / Comunicación** o **Referencia**. Respondé honesto:

- Violencia / sangre → **No**
- Contenido sexual / desnudez → **No**
- Lenguaje soez → **No** (hay filtro de groserías)
- Sustancias controladas / alcohol / drogas → **No**
- Juegos de azar / apuestas → **No**
- **¿Los usuarios pueden interactuar o intercambiar contenido?** → **Sí** (chat y muro)
- **¿Se comparte contenido generado por usuarios?** → **Sí**, y aclarás que **hay moderación** (reportar, bloquear, filtro)
- **¿Comparte la ubicación física del usuario con otros?** → **No** (solo ciudad escrita)
- Compras digitales dentro de la app → **No**

> Resultado probable: **Teen / +13** (PEGI 12 / ESRB Teen). Coherente con tu edad mínima de 13. El chat sube la clasificación: es normal y esperado.

### 4.4 Target audience and content (audiencia)

- **Grupos de edad objetivo**: marcá **13-15, 16-17, y 18+**. **NO marques "Menores de 13"** — si lo hacés, activás la política "Designed for Families" con requisitos mucho más estrictos.
- ¿La app atrae a niños? → **No**.

### 4.5 Otras secciones de App content

- **Ads**: la app **no tiene anuncios** → declará **"No, mi app no contiene anuncios"**.
- **App access**: como hay funciones detrás de login, dale al revisor acceso. Opción A: indicá que existe **"Modo invitado"** (botón en la pantalla de bienvenida) para explorar sin cuenta. Opción B (mejor): creá una **cuenta de prueba** real en Supabase y pegá usuario+contraseña en este formulario, para que el revisor pruebe chat, pago en efectivo y eliminar cuenta.
- **Government apps / Financial features**: **No** a ambos (no manejás dinero; el pago es en efectivo entre usuarios).
- **Data deletion**: si te pide URL de eliminación, pegá `https://sebastianayala13.github.io/falta-uno-legal/eliminar-cuenta.html`.

---

## 5. Ficha de tienda (Store listing)

- **Nombre de la app**: Falta Uno
- **Descripción corta (80 caracteres)**: ej. "Armá tu parche de fútbol: encontrá partidos, sumate y completá el equipo."
- **Descripción completa**: contá qué hace (organizar/unirse a partidos, chat del parche, muro, reputación). Menciona que el pago es en efectivo al organizador.
- **Ícono**: 512×512 px (PNG, 32-bit).
- **Gráfico destacado (feature graphic)**: 1024×500 px.
- **Capturas de teléfono**: mínimo **2** (recomendado 4-8). Tamaño entre 320 y 3840 px por lado, relación 16:9 o 9:16. Mostrá Home, Detalle de partido, Chat, Perfil.
- **Categoría**: Deportes (o Social).
- **Datos de contacto**: correo `vasecom22@gmail.com`.

---

## 6. Prueba cerrada (closed testing) — obligatoria

Las cuentas nuevas deben correr una prueba cerrada antes de producción:

- **Mínimo 12 testers** suscritos (opt-in) durante **14 días continuos**.
- En Play Console → **Testing → Closed testing** → creá una pista, subí el **.aab**, agregá una lista de correos (los 12 testers) y compartí el **link de opt-in** para que se unan.
- Los 12 deben aceptar y mantenerse esos 14 días. Recién ahí podés solicitar **acceso a producción**.

> Tip: armá tus 12 testers desde ya (amigos, equipo de Vasecom) — es el cuello de botella de tiempo.

---

## 7. Enviar a producción

1. Completá identidad verificada + App content (todo en verde) + ficha + capturas.
2. Termina los 14 días de prueba cerrada.
3. **Production → Create new release** → subí el .aab → revisá → **Send for review**.
4. La revisión de Google suele tardar de horas a varios días.

---

## Checklist rápido

- [ ] Cuenta Google Play (organización Vasecom) + verificación de identidad/D-U-N-S
- [ ] Google Maps API key en `app.json` (commit)
- [ ] `.aab` generado con EAS
- [ ] Política de privacidad (URL) cargada
- [ ] Data Safety completo (tabla de arriba)
- [ ] Content Rating (IARC) respondido
- [ ] Target audience = 13+ (sin menores de 13)
- [ ] Ads = No · Financial = No · App access (cuenta de prueba o modo invitado)
- [ ] Ficha: descripción + ícono + feature graphic + capturas
- [ ] 12 testers / 14 días de prueba cerrada
- [ ] Enviar a producción

---

*Próximo: cuando termines Google Play, la guía equivalente para App Store (App Privacy, Age Rating, build con Xcode/EAS, envío).*
