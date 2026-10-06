# Ruta al MVP — Falta Uno

**Fecha:** 5 de octubre de 2026
**Estado del producto:** la app web está en línea y funcionando en <https://falta-uno.kodarify.com>

Este documento ordena lo que falta para abrir al público. Complementa
[CUMPLIMIENTO-TIENDAS.md](CUMPLIMIENTO-TIENDAS.md), que cubre a fondo el camino de las tiendas.

---

## La decisión de fondo: salir por web primero

La app ya está desplegada y **diseñada para funcionar sin pasarela de pagos**: el medio
efectivo deja el pago en `pendiente` y el acuerdo real ocurre en la cancha, que es
justamente el modelo declarado ("Falta Uno no custodia tu dinero").

Eso abre un camino mucho más corto que el de las tiendas:

| | Web | Tiendas |
| --- | --- | --- |
| Costo de entrada | $0 | $99/año Apple + $25 Google |
| Revisión | ninguna | días o semanas, con rechazos posibles |
| Closed testing de Play | no aplica | 12 testers durante 14 días |
| Google Maps Android key | no hace falta | obligatoria |
| Tiempo a primer usuario real | días | semanas |

**Recomendación: lanzar en web, en Pereira, cobrando en efectivo.** Las tiendas y los
pagos online entran después, con usuarios de verdad y aprendizajes reales en la mano.

---

## Fase 0 — Cerrar lo que hoy está roto

Nada de esto es grande, pero todo golpea a un usuario real el primer día.

| # | Qué | Quién | Estado |
| --- | --- | --- | --- |
| 0.1 | **Recuperar contraseña no funciona.** Choca contra la cuota de 2 correos/hora del SMTP por defecto de Supabase. Se arregla montando SMTP propio (Gmail con contraseña de aplicación, o Resend). Hasta entonces, a quien olvide la clave hay que cambiársela a mano. | Claude, con token | pendiente |
| 0.2 | **Desplegar la Edge Function `delete-user`.** Hoy responde 404 y el botón "Eliminar cuenta" falla. La política de privacidad publicada promete ese borrado. | Claude, con token | pendiente |
| 0.3 | **`EXPO_PUBLIC_SITE_URL` como build arg en Dokploy.** Sin ella los enlaces legales de la app apuntan al espejo de GitHub Pages en vez de al dominio propio. | Dueño, 2 min | pendiente |
| 0.4 | **Rotar los secretos de producción expuestos** (llaves de Wompi que quedaron en `.supabase-deploy.env` de la etapa anterior). Si Wompi ya no se usa, borrarlas. | Dueño | pendiente |

---

## Fase 1 — MVP web en Pereira, solo efectivo

| # | Qué | Quién |
| --- | --- | --- |
| 1.1 | **Bloque "que me guíe":** completar esqueletos de carga, pantallas vacías con acción sugerida y avisos de error en el ~40% de pantallas que no los tienen. Es lo que separa una app que se siente terminada de una que se siente a medias. | Claude |
| 1.2 | **Recorrido completo de prueba:** registro → crear partido → unirse → chat → calificar, y el flujo de dueño: registrar cancha → agenda → reserva → finanzas. Con dos cuentas reales, no demo. | Ambos |
| 1.3 | **Cargar canchas reales:** 2 o 3 canchas de Pereira con fotos, horarios y precios de verdad. Sin oferta real no hay producto. | Dueño |
| 1.4 | **Invitar el primer grupo:** 10-15 jugadores conocidos. La pregunta que decide todo: ¿se arma un partido sin que usted empuje? | Dueño |

**Criterio de salida de la fase:** tres partidos armados por usuarios, sin intervención suya.

---

## Fase 2 — Pagos online

No es desarrollo: la integración con Rapyd está escrita y sus dos Edge Functions
están desplegadas y respondiendo. Lo que falta es la cuenta de comercio.

| # | Qué | Quién |
| --- | --- | --- |
| 2.1 | Abrir cuenta en Rapyd y **confirmar con ellos que dan Nequi y PSE en Colombia**. Si no los dan, el plan B es volver a Wompi: ya hubo cuenta y el código está en la historia de git. | Dueño |
| 2.2 | Cargar las llaves como secretos del proyecto en Supabase. | Claude, con token |
| 2.3 | Prueba de punta a punta en sandbox: checkout → webhook → el pago queda `aprobado` **escrito por el servidor**, nunca por el cliente. | Claude |
| 2.4 | Encender `EXPO_PUBLIC_PAGOS_ONLINE` en los build args y reconstruir. | Ambos |

---

## Fase 3 — Apps en las tiendas

El orden importa porque la última tarea tiene un reloj de 14 días que no se puede acelerar.
Ver el detalle en [CUMPLIMIENTO-TIENDAS.md](CUMPLIMIENTO-TIENDAS.md).

| # | Qué | Quién |
| --- | --- | --- |
| 3.1 | Cuentas de desarrollador: Apple ($99/año) y Google Play ($25 único). | Dueño |
| 3.2 | Google Maps Android API key (hoy `app.json` tiene el placeholder; sin ella el mapa sale gris en Android). | Dueño |
| 3.3 | Variables de producción en el environment `production` de EAS. | Dueño |
| 3.4 | Primer build de EAS. Con build nativo recién tienen sentido las **notificaciones push** (hoy solo hay recordatorios locales). | Claude |
| 3.5 | Cuestionarios de App Privacy y Data Safety, Content Rating, Age Rating 17+ por contenido de usuarios, capturas y ficha. Las respuestas exactas ya están escritas en [RESPUESTAS-PRIVACIDAD-TIENDAS.md](RESPUESTAS-PRIVACIDAD-TIENDAS.md). | Dueño |
| 3.6 | **Closed testing de Play: 12 testers durante 14 días.** Arrancarlo apenas haya un build subible; es el camino crítico. | Dueño |

---

## Qué bloquea qué

- La Fase 0 y la Fase 1 **no dependen de nada externo**: se pueden hacer ya.
- La Fase 2 depende de un trámite comercial, no de código. Se puede ir tramitando en
  paralelo a la Fase 1.
- La Fase 3 depende de tener plata puesta en las cuentas y del reloj de 14 días de Google.
  Si el objetivo es estar en tiendas, abrir las cuentas temprano aunque el resto no esté.

## Lo único que me falta para avanzar

Un Personal Access Token de Supabase (<https://supabase.com/dashboard/account/tokens>).
Con él quedan resueltos 0.1, 0.2 y 2.2 sin más idas y vueltas. Sin él, lo que puedo hacer
solo es 1.1.
