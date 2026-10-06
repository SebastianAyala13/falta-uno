# Publicación en Google Play — Falta Uno

Actualizada el 6 de octubre de 2026. Consultar primero
[CUMPLIMIENTO-TIENDAS.md](CUMPLIMIENTO-TIENDAS.md): explica validación real,
configuración pendiente y categorías de datos. Esta guía no rellena respuestas
exactas por el propietario ni garantiza aprobación.

1. Verificar identidad de la cuenta/organización y requisitos de acceso a producción
   mostrados en Play Console. La prueba de 12 testers / 14 días aplica a ciertas
   cuentas personales nuevas; no asumir que toda organización la necesita.
2. Vincular el proyecto EAS y guardar variables en environment `production`.
   `app.config.ts` impide enviar el modo demo. Usar Node compatible con pnpm 11.
3. Configurar `GOOGLE_MAPS_ANDROID_API_KEY`, restringida a Maps SDK for Android,
   paquete `com.faltauno.app` y SHA-1 de Play App Signing. No pegar claves de ejemplo
   en app.json. Para APK interno puede hacer falta también el certificado EAS.
4. Aplicar migraciones/desplegar funciones descritas en el informe. Probar fotos,
   moderación y eliminación real antes del envío.
5. Publicar todos los HTML legales y comprobar HTTPS/HTTP 200 sin login. Usar el
   mismo dominio que el build; el fallback GitHub Pages debe contener las páginas
   actualizadas. URL de eliminación: `eliminar-cuenta.html` en ese hosting.
6. Generar `eas build --platform android --profile production` y revisar el AAB
   resultante: target SDK, permisos fusionados, firma y soporte de páginas de 16 KB.
   El SDK instalado usa valores API 36; validar el artefacto y requisito de la consola.
7. Completar App Content, Data Safety, clasificación, público objetivo, acceso del
   revisor, anuncios, funciones financieras y políticas aplicables.
   Declarar los datos reales: cuenta, mensajes, fotos, ciudad/dirección manual,
   reservas/pagos y datos bancarios de propietarios. No marcar «sin datos
   financieros» sólo porque el checkout vive fuera de la app. Determinar «compartir»
   según el papel real de los proveedores y las excepciones de la política vigente.
   Un filtro de lenguaje no garantiza ausencia de contenido ofensivo en UGC.
8. Proporcionar cuentas verificadas jugador/cancha, instrucciones y datos de prueba.
   El invitado no sustituye acceso completo; la cuenta de eliminación debe ser
   desechable o reponerse para los revisores.
9. Crear ficha y capturas reales. Categoría/público/clasificación deben reflejar la
   app, sin elegir otra categoría para eludir obligaciones de contenido social.
   Confirmar responsable de moderación y seguridad infantil si la política aplica.
10. Completar el testing que exija la consola y enviar el AAB después de validar
    los flujos en dispositivos reales. No se ejecutó envío ni build EAS aquí.

Los pagos son por servicios físicos (partidos/canchas). Si se añade una membresía
con prestaciones digitales, volver a evaluar Play Billing y políticas de Apple.
