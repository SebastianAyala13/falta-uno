-- Moderación accionable (Apple Guideline 1.2 / Google UGC).
--
-- El panel de reportes (app/admin/reportes.tsx) solo LISTABA los reportes: un admin no podía
-- eliminar el contenido reportado ni expulsar al autor desde la app (las policies de DELETE de
-- posts/comentarios/mensajes solo permiten al propio autor). Apple 1.2 exige poder ACTUAR sobre
-- los reportes en ≤24h. Esta migración agrega:
--   1) un estado a cada reporte (para rastrear qué se atendió),
--   2) un flag de suspensión en profiles (usuario expulsado por moderación),
--   3) admin_resolver_reporte(): elimina el contenido reportado (bypass de la RLS por-autor vía
--      SECURITY DEFINER) y marca el reporte como resuelto/descartado,
--   4) admin_suspender_usuario(): marca/desmarca a un usuario como suspendido.
--
-- Es ADITIVA: no toca tablas ni policies existentes; solo agrega columnas (con default) y funciones.
-- Idempotente (re-ejecutable): IF NOT EXISTS + CREATE OR REPLACE + guard de constraint.

-- 1) Estado de los reportes.
alter table "public"."reportes"
  add column if not exists "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reportes_estado_check') then
    alter table "public"."reportes"
      add constraint "reportes_estado_check"
      check (("estado" = any (array['pendiente'::"text", 'resuelto'::"text", 'descartado'::"text"])));
  end if;
end $$;

-- 2) Flag de suspensión (expulsión por moderación).
alter table "public"."profiles"
  add column if not exists "suspendido" boolean DEFAULT false NOT NULL;

-- 3) Resolver un reporte: opcionalmente elimina el contenido y marca el estado.
CREATE OR REPLACE FUNCTION "public"."admin_resolver_reporte"("p_reporte" "uuid", "p_estado" "text", "p_eliminar" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.reportes%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('resuelto', 'descartado') then raise exception 'Estado inválido'; end if;

  select * into r from public.reportes where id = p_reporte;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_eliminar then
    if r.tipo = 'post' then
      delete from public.posts where id = r.contenido_id::uuid;
    elsif r.tipo = 'comentario' then
      delete from public.comentarios where id = r.contenido_id::uuid;
    elsif r.tipo = 'mensaje' then
      delete from public.mensajes where id = r.contenido_id::uuid;
    end if;
  end if;

  update public.reportes set estado = p_estado where id = p_reporte;
end $$;

ALTER FUNCTION "public"."admin_resolver_reporte"("p_reporte" "uuid", "p_estado" "text", "p_eliminar" boolean) OWNER TO "postgres";

-- 4) Suspender / reactivar un usuario.
CREATE OR REPLACE FUNCTION "public"."admin_suspender_usuario"("p_usuario" "uuid", "p_suspendido" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set suspendido = p_suspendido where id = p_usuario;
end $$;

ALTER FUNCTION "public"."admin_suspender_usuario"("p_usuario" "uuid", "p_suspendido" boolean) OWNER TO "postgres";

-- Grants: igual que las demás funciones admin — authenticated (el panel las llama) + service_role;
-- se revoca de anon y PUBLIC (higiene de los advisors 0028/0029, no reintroducir la exposición).
GRANT ALL ON FUNCTION "public"."admin_resolver_reporte"("p_reporte" "uuid", "p_estado" "text", "p_eliminar" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_resolver_reporte"("p_reporte" "uuid", "p_estado" "text", "p_eliminar" boolean) TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."admin_resolver_reporte"("p_reporte" "uuid", "p_estado" "text", "p_eliminar" boolean) FROM anon, public;

GRANT ALL ON FUNCTION "public"."admin_suspender_usuario"("p_usuario" "uuid", "p_suspendido" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_suspender_usuario"("p_usuario" "uuid", "p_suspendido" boolean) TO "service_role";
REVOKE EXECUTE ON FUNCTION "public"."admin_suspender_usuario"("p_usuario" "uuid", "p_suspendido" boolean) FROM anon, public;
