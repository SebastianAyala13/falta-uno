-- ============================================================================
-- DATOS DE DEMO para presentación. Todo cuelga de usuarios @demo.faltauno.app,
-- así que se borra por completo con supabase/unseed-demo.sql (cascade).
-- Re-ejecutable: primero limpia la demo previa y luego inserta.
-- ============================================================================

delete from auth.users where email like '%@demo.faltauno.app';

-- ── Usuarios demo (auth.users + profiles) ───────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000001','authenticated','authenticated','andres@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '40 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Andrés"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000002','authenticated','authenticated','mateo@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '35 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Mateo"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000003','authenticated','authenticated','camilo@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '30 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Camilo"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000004','authenticated','authenticated','daniela@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '25 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Daniela"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000005','authenticated','authenticated','juan@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '20 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Juan"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0e00000-0000-4000-a000-000000000006','authenticated','authenticated','laura@demo.faltauno.app','$2a$10$demoDEMOdemoDEMOdemoDEOuMBnp8yq0i5m1n1x1v1z1a1b1c1d1e2', now(), now() - interval '15 days', now(), '{"provider":"email","providers":["email"]}','{"nombre":"Laura"}','','','','');

insert into public.profiles (id, nombre, email, ciudad, posicion, nivel, celular, avatar_url, partidos_jugados, no_shows, rating, roles, created_at) values
  ('a0e00000-0000-4000-a000-000000000001','Andrés Restrepo','andres@demo.faltauno.app','Pereira','Defensa','Competitivo','+57 310 555 0001',null,42,1,4.8,'{jugador,cancha}', now() - interval '40 days'),
  ('a0e00000-0000-4000-a000-000000000002','Mateo Gómez','mateo@demo.faltauno.app','Cali','Mediocampista','Competitivo','+57 311 555 0002',null,38,0,4.9,'{jugador,cancha}', now() - interval '35 days'),
  ('a0e00000-0000-4000-a000-000000000003','Camilo Ruiz','camilo@demo.faltauno.app','Medellín','Portero','Intermedio','+57 312 555 0003',null,27,2,4.4,'{jugador,cancha}', now() - interval '30 days'),
  ('a0e00000-0000-4000-a000-000000000004','Daniela López','daniela@demo.faltauno.app','Pereira','Delantero','Intermedio','+57 313 555 0004',null,19,0,4.7,'{jugador}', now() - interval '25 days'),
  ('a0e00000-0000-4000-a000-000000000005','Juan Ospina','juan@demo.faltauno.app','Cali','Mediocampista','Casual','+57 314 555 0005',null,12,1,4.2,'{jugador}', now() - interval '20 days'),
  ('a0e00000-0000-4000-a000-000000000006','Laura Cardona','laura@demo.faltauno.app','Medellín','Defensa','Intermedio','+57 315 555 0006',null,23,0,4.6,'{jugador}', now() - interval '15 days');

