# Resultado de revisión Android/iOS

**6 de octubre de 2026.** Código corregido y verificado localmente; **no listo
para enviar sin completar despliegue, configuración y pruebas de binarios**.
No se garantiza aprobación ni se modificaron las consolas de las tiendas.

## Resultado comprobado

| Comprobación | Resultado |
|---|---|
| node:test | 40 pruebas pasan |
| PostgreSQL 17 aislado | 14 grupos pasan, incluida toda la cadena de migraciones |
| TypeScript / Expo lint / diff whitespace | Pasan |
| Prebuild limpio Android e iOS | Pasa en copia aislada, sin instalar Pods |
| Export Android / iOS | Bundles Hermes generados correctamente |
| Export web y nginx | Pasa; 7 páginas legales responden 200 en runtime local |
| Navegador | Pago efectivo demo, búsqueda, rutas inválidas, todos los motivos de denuncia, cancelar eliminación, links legales, 7 temas, viewport tablet; sin excepciones |
| Icono iOS generado | 1024 × 1024 RGB, sin canal alfa |
| Permisos generados Android | Biblioteca completa, cámara, audio, GPS y overlay bloqueados mediante tools:node=remove |
| Info.plist / privacidad iOS | Sin mensajes de cámara/micrófono; manifiesto con 12 categorías y tracking false |
| Compilación nativa y firma AAB/IPA | Pendiente: no hay Android SDK/emulador, Xcode ni certificados en este entorno |

La exportación Hermes comprueba empaquetado JavaScript; el prebuild comprueba
configuración/generación de archivos. Ninguno ejecuta el código en Android o iOS.
El manifest fusionado de Gradle y los manifiestos de SDK dentro del archivo Xcode
requieren comprobación del binario final. Los recordatorios incorporan permisos
POST_NOTIFICATIONS/arranque desde expo-notifications; no se declaran permisos de
alarma exacta. No se probó la pasarela ni el servicio HTTP de Storage en producción.

## Cambios principales

- Picker del sistema, sin exigir acceso completo a fotos; iOS usa PHPicker sin
  edición heredada. Fotos de perfil, muro, partidos y canchas compartidas a
  Storage por autor, máximo 5 MB y tipos de imagen permitidos.
- Maps mediante plugin y clave de entorno; EAS Android production no admite
  clave de ejemplo. EAS production tampoco admite backend ausente/demo.
- Borrado de cuenta autenticado, archivos propios antes de Auth/cascada y sin
  éxito ficticio. No se acepta un usuario objetivo enviado por el cliente.
- Menús Android conservan todos los motivos; reportes sobre partidos, canchas,
  organizadores, muro y chat. El servidor determina autor y foto reales del
  reporte para impedir atribuciones falsas.
- Moderación de imágenes mediante función de servidor autorizada para admins;
  borra los archivos propios denunciados antes de resolver el reporte. Fotos
  externas y cache/copias de terceros no se eliminan con nuestra API.
- Partidos y canchas retirados quedan ocultos, conservando pagos e inscripciones;
  no aceptan nuevas inscripciones/reservas. Sólo moderación puede cambiar oculto.
- Canales de recordatorios Android creados antes del permiso; error de enlace
  de recuperación no habilita un formulario con la sesión anterior.
- Ayuda/contacto, normas, privacidad y términos separados dentro de Perfil.
  Legales sincronizadas en ambos repositorios, incluyendo marketplace y
  prohibición explícita de explotación/abuso sexual infantil.
- Política corregida sobre pagos/datos bancarios, visibilidad social, eliminación
  y backups; versión de consentimiento actualizada a 2026-10-06.

## Activación y requisitos de envío

Leer [CUMPLIMIENTO-TIENDAS.md](../CUMPLIMIENTO-TIENDAS.md) y la guía de Play
actualizada. Esta revisión reemplaza el veredicto anterior «cero bloqueantes».

1. Respaldar y probar todas las migraciones nuevas, en orden:
   `20261005200000_fiabilidad_concurrencia.sql`,
   `20261006120000_media_y_eliminacion.sql`,
   `20261006130000_moderacion_contenido_completo.sql`,
   `20261006140000_archivos_moderacion.sql`.
   La primera requiere resolver conflictos preexistentes de reservas/horarios;
   ver [preflight SQL](fiabilidad-y-capacidad.md). Las siguientes requieren
   el esquema Storage de Supabase. No aplicar el stub del test a producción.
2. Desplegar `delete-user` y `moderar-contenido`; ambas identifican al usuario
   mediante getUser, y moderación revalida is_admin. Mantener verificación JWT.
   Desplegar checkout/webhook Rapyd de la revisión previa sólo cuando estén
   configurados y probados sus secretos. Publicar después el nuevo cliente.
3. Publicar los HTML de `falta-uno/legal` y/o el mirror `falta-uno-legal`;
   comprobar las URLs declaradas en tiendas y app, no sólo las rutas locales.
4. Configurar proyecto/EAS/variables, clave Maps Android restringida a la firma
   real de Play, credenciales de revisión y operación humana de moderación.
5. Probar AAB e IPA firmados en Android, iPhone e iPad con backend real. Validar
   permisos denegados, fotos, recuperación, pago/reserva, denuncia y borrado de
   cuenta con datos. Revisar requisitos vigentes de SDK/16 KB/Privacy/Data Safety,
   clasificación de edad y testing que muestren las consolas.

No se publicaron repositorios, web, funciones ni builds EAS. El entorno no permitió
descargar las páginas oficiales Apple/Google; los links normativos están en el
checklist para contrastarlos al enviar. Sí se leyeron docs Expo v57 y las APIs
instaladas. No se inventaron números de usuarios soportados ni aprobación de tienda.
