# Revisión Android e iOS

Auditoría del repositorio: **6 de octubre de 2026**.

**Todavía no se debe enviar como si estuviera certificado.** Se corrigieron
bloqueantes observables de código y se prepararon los proyectos nativos. Queda
configuración real del backend/EAS/tiendas y prueba del binario firmado en
Android, iPhone e iPad. Una exportación de JavaScript no es un AAB/IPA validado.

## Corregido

| Problema | Corrección |
|---|---|
| Galería pedía acceso amplio y Android declaraba READ_MEDIA_IMAGES | Selector del sistema sin solicitar acceso a toda la biblioteca; permisos amplios bloqueados en el manifest |
| Plugin de fotos añadía micrófono/cámara sin uso | cameraPermission y microphonePermission desactivados; sin ubicación GPS ni overlays |
| Maps tenía clave de ejemplo y faltaba plugin nativo | Plugin react-native-maps y GOOGLE_MAPS_ANDROID_API_KEY por entorno; producción Android falla si falta |
| Producción podía salir en demo | app.config.ts rechaza EAS production sin backend HTTPS real |
| Partidos/canchas/perfiles quedaban fuera de reportes | Denuncias con autor/foto derivados en servidor; panel de moderación retira fotos y oculta partidos/canchas sin borrar pagos |
| Denuncias Android usaban seis botones en Alert (máximo tres) | Modal compartido conserva todos los motivos y Cancelar |
| Fotos guardaban URI local inaccesible desde otro teléfono | Storage media, límite 5 MB, formatos de imagen y permisos por autor; URL compartida |
| Borrado eliminaba perfil antes de comprobar Auth y olvidaba archivos | delete-user elimina archivos propios mediante Storage y después Auth con cascada; errores no informan éxito |
| Recordatorio Android sin canal previo | Canal creado antes de pedir permisos y programar; partidos pasados no solicitan permiso |
| Política decía que no se recopilaban datos financieros | Describe pagos, referencias, desembolsos, visibilidad social, archivos y retención |
| Perfil sólo enlazaba privacidad bajo «Privacidad y términos» | Enlaces separados a términos, privacidad, normas y ayuda/contacto |
| Mirror legal omitía páginas marketplace | Ambos repositorios contienen todas las páginas legales y normas de comunidad |
| Privacy Manifest sólo enumeraba APIs | Declara también tracking desactivado y categorías de datos vinculados tratados por la app |

El muro, chat, partidos, canchas y organizadores tienen reportar/bloquear, filtro de texto y panel para eliminar
contenido/suspender cuentas. Esto requiere **operación humana** real: el código
no demuestra que se atiendan denuncias en 24 horas. Las normas publican el
contacto y prohíben abuso/explotación sexual infantil; el propietario debe
confirmar responsable y procedimiento si Play aplica su política de seguridad
infantil a la categoría elegida.

## Pasos pendientes antes de enviar

1. **Backend:** aplicar todas las nuevas migraciones de concurrencia, media y moderación;
   desplegar `delete-user` y `moderar-contenido` con verificación JWT y las funciones Rapyd si se
   habilitan pagos online. Probar eliminación de una cuenta con fotos, posts,
   chat, reservas y rol de cancha contra el backend real. No se modificó producción.
2. **EAS:** enlazar el proyecto, configurar environment `production` con URL y clave
   pública Supabase y dominio legal. Android además requiere clave Maps restringida
   a `com.faltauno.app` y al SHA-1 de firma de Play App Signing, no sólo del APK local.
   iOS usa Apple Maps y no necesita esa clave. No poner service_role ni secretos
   Rapyd en variables `EXPO_PUBLIC_*`.
3. **Publicar legales:** páginas del repositorio aún deben publicarse. Confirmar
   HTTP 200 sin login en privacidad, términos, eliminación de cuenta y normas,
   tanto en el dominio que se declare en las tiendas como en los links de la app.
   La URL de eliminación permite solicitarla por correo sin reinstalar la app.
4. **Acceso del revisor:** cuenta jugador verificada y cuenta cancha de prueba,
   sin OTP dependiente del propietario, con contenido de prueba identificable y
   cancha/horarios disponibles. Invitado ayuda a explorar pero no permite evaluar
   creación, denuncia, reserva ni eliminación contra el backend real.
5. **Binarios:** AAB de producción y archivo iOS firmado; revisar manifest fusionado,
   reporte de privacidad de Xcode, firmas SDK y bibliotecas nativas de 16 KB.
   El template instalado apunta a Android API 36 / mínimo 24; confirmar el valor
   real del AAB y el requisito vigente en Play Console. En iOS usar la versión
   Xcode/SDK que exija App Store Connect al subir; el deployment target (16.4)
   no es la versión SDK usada para compilar.