-- ── Canchas (Pereira, Cali, Medellín) ───────────────────────────────────────
insert into public.canchas (id, owner_id, nombre, direccion, zona, ciudad, lat, lng, descripcion, telefono, formatos, amenidades, fotos, foto_portada, estado, comision_pct, created_at) values
  ('a0e00000-0000-4000-b000-000000000001','a0e00000-0000-4000-a000-000000000001','Cancha La Bombonera','Cra 25 #72-14','Cuba','Pereira',4.8087,-75.7736,'Sintética premium, la mejor de Cuba. Buena iluminación y parqueadero amplio.','+57 310 555 0001','{5v5,7v7}','{"duchas":true,"banos":true,"parqueadero":true,"iluminacion":true,"cubierta_lluvia":true,"tienda":true,"alquiler_implementos":true}','{https://picsum.photos/seed/bombonera1/600/400,https://picsum.photos/seed/bombonera2/600/400}','https://picsum.photos/seed/bombonera1/600/400','activa',0.10, now() - interval '38 days'),
  ('a0e00000-0000-4000-b000-000000000002','a0e00000-0000-4000-a000-000000000001','Cancha Los Álamos','Av. Sur #40-20','Álamos','Pereira',4.7955,-75.7120,'Ideal para el parche del finde. Cafetería y gradas.','+57 310 555 0001','{5v5}','{"banos":true,"cafeteria":true,"gradas":true,"iluminacion":true}','{https://picsum.photos/seed/alamos1/600/400}','https://picsum.photos/seed/alamos1/600/400','activa',0.10, now() - interval '20 days'),
  ('a0e00000-0000-4000-b000-000000000003','a0e00000-0000-4000-a000-000000000002','Sintética El Jardín','Calle 5 #38-40','San Fernando','Cali',3.4210,-76.5410,'Sintética techada, se juega llueva o truene. Árbitro disponible.','+57 311 555 0002','{7v7,11v11}','{"duchas":true,"banos":true,"parqueadero":true,"iluminacion":true,"cubierta_lluvia":true,"arbitro":true,"wifi":true}','{https://picsum.photos/seed/jardin1/600/400,https://picsum.photos/seed/jardin2/600/400}','https://picsum.photos/seed/jardin1/600/400','activa',0.10, now() - interval '30 days'),
  ('a0e00000-0000-4000-b000-000000000004','a0e00000-0000-4000-a000-000000000003','Coliseo El Poblado','Cra 43A #18-30','El Poblado','Medellín',6.2088,-75.5670,'Complejo deportivo con dos canchas. Tienda y duchas.','+57 312 555 0003','{5v5,7v7}','{"duchas":true,"banos":true,"tienda":true,"parqueadero":true,"iluminacion":true,"gradas":true}','{https://picsum.photos/seed/poblado1/600/400}','https://picsum.photos/seed/poblado1/600/400','activa',0.10, now() - interval '18 days');

-- ── Disponibilidad (horarios) ───────────────────────────────────────────────
insert into public.cancha_disponibilidad (cancha_id, dia_semana, hora_apertura, hora_cierre, duracion_min, precio, activo)
select c, d, '18:00', '23:00', 60, p, true
from (values
  ('a0e00000-0000-4000-b000-000000000001'::uuid, 60000),
  ('a0e00000-0000-4000-b000-000000000002'::uuid, 55000),
  ('a0e00000-0000-4000-b000-000000000003'::uuid, 80000),
  ('a0e00000-0000-4000-b000-000000000004'::uuid, 70000)
) as x(c, p)
cross join (values (1),(2),(3),(4),(5),(6)) as y(d);

-- ── Partidos (feed) ─────────────────────────────────────────────────────────
insert into public.partidos (id, organizador_id, cancha, zona, fecha, hora, formato, nivel, precio, cupos_totales, cupos_ocupados, descripcion, lat, lng, foto_url, created_at) values
  ('a0e00000-0000-4000-c000-000000000001','a0e00000-0000-4000-a000-000000000001','Cancha La Bombonera','Cuba', current_date + 1, '20:00','5v5','Intermedio',12000,10,9,'Falta uno parce, ya están las llaves armadas.',4.8087,-75.7736,'https://picsum.photos/seed/bombonera1/600/400', now() - interval '2 days'),
  ('a0e00000-0000-4000-c000-000000000002','a0e00000-0000-4000-a000-000000000002','Sintética El Jardín','San Fernando', current_date + 2, '19:30','7v7','Competitivo',15000,14,12,'Para los que juegan en serio. Cuadramos arbitraje.',3.4210,-76.5410,'https://picsum.photos/seed/jardin1/600/400', now() - interval '1 days'),
  ('a0e00000-0000-4000-c000-000000000003','a0e00000-0000-4000-a000-000000000003','Coliseo El Poblado','El Poblado', current_date + 1, '21:00','5v5','Casual',13000,10,6,'Pa pasarla bueno. Todos bienvenidos.',6.2088,-75.5670,'https://picsum.photos/seed/poblado1/600/400', now() - interval '3 days'),
  ('a0e00000-0000-4000-c000-000000000004','a0e00000-0000-4000-a000-000000000004','Cancha Los Álamos','Álamos', current_date + 3, '18:00','5v5','Casual',11000,10,4,'Tarde de fútbol, llevá la del equipo.',4.7955,-75.7120,'https://picsum.photos/seed/alamos1/600/400', now() - interval '1 days'),
  ('a0e00000-0000-4000-c000-000000000005','a0e00000-0000-4000-a000-000000000002','Sintética El Jardín','San Fernando', current_date + 4, '20:30','11v11','Competitivo',16000,22,20,'Mundialito del jueves. Cuadrá tu equipo.',3.4210,-76.5410,'https://picsum.photos/seed/jardin2/600/400', now() - interval '4 hours');

