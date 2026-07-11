-- Borra TODOS los datos de demo. Todo cuelga de los usuarios @demo.faltauno.app,
-- así que borrarlos elimina en cascada canchas, reservas, partidos, pagos, ledger,
-- retiros, membresías, posts y comentarios de la demo. No toca datos reales.
delete from auth.users where email like '%@demo.faltauno.app';
