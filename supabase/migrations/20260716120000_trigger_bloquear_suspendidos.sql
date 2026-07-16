-- Enforcement server-side de la suspensión (Apple Guideline 1.2 / Google UGC).
--
-- La suspensión (profiles.suspendido, migración 20260715120000) hasta ahora se aplicaba SOLO en el
-- cliente: lib/auth.tsx cierra la sesión del usuario suspendido al hidratar. Un cliente modificado
-- (o un token todavía válido) podía seguir insertando contenido. Este trigger bloquea, a nivel de
-- base de datos, que un usuario suspendido cree posts, comentarios, mensajes o partidos. Es defensa
-- en profundidad: no depende de que la app se porte bien.
--
-- Nota sobre auth.uid() dentro de SECURITY DEFINER: el rol de ejecución cambia (para poder leer
-- profiles saltando la RLS), pero auth.uid() lee las claims del request (GUC), no el owner de la
-- función, así que sigue devolviendo el uid del llamante real. En operaciones de servidor/seed
-- (postgres/service_role) auth.uid() es NULL -> el EXISTS no encuentra fila -> no bloquea. Correcto.
--
-- Aditiva e idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS antes de cada CREATE TRIGGER.

CREATE OR REPLACE FUNCTION "public"."rechazar_si_suspendido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and suspendido
  ) then
    raise exception 'Cuenta suspendida por moderación'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

ALTER FUNCTION "public"."rechazar_si_suspendido"() OWNER TO "postgres";

-- Adjuntar a las tablas de contenido de usuario (las reportables + creación de partidos).
DROP TRIGGER IF EXISTS "trg_no_suspendido_posts" ON "public"."posts";
CREATE TRIGGER "trg_no_suspendido_posts"
  BEFORE INSERT ON "public"."posts"
  FOR EACH ROW EXECUTE FUNCTION "public"."rechazar_si_suspendido"();

DROP TRIGGER IF EXISTS "trg_no_suspendido_comentarios" ON "public"."comentarios";
CREATE TRIGGER "trg_no_suspendido_comentarios"
  BEFORE INSERT ON "public"."comentarios"
  FOR EACH ROW EXECUTE FUNCTION "public"."rechazar_si_suspendido"();

DROP TRIGGER IF EXISTS "trg_no_suspendido_mensajes" ON "public"."mensajes";
CREATE TRIGGER "trg_no_suspendido_mensajes"
  BEFORE INSERT ON "public"."mensajes"
  FOR EACH ROW EXECUTE FUNCTION "public"."rechazar_si_suspendido"();

DROP TRIGGER IF EXISTS "trg_no_suspendido_partidos" ON "public"."partidos";
CREATE TRIGGER "trg_no_suspendido_partidos"
  BEFORE INSERT ON "public"."partidos"
  FOR EACH ROW EXECUTE FUNCTION "public"."rechazar_si_suspendido"();