-- ── Reservas (varias, distintos estados) ────────────────────────────────────
insert into public.reservas (id, cancha_id, jugador_id, fecha, hora_inicio, hora_fin, precio, comision, estado, medio, referencia, created_at) values
  ('a0e00000-0000-4000-d000-000000000001','a0e00000-0000-4000-b000-000000000001','a0e00000-0000-4000-a000-000000000004', current_date + 1, '20:00','21:00',60000,6000,'confirmada','online','FU-RD0001', now() - interval '2 days'),
  ('a0e00000-0000-4000-d000-000000000002','a0e00000-0000-4000-b000-000000000003','a0e00000-0000-4000-a000-000000000005', current_date + 2, '19:00','20:00',80000,8000,'confirmada','online','FU-RD0002', now() - interval '1 days'),
  ('a0e00000-0000-4000-d000-000000000003','a0e00000-0000-4000-b000-000000000004','a0e00000-0000-4000-a000-000000000006', current_date + 1, '21:00','22:00',70000,7000,'confirmada','online','FU-RD0003', now() - interval '6 hours'),
  ('a0e00000-0000-4000-d000-000000000004','a0e00000-0000-4000-b000-000000000001','a0e00000-0000-4000-a000-000000000005', current_date + 3, '19:00','20:00',60000,0,'pendiente','online','FU-RD0004', now() - interval '2 hours'),
  ('a0e00000-0000-4000-d000-000000000005','a0e00000-0000-4000-b000-000000000002','a0e00000-0000-4000-a000-000000000004', current_date - 2, '18:00','19:00',55000,0,'completada','efectivo','FU-RD0005', now() - interval '5 days'),
  ('a0e00000-0000-4000-d000-000000000006','a0e00000-0000-4000-b000-000000000003','a0e00000-0000-4000-a000-000000000006', current_date - 1, '20:00','21:00',80000,8000,'completada','online','FU-RD0006', now() - interval '3 days');

-- ── Pagos (para GMV) ────────────────────────────────────────────────────────
insert into public.pagos (partido_id, jugador_id, medio, monto, comision, estado, referencia, created_at) values
  ('a0e00000-0000-4000-c000-000000000001','a0e00000-0000-4000-a000-000000000004','online',12960,960,'aprobado','FU-PD0001', now() - interval '1 days'),
  ('a0e00000-0000-4000-c000-000000000002','a0e00000-0000-4000-a000-000000000005','online',16200,1200,'aprobado','FU-PD0002', now() - interval '20 hours'),
  ('a0e00000-0000-4000-c000-000000000003','a0e00000-0000-4000-a000-000000000006','online',14040,1040,'aprobado','FU-PD0003', now() - interval '2 days'),
  ('a0e00000-0000-4000-c000-000000000004','a0e00000-0000-4000-a000-000000000005','efectivo',11000,0,'pendiente','FU-PD0004', now() - interval '3 hours');

