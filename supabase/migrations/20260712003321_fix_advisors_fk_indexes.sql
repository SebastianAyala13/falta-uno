-- Advisor unindexed_foreign_keys (17): agrega un índice de cobertura a cada FK sin índice.
-- Ayuda a los lookups por FK, los joins, los borrados en cascada y las condiciones RLS que
-- filtran por estas columnas (p.ej. pagos.jugador_id, partidos.organizador_id, posts.autor_id).
--
-- NOTA: los 4 índices que el advisor marca como "unused" (memb/mov/retiros por cancha_id y
-- reportes por created_at) NO se borran a propósito: cubren FKs / sostienen el RLS del dueño y
-- el "sin uso" es un artefacto de base joven; borrarlos recrearía warnings y frenaría prod.

create index if not exists idx_bloqueos_bloqueado_id on public.bloqueos (bloqueado_id);
create index if not exists idx_calificaciones_autor_id on public.calificaciones (autor_id);
create index if not exists idx_canchas_owner_id on public.canchas (owner_id);
create index if not exists idx_comentarios_autor_id on public.comentarios (autor_id);
create index if not exists idx_comentarios_post_id on public.comentarios (post_id);
create index if not exists idx_mensajes_autor_id on public.mensajes (autor_id);
create index if not exists idx_movimientos_cancha_reserva_id on public.movimientos_cancha (reserva_id);
create index if not exists idx_pagos_jugador_id on public.pagos (jugador_id);
create index if not exists idx_pagos_partido_id on public.pagos (partido_id);
create index if not exists idx_partido_jugadores_jugador_id on public.partido_jugadores (jugador_id);
create index if not exists idx_partidos_organizador_id on public.partidos (organizador_id);
create index if not exists idx_post_likes_user_id on public.post_likes (user_id);
create index if not exists idx_posts_autor_id on public.posts (autor_id);
create index if not exists idx_posts_partido_id on public.posts (partido_id);
create index if not exists idx_reportes_autor_id on public.reportes (autor_id);
create index if not exists idx_reportes_reportado_por on public.reportes (reportado_por);
create index if not exists idx_reservas_partido_id on public.reservas (partido_id);
