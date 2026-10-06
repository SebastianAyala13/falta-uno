# Respuestas de privacidad derivadas del código · versión 2026-10-06.1

Inventario común: legal/privacidad.html e informe docs/auditoria/privacidad-codigo-2026-10-06.md. Reemplaza la declaración de julio: no copiar respuestas automáticas ni inventar respuestas a preguntas de consola que no se verificaron. Esta entrega no aprueba un build ni modifica Play Console/App Store Connect.

| Dato observado y función | Play: categoría de trabajo | Apple: categoría de trabajo | Vinculación / finalidad / decisión pendiente |
|---|---|---|---|
| Nombre, email, celular / cuenta | Personal info | Contact Info | Vinculados; cuenta y funcionalidad; requerimiento según campo de registro |
| UUID / cuenta e interacción | User IDs | User ID | Vinculado; funcionalidad/seguridad, no identificador publicitario |
| Ciudad/dirección y punto de cancha/partido / mapas | Personal info y/o Location según dato | Physical Address, Location según precisión real | No excluir ubicación por ausencia de GPS nativo: el punto se registra y comparte. GPS preciso opcional solo web; confirmar clasificación del punto de negocio en formulario vigente |
| Fotos / perfil, posts, partidos, cancha | Photos | Photos or Videos | Opcionales, vinculadas, públicas por URL; bucket media, compatibilidad canchas |
| Chat / partido | Messages | User Content / mensajes | Vinculado, participantes y moderación de reportes; no acceso a SMS externos |
| Posts, comentarios, likes, rating, bloqueos y reportes | App activity / Other user-generated content | Other User Content; verificar interacción según formulario | Vinculados; funcionalidad y prevención de abuso |
| Reserva, pago, importe, comisión, medio, estado y referencias | Financial info / Purchase history y otra información financiera | Purchase History, Payment Info y Other Financial Info según campo | Sí se recogen aun sin guardar tarjeta completa; verificar requerimiento cuando checkout esté activado |
| Banco, cuenta/celular, titular y documento / desembolso | Financial info y Personal info para identificación | Payment Info / Other Financial Info; documento según formulario | Vinculados al dueño; necesarios para retiro. No afirmar ausencia de identificación oficial |
| Sesión, contraseña remitida a Auth y aceptación | Cuenta/identificadores, según preguntas específicas | Cuenta/identificadores, según preguntas específicas | No se guarda password en texto por app; no publicar tokens en evidencia |
| Recordatorio local | No hay token push remoto observado | No justificar Device ID por un token inexistente | Revisar SDK del binario para cualquier otro Device ID; local no equivale a Expo Push |
| IP y logs de servicios, errores, correo de soporte | Pendiente revisar proveedores/configuración | Pendiente revisar proveedores/configuración | Ausencia de SDK de analytics/crash no demuestra ausencia de metadatos técnicos ni su retención |

## Respuestas generales defendibles y límites

- Recogida: **sí**. Relacionados con usuario/referencia: **sí**, salvo que un flujo concreto demuestre lo contrario. Cambiar UUID por una referencia no anonimiza un registro.
- Finalidades: funcionalidad, cuenta, reservas/transacciones, seguridad/moderación y soporte. No se observó SDK explícito de publicidad/analítica ni tracking entre apps. Verificar SDK/manifiestos y proveedores del binario antes de contestar tracking definitivamente.
- Compartición: hay UGC a otros usuarios, imágenes públicas, Supabase, Rapyd, Google/mapas, Nominatim y correo. «No vendemos» no responde «No compartimos». Determinar excepciones de procesadores/acciones iniciadas por usuario según contrato y formulario vigente; **NO elegir globalmente “Not shared” sin revisar**.
- Cifrado en tránsito: HTTPS en flujos observados. No afirmar cifrado especial del almacenamiento local ni certificación de toda configuración desplegada.
- Solicitud de eliminación: existe dentro de app y por página pública/correo. La retención y obligaciones pendientes se explican en la política y en el punto 2 de la entrega; deben implementarse/desplegarse coordinadamente. No prometer purga de backups, correo, PSP o copias externas no probadas.
- Opcional/requerido: cuenta para uso autenticado; fotos/UGC opcionales; datos bancarios para retiro; GPS web opcional. Revisar cada pantalla y variante de build. No asumir que todos los campos son opcionales o requeridos por una categoría global.
- No se observan acceso a contactos, calendario, SMS, micrófono, cámara, salud ni inventario de apps. No usar esto para negar datos financieros, identificación o fotos voluntarias con contenido sensible.

## Revisión humana necesaria antes de enviar

1. Verificar preguntas actuales de ambas consolas, opciones de datos financieros/identificación/ubicación y condiciones de cada proveedor. El manifiesto iOS incluye 12 tipos; no rellena las consolas.
2. Comprobar binario, flags y SDK: Rapyd es proveedor observado, no PayU. Credenciales/configuración de PSP reales no fueron inspeccionadas.
3. Cuestionarios de edad: UGC, chat y moderación presentes; 13+ es requisito declarado por registro, no edad comprobada ni clasificación IARC/Apple. No predecir automáticamente 17+ ni otros rangos.
4. Publicación legal: el responsable confirmó siete rutas 200 sin sesión en https://falta-uno.kodarify.com/legal/. El bundle desplegado apunta al espejo incompleto; normas-comunidad.html da 404 allí según verificación externa del responsable. Configurar EXPO_PUBLIC_SITE_URL en despliegue y reconstruir; no modificar el espejo.
5. Consentimiento: nueva versión **2026-10-06.1** en HTML; actualizar `constants/config.ts:32` (POLITICA_VERSION) y coordinar aviso/reaceptación de usuarios existentes. No se editó constants por límite de propiedad. Cambiar una constante por sí solo no obtiene nuevo consentimiento de cuentas antiguas.

No borrar datos reales ni crear contenido ficticio de producción para conseguir aprobación. Esta declaración tiene pendientes explícitos y no constituye una garantía de aceptación por las tiendas.
