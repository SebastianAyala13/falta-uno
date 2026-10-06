# Fiabilidad y concurrencia

Objetivo: mantener los flujos Expo web/nativos y demo, reducir lecturas globales y
evitar que varias solicitudes creen cupos, cobros o saldos inconsistentes.

La auditoría cubre rutas, componentes, autenticación, store, chat, marketplace,
administración, migraciones, pagos/Edge Functions y páginas legales. Prioridad:
operaciones económicas y capacidad, aislamiento entre cuentas, errores reales y
coste de lecturas. Se conserva el sistema visual de docs/DESIGN.md.

Diseño:
- PostgreSQL decide capacidad y precios; inscripción/pago y confirmación/ledger
  son transacciones idempotentes. Bloqueos por partido/cancha, no globales.
- Reservas activas no se solapan; canceladas liberan el intervalo. Disponibilidad
  pública expone horas, nunca la identidad del jugador.
- Solicitudes de retiro reservan saldo en servidor; el cliente usa saldo_cancha.
- Feed social por páginas y contadores agregados; comentarios bajo demanda.
- Hidratación deduplicada, sin éxito ficticio ante errores y con invalidación al
  cambiar de cuenta. Chat remoto no degrada silenciosamente a un chat privado.
- Regresiones con node:test y PostgreSQL 17 aislado; lint, tipos, export web y
  pruebas de navegador. No se toca la base de producción ni se publican cambios.

Límites: estas pruebas no certifican una cantidad de usuarios en producción.
Capacidad real requiere medir carga con el backend y los planes de hosting
reales. Las migraciones y Edge Functions requieren despliegue coordinado.