-- ── Ledger de canchas (ingresos + comisiones → saldo) ───────────────────────
insert into public.movimientos_cancha (cancha_id, tipo, monto, reserva_id, descripcion, created_at) values
  ('a0e00000-0000-4000-b000-000000000001','ingreso_reserva',60000,'a0e00000-0000-4000-d000-000000000001','Ingreso por reserva (PayU)', now() - interval '2 days'),
  ('a0e00000-0000-4000-b000-000000000001','comision',-6000,'a0e00000-0000-4000-d000-000000000001','Comisión Falta Uno', now() - interval '2 days'),
  ('a0e00000-0000-4000-b000-000000000003','ingreso_reserva',80000,'a0e00000-0000-4000-d000-000000000002','Ingreso por reserva (PayU)', now() - interval '1 days'),
  ('a0e00000-0000-4000-b000-000000000003','comision',-8000,'a0e00000-0000-4000-d000-000000000002','Comisión Falta Uno', now() - interval '1 days'),
  ('a0e00000-0000-4000-b000-000000000003','ingreso_reserva',80000,'a0e00000-0000-4000-d000-000000000006','Ingreso por reserva (PayU)', now() - interval '3 days'),
  ('a0e00000-0000-4000-b000-000000000003','comision',-8000,'a0e00000-0000-4000-d000-000000000006','Comisión Falta Uno', now() - interval '3 days'),
  ('a0e00000-0000-4000-b000-000000000004','ingreso_reserva',70000,'a0e00000-0000-4000-d000-000000000003','Ingreso por reserva (PayU)', now() - interval '6 hours'),
  ('a0e00000-0000-4000-b000-000000000004','comision',-7000,'a0e00000-0000-4000-d000-000000000003','Comisión Falta Uno', now() - interval '6 hours');

-- ── Retiros (para aprobar en la Plataforma Madre) ───────────────────────────
insert into public.retiros (cancha_id, monto, estado, solicitado_at) values
  ('a0e00000-0000-4000-b000-000000000003', 100000, 'solicitado', now() - interval '5 hours'),
  ('a0e00000-0000-4000-b000-000000000001', 40000, 'solicitado', now() - interval '2 days');

-- ── Membresía activa (0% comisión) ──────────────────────────────────────────
insert into public.membresias_cancha (cancha_id, plan, estado, vigente_hasta) values
  ('a0e00000-0000-4000-b000-000000000001','mensual','activa', current_date + 25);

-- ── Muro social (posts + comentarios) ───────────────────────────────────────
insert into public.posts (id, tipo, autor_id, autor_nombre, autor_avatar, texto, foto_url, partido_id, likes, created_at) values
  ('a0e00000-0000-4000-e000-000000000001','encuentro','a0e00000-0000-4000-a000-000000000001','Andrés Restrepo',null,'Partidazo anoche en La Bombonera 🔥 quedó 6-5 en el último minuto. ¿Quién se le mide la otra semana?',null,'a0e00000-0000-4000-c000-000000000001','{}', now() - interval '1 days'),
  ('a0e00000-0000-4000-e000-000000000002','pregunta','a0e00000-0000-4000-a000-000000000005','Juan Ospina',null,'¿Mejor sintética en Cali para 7v7? Armando parche fijo los jueves 🙌',null,null,'{}', now() - interval '2 days'),
  ('a0e00000-0000-4000-e000-000000000003','encuentro','a0e00000-0000-4000-a000-000000000006','Laura Cardona',null,'Buen nivel el de anoche en El Poblado. Gracias por el parche, quedamos para la revancha ⚽',null,'a0e00000-0000-4000-c000-000000000003','{}', now() - interval '8 hours');

insert into public.comentarios (post_id, autor_id, autor_nombre, texto, created_at) values
  ('a0e00000-0000-4000-e000-000000000001','a0e00000-0000-4000-a000-000000000004','Daniela López','¡Yo me apunto! Avisá cuándo 🙋‍♀️', now() - interval '20 hours'),
  ('a0e00000-0000-4000-e000-000000000001','a0e00000-0000-4000-a000-000000000005','Juan Ospina','Golazo el del final jaja', now() - interval '18 hours'),
  ('a0e00000-0000-4000-e000-000000000002','a0e00000-0000-4000-a000-000000000002','Mateo Gómez','Pasate por El Jardín, es techada 👌', now() - interval '1 days');

-- Likes (tabla post_likes)
insert into public.post_likes (post_id, user_id) values
  ('a0e00000-0000-4000-e000-000000000001','a0e00000-0000-4000-a000-000000000004'),
  ('a0e00000-0000-4000-e000-000000000001','a0e00000-0000-4000-a000-000000000005'),
  ('a0e00000-0000-4000-e000-000000000001','a0e00000-0000-4000-a000-000000000006'),
  ('a0e00000-0000-4000-e000-000000000003','a0e00000-0000-4000-a000-000000000004');
