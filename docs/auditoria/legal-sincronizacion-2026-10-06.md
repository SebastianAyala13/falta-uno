# Páginas legales, sincronización y accesibilidad · 6 octubre 2026

**Resultado: siete HTML locales coherentes y accesibles anónimamente; publicación remota no acreditada.** `falta-uno-legal/origin/main` está desactualizado y las comprobaciones HTTPS quedan bloqueadas en el proxy de este entorno. No afirmar que la revisión de tiendas está lista ni interpretar el bloqueo como HTTP 403 devuelto por los sitios.

## Qué se contrastó

Fuente app: `legal/*.html` en `codex/fiabilidad` posterior a 97360f4. Mirror local: `/workspace/falta-uno-legal`, cuyos cambios previos **se preservaron sin editar, publicar ni descartar**. Fuente publicada en Git: `git fetch origin main`, mirror `origin/main` en **b52bb31**. El fetch actualiza referencias, no el contenido de trabajo ni producción. No se asumió que cambios locales estuvieran publicados.

| Página | Coincide entre ambos directorios locales, SHA256 | Está en main remoto del mirror | Coincide con versión actual |
|---|---|---|---|
| privacidad.html | Sí | Sí | **No** |
| terminos.html | Sí | Sí | **No** |
| eliminar-cuenta.html | Sí | Sí | **No** |
| normas-comunidad.html | Sí | **No** | No |
| mandato-recaudo.html | Sí | **No** | No |
| terminos-marketplace.html | Sí | **No** | No |
| cancelaciones.html | Sí | **No** | No |

Prueba `python3 tests/legal_pages.py --public-http`: compara bytes/SHA256, comprueba enlaces relativos, ausencia de scripts de aplicación y título de documento legal. Servidor estático efímero local: **7 GET sin cookies/Authorization/login → 200**, contenido exacto; URL legal inexistente → **404**. Esto ensaya los HTML locales; no demuestra que el hosting público esté sirviendo esos bytes. Se corrigió la prueba de título para interpretar UTF-8 (Términos): el primer intento tenía un patrón de bytes incorrecto, no un defecto del HTML.

Configuración existente revisada, sin modificaciones: Dockerfile copia legal/*.html a dist/legal; nginx.conf:12 usa `try_files ... =404` para /legal/, sin fallback SPA. El ensayo usa servidor Python, no un despliegue de Docker/NGINX ni un build nuevo. Las páginas no incluyen una barrera de login ni JS de la app. El control de URL no considera una pantalla SPA con status 200 una política válida.

## URLs sin 200 acreditado

Las **14** solicitudes anónimas HTTPS fallaron antes de obtener una respuesta del servidor de origen: proxy CONNECT **403 Forbidden**. urllib y una comprobación independiente con curl mostraron el mismo rechazo; la ejecución escalada también recibió el rechazo del proxy. En el JSON `status:null` significa **origen no observado**, `proxy_connect_status:403` es el proxy. No se deshabilitó TLS ni se evadió la restricción de red. No se conoce desde este entorno si los hosts responden 200, 404 u otro estado.

| URL comprobada | Resultado observado |
|---|---|
| https://sebastianayala13.github.io/falta-uno-legal/privacidad.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/terminos.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/eliminar-cuenta.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/normas-comunidad.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/mandato-recaudo.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/terminos-marketplace.html | CONNECT proxy 403; HTTP origen no observado |
| https://sebastianayala13.github.io/falta-uno-legal/cancelaciones.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/privacidad.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/terminos.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/eliminar-cuenta.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/normas-comunidad.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/mandato-recaudo.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/terminos-marketplace.html | CONNECT proxy 403; HTTP origen no observado |
| https://falta-uno.kodarify.com/legal/cancelaciones.html | CONNECT proxy 403; HTTP origen no observado |

Listado completo, timestamp, hashes y evidencias separadas en `legal-urls-2026-10-06.json`, con `review_ready:false`. La prueba final terminó correctamente como **auditoría que registra discrepancias**, no como prueba de que todas las URLs públicas pasan.

## Coincidencia con app y fichas de tienda

`constants/config.ts:19–24` usa el mirror GitHub Pages cuando EXPO_PUBLIC_SITE_URL está ausente; con variable, agrega /legal al origen. `:170–172` agrega mandato, marketplace y cancelaciones. Se auditaron ambos candidatos de hosting basados en fuentes públicas del repo (`docs/RUTA-AL-MVP.md:4` menciona kodarify). No se imprimieron variables ni se inspeccionaron secretos. No se verificó el valor utilizado por el último binario ni el deploy activo.

`docs/DESPLIEGUE-DOKPLOY.md:38` pide publicar /legal/... en fichas de tienda; no hay un archivo que pruebe los valores efectivamente guardados en Play Console/App Store Connect y no se accedió a esas consolas. Una recomendación en documentación **no acredita** la ficha actual. Necesario: responsable comparar privacidad y eliminación de cuenta de ambas consolas con URL final y página real después de publicar. `mailto:` soporte abre cliente de correo; no es una página HTML a la que exigir status 200.

Posible defecto del cliente a revisar por su dueño: `constants/config.ts:20` añade /legal sin normalizar slash final. Si EXPO_PUBLIC_SITE_URL tiene slash final produce //legal; si apunta ya a .../legal duplica /legal. Configurar un origen sin slash/subruta o normalizar construcción en ese archivo antes del próximo build. **No se cambió** ni se afirmó que la configuración desplegada tenga ese defecto. Los siete archivos actuales tienen enlaces relativos existentes; no necesitan sesión para lectura.

## Pendientes concretos

1. Claude/responsable publica las siete versiones coordinadas al mirror, o define un único hosting efectivo y actualiza declaraciones/clientes bajo su propiedad. No hicimos ese despliegue ni push al mirror.
2. Permitir en red del entorno `sebastianayala13.github.io` y `falta-uno.kodarify.com`, o ejecutar la auditoría desde un entorno con acceso autorizado. Repetir GET anónimo verificando 200, título, hash y ausencia de login; no basta HEAD ni un 200 de SPA.
3. Verificar fechas/texto actuales, especialmente discrepancias de retención/Nominatim señaladas en `privacidad-codigo-2026-10-06.md`, antes de publicar.
4. Comparar con valores reales de las dos fichas y binario de revisión. Registrar los valores públicos y comprobación, nunca credenciales de consola.

Controles comunes del commit: unitarias, regresiones SQL, TypeScript, Expo lint y git diff --check; resultados reales asentados en la entrega operativa. No tocamos app, components, lib, constants, types, .github, build ni HTML legales en esta cola.