6. **Dispositivos:** registro/confirmación, login/logout, recuperación por deep link,
   fotos (cancelar/seleccionar), Maps, denegar notificaciones, reservar/pagar,
   denunciar/bloquear y eliminar. Probar Android 13+ y Android 16, iPhone e iPad,
   temas oscuros/Blanco, teclado, accesibilidad y rotación de iPad. No hay Xcode,
   emulador Android ni certificados en este entorno.
7. **Consolas:** completar App Privacy, Data Safety, Target Audience, clasificación
   de edad, App Access, políticas UGC, seguridad infantil si corresponde, soporte
   y capturas reales. La clasificación no se decide automáticamente «17+ por UGC»:
   responder el cuestionario vigente según las funciones y moderación reales.
   Si la cuenta Play requiere prueba cerrada, completar testers/duración que
   indique la consola antes de solicitar acceso a producción.

Los pagos actuales corresponden a participación en partidos y reservas de canchas,
servicios físicos. No se añadió suscripción ni compra de contenido digital. Si se
introduce una membresía digital, revisar de nuevo las reglas de billing de tiendas.
No declarar «no recopilamos datos»: ver la tabla de privacidad abajo.

## Base para las declaraciones de privacidad

| Datos tratados | Finalidad / visibilidad |
|---|---|
| Nombre, email, teléfono, ID de cuenta | Cuenta, contacto y soporte; no todo el perfil es público |
| Ciudad y dirección de cancha | Búsqueda y ubicación ingresadas manualmente; no ubicación del dispositivo |
| Fotos, posts, comentarios y datos de partidos | Contenido social visible a otros usuarios |
| Mensajes | Participantes/organizador y moderación autorizada |
| Reservas, precios, referencias y estados de pago | Gestión de reservas y conciliación |
| Identificación/datos bancarios de dueños y retiros | Desembolsos; no número completo de tarjeta ni CVV en la app |
| Sesión y registros de acceso de proveedores | Funcionamiento y seguridad |

Los datos están vinculados a la cuenta. No hay tracking publicitario implementado.
Los recordatorios son locales; no se registra un token push remoto en el código
actual. Validar las declaraciones también contra servicios realmente activados,
logs y configuración de proveedores, no sólo contra los campos del cliente.

## Verificación y límites

- `node --test tests/*.test.cjs`: regresiones de permisos/config, fotos, eliminación,
  denuncias Android, recordatorios, errores, store, alertas, slots y webhook.
- `python3 tests/database.py`: PostgreSQL 17 aislado, toda la cadena de migraciones,
  concurrencia y políticas de autor de Storage. Tablas Storage mínimas emuladas;
  no emula su servicio HTTP ni sustituye pruebas reales de subida/borrado.
- `tsc --noEmit`, `expo lint`, `expo config --type introspect` y `expo prebuild
  --no-install --platform all` en copia aislada.
- Exportación Android/iOS/web y navegación web pasan; resultados en
  [informe de auditoría](auditoria/revision-tiendas-2026-10-06.md). Ninguna de estas comprobaciones equivale a compilar/firma nativa.

La función `moderar-contenido` borra los archivos denunciados mediante Storage
antes de resolver el reporte. Archivos externos y copias/cache de terceros no
se pueden purgar desde la app. Las fotos se inspeccionan por personal autorizado;
no hay clasificador automático de imágenes implementado.

La comprobación offline de dependencias coincide con el SDK instalado; Expo advierte
que offline no consulta validaciones remotas. No se garantiza aprobación de tiendas.
No se hizo `eas build`, `eas submit`, push, despliegue ni cambios en consolas.

## Fuentes para verificar antes del envío

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):
  UGC (1.2), completitud/acceso (2.1), servicios físicos (3.1.3), privacidad y
  eliminación (5.1.1), login (4.8; aquí sólo email/contraseña).
- [Google Play: Photo and Video Permissions](https://support.google.com/googleplay/android-developer/answer/14115180).
- [Google Play: Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Google Play: Target API](https://support.google.com/googleplay/android-developer/answer/11926878).
- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/),
  Notifications y configuración de app de la misma versión.

Las páginas Apple/Google no pudieron descargarse desde este entorno; no se afirma
haber comprobado anuncios regulatorios posteriores ni plazos de consola. Las APIs
Expo se contrastaron con la documentación oficial v57 y los módulos instalados.
