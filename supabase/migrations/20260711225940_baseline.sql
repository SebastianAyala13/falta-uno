


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_ajuste_saldo"("p_cancha" "uuid", "p_monto" integer, "p_desc" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  insert into public.movimientos_cancha (cancha_id, tipo, monto, descripcion)
  values (p_cancha, 'ajuste', p_monto, coalesce(p_desc, 'Ajuste manual (admin)'));
end $$;


ALTER FUNCTION "public"."admin_ajuste_saldo"("p_cancha" "uuid", "p_monto" integer, "p_desc" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_procesar_retiro"("p_retiro" "uuid", "p_estado" "text", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r public.retiros%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('pagado','rechazado') then raise exception 'Estado inválido'; end if;
  select * into r from public.retiros where id = p_retiro for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if r.estado not in ('solicitado','procesando') then raise exception 'El retiro ya fue procesado'; end if;

  update public.retiros
    set estado = p_estado,
        motivo_rechazo = case when p_estado = 'rechazado' then p_motivo else null end,
        procesado_at = now()
    where id = p_retiro;

  if p_estado = 'pagado' then
    insert into public.movimientos_cancha (cancha_id, tipo, monto, retiro_id, descripcion)
    values (r.cancha_id, 'retiro', -abs(r.monto), r.id, 'Retiro procesado por admin');
  end if;
end $$;


ALTER FUNCTION "public"."admin_procesar_retiro"("p_retiro" "uuid", "p_estado" "text", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_estado_cancha"("p_cancha" "uuid", "p_estado" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_estado not in ('activa','pausada') then raise exception 'Estado inválido'; end if;
  update public.canchas set estado = p_estado where id = p_cancha;
end $$;


ALTER FUNCTION "public"."admin_set_estado_cancha"("p_cancha" "uuid", "p_estado" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_autor_datos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare p record;
begin
  select nombre, avatar_url into p from public.profiles where id = new.autor_id;
  if p.nombre is not null then
    new.autor_nombre := p.nombre;
    if tg_table_name = 'posts' then
      new.autor_avatar := p.avatar_url;
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."fn_set_autor_datos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_cupos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform 1 from public.partidos where id = new.partido_id and cupos_ocupados >= cupos_totales;
    if found then
      raise exception 'El partido ya está lleno';
    end if;
    update public.partidos set cupos_ocupados = cupos_ocupados + 1 where id = new.partido_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.partidos set cupos_ocupados = greatest(0, cupos_ocupados - 1) where id = old.partido_id;
    return old;
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."fn_sync_cupos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and 'admin' = any(p.roles)
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."saldo_cancha"("p_cancha" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(m.monto), 0)::int
  from public.movimientos_cancha m
  where m.cancha_id = p_cancha
    and exists (select 1 from public.canchas c where c.id = p_cancha and c.owner_id = auth.uid());
$$;


ALTER FUNCTION "public"."saldo_cancha"("p_cancha" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bloqueos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "bloqueado_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bloqueos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partido_id" "uuid" NOT NULL,
    "autor_id" "uuid" NOT NULL,
    "estrellas" integer NOT NULL,
    "organizador_estrellas" integer NOT NULL,
    "hubo_no_show" boolean DEFAULT false NOT NULL,
    "comentario" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "calificaciones_estrellas_check" CHECK ((("estrellas" >= 1) AND ("estrellas" <= 5))),
    CONSTRAINT "calificaciones_organizador_estrellas_check" CHECK ((("organizador_estrellas" >= 1) AND ("organizador_estrellas" <= 5)))
);


ALTER TABLE "public"."calificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancha_disponibilidad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cancha_id" "uuid" NOT NULL,
    "dia_semana" integer NOT NULL,
    "hora_apertura" time without time zone NOT NULL,
    "hora_cierre" time without time zone NOT NULL,
    "duracion_min" integer DEFAULT 60 NOT NULL,
    "precio" integer DEFAULT 0 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cancha_disponibilidad_dia_semana_check" CHECK ((("dia_semana" >= 0) AND ("dia_semana" <= 6)))
);


ALTER TABLE "public"."cancha_disponibilidad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canchas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "direccion" "text" NOT NULL,
    "zona" "text" NOT NULL,
    "ciudad" "text" DEFAULT 'Pereira'::"text" NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "descripcion" "text",
    "telefono" "text",
    "formatos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "amenidades" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fotos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "foto_portada" "text",
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "comision_pct" numeric DEFAULT 0.10 NOT NULL,
    "mp_account_ref" "text",
    "legal_version" "text",
    "legal_aceptado_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "canchas_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'pausada'::"text"])))
);


ALTER TABLE "public"."canchas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comentarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "autor_id" "uuid" NOT NULL,
    "autor_nombre" "text" NOT NULL,
    "texto" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comentarios_texto_len" CHECK (("char_length"("texto") <= 500))
);


ALTER TABLE "public"."comentarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."datos_desembolso" (
    "owner_id" "uuid" NOT NULL,
    "banco" "text" NOT NULL,
    "tipo_cuenta" "text" NOT NULL,
    "numero" "text" NOT NULL,
    "titular" "text" NOT NULL,
    "documento" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "datos_desembolso_tipo_cuenta_check" CHECK (("tipo_cuenta" = ANY (ARRAY['ahorros'::"text", 'corriente'::"text", 'nequi'::"text", 'daviplata'::"text"])))
);


ALTER TABLE "public"."datos_desembolso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membresias_cancha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cancha_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'mensual'::"text" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "vigente_hasta" "date",
    "mp_preapproval_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "membresias_cancha_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'vencida'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."membresias_cancha" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mensajes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partido_id" "uuid" NOT NULL,
    "autor_id" "uuid" NOT NULL,
    "autor_nombre" "text" NOT NULL,
    "texto" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mensajes_texto_len" CHECK (("char_length"("texto") <= 500))
);


ALTER TABLE "public"."mensajes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos_cancha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cancha_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "monto" integer NOT NULL,
    "reserva_id" "uuid",
    "retiro_id" "uuid",
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimientos_cancha_tipo_check" CHECK (("tipo" = ANY (ARRAY['ingreso_reserva'::"text", 'comision'::"text", 'retiro'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."movimientos_cancha" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partido_id" "uuid" NOT NULL,
    "jugador_id" "uuid" NOT NULL,
    "medio" "text" NOT NULL,
    "monto" integer NOT NULL,
    "comision" integer DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "referencia" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pagos_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aprobado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "pagos_medio_check" CHECK (("medio" = ANY (ARRAY['nequi'::"text", 'pse'::"text", 'tarjeta'::"text", 'efectivo'::"text", 'online'::"text"])))
);


ALTER TABLE "public"."pagos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partido_jugadores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partido_id" "uuid" NOT NULL,
    "jugador_id" "uuid" NOT NULL,
    "posicion" "text" NOT NULL,
    "confirmado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "partido_jugadores_posicion_check" CHECK (("posicion" = ANY (ARRAY['Portero'::"text", 'Defensa'::"text", 'Mediocampista'::"text", 'Delantero'::"text"])))
);


ALTER TABLE "public"."partido_jugadores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizador_id" "uuid" NOT NULL,
    "cancha" "text" NOT NULL,
    "zona" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "hora" time without time zone NOT NULL,
    "formato" "text" NOT NULL,
    "nivel" "text" NOT NULL,
    "precio" integer DEFAULT 0 NOT NULL,
    "cupos_totales" integer NOT NULL,
    "cupos_ocupados" integer DEFAULT 1 NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "foto_url" "text",
    CONSTRAINT "partidos_formato_check" CHECK (("formato" = ANY (ARRAY['5v5'::"text", '7v7'::"text", '11v11'::"text"]))),
    CONSTRAINT "partidos_nivel_check" CHECK (("nivel" = ANY (ARRAY['Casual'::"text", 'Intermedio'::"text", 'Competitivo'::"text"])))
);


ALTER TABLE "public"."partidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text" NOT NULL,
    "ciudad" "text" DEFAULT 'Pereira'::"text" NOT NULL,
    "posicion" "text" NOT NULL,
    "nivel" "text" NOT NULL,
    "celular" "text",
    "avatar_url" "text",
    "partidos_jugados" integer DEFAULT 0 NOT NULL,
    "no_shows" integer DEFAULT 0 NOT NULL,
    "rating" numeric(2,1) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "politica_version" "text",
    "politica_aceptada_at" timestamp with time zone,
    "roles" "text"[] DEFAULT '{jugador}'::"text"[] NOT NULL,
    CONSTRAINT "profiles_nivel_check" CHECK (("nivel" = ANY (ARRAY['Casual'::"text", 'Intermedio'::"text", 'Competitivo'::"text"]))),
    CONSTRAINT "profiles_posicion_check" CHECK (("posicion" = ANY (ARRAY['Portero'::"text", 'Defensa'::"text", 'Mediocampista'::"text", 'Delantero'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."perfiles_publicos" AS
 SELECT "id",
    "nombre",
    "avatar_url",
    "posicion",
    "nivel",
    "rating"
   FROM "public"."profiles";


ALTER VIEW "public"."perfiles_publicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "autor_id" "uuid",
    "autor_nombre" "text" NOT NULL,
    "autor_avatar" "text",
    "texto" "text" NOT NULL,
    "foto_url" "text",
    "partido_id" "uuid",
    "likes" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "posts_texto_len" CHECK (("char_length"("texto") <= 1000)),
    CONSTRAINT "posts_tipo_check" CHECK (("tipo" = ANY (ARRAY['recap'::"text", 'encuentro'::"text", 'pregunta'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reportes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "contenido_id" "text" NOT NULL,
    "autor_id" "uuid",
    "reportado_por" "uuid" NOT NULL,
    "motivo" "text" NOT NULL,
    "texto" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reportes_motivo_check" CHECK (("motivo" = ANY (ARRAY['spam'::"text", 'acoso'::"text", 'sexual'::"text", 'odio'::"text", 'otro'::"text"]))),
    CONSTRAINT "reportes_tipo_check" CHECK (("tipo" = ANY (ARRAY['post'::"text", 'comentario'::"text", 'mensaje'::"text"])))
);


ALTER TABLE "public"."reportes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cancha_id" "uuid" NOT NULL,
    "jugador_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fin" time without time zone NOT NULL,
    "precio" integer NOT NULL,
    "comision" integer DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "medio" "text" DEFAULT 'efectivo'::"text" NOT NULL,
    "pago_id" "uuid",
    "partido_id" "uuid",
    "referencia" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservas_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'confirmada'::"text", 'cancelada'::"text", 'completada'::"text"])))
);


ALTER TABLE "public"."reservas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."retiros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cancha_id" "uuid" NOT NULL,
    "monto" integer NOT NULL,
    "estado" "text" DEFAULT 'solicitado'::"text" NOT NULL,
    "mp_payout_ref" "text",
    "motivo_rechazo" "text",
    "solicitado_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "procesado_at" timestamp with time zone,
    CONSTRAINT "retiros_estado_check" CHECK (("estado" = ANY (ARRAY['solicitado'::"text", 'procesando'::"text", 'pagado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "retiros_monto_check" CHECK (("monto" > 0))
);


ALTER TABLE "public"."retiros" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bloqueos"
    ADD CONSTRAINT "bloqueos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bloqueos"
    ADD CONSTRAINT "bloqueos_usuario_id_bloqueado_id_key" UNIQUE ("usuario_id", "bloqueado_id");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_partido_id_autor_id_key" UNIQUE ("partido_id", "autor_id");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancha_disponibilidad"
    ADD CONSTRAINT "cancha_disponibilidad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canchas"
    ADD CONSTRAINT "canchas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comentarios"
    ADD CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."datos_desembolso"
    ADD CONSTRAINT "datos_desembolso_pkey" PRIMARY KEY ("owner_id");



ALTER TABLE ONLY "public"."membresias_cancha"
    ADD CONSTRAINT "membresias_cancha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos_cancha"
    ADD CONSTRAINT "movimientos_cancha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partido_jugadores"
    ADD CONSTRAINT "partido_jugadores_partido_id_jugador_id_key" UNIQUE ("partido_id", "jugador_id");



ALTER TABLE ONLY "public"."partido_jugadores"
    ADD CONSTRAINT "partido_jugadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_cancha_id_fecha_hora_inicio_key" UNIQUE ("cancha_id", "fecha", "hora_inicio");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retiros"
    ADD CONSTRAINT "retiros_pkey" PRIMARY KEY ("id");



CREATE INDEX "disp_cancha_idx" ON "public"."cancha_disponibilidad" USING "btree" ("cancha_id", "dia_semana");



CREATE INDEX "memb_cancha_idx" ON "public"."membresias_cancha" USING "btree" ("cancha_id");



CREATE INDEX "mensajes_partido_idx" ON "public"."mensajes" USING "btree" ("partido_id", "created_at");



CREATE INDEX "mov_cancha_idx" ON "public"."movimientos_cancha" USING "btree" ("cancha_id", "created_at" DESC);



CREATE UNIQUE INDEX "pagos_referencia_unica" ON "public"."pagos" USING "btree" ("referencia");



CREATE INDEX "reportes_created_idx" ON "public"."reportes" USING "btree" ("created_at" DESC);



CREATE INDEX "reservas_cancha_fecha_idx" ON "public"."reservas" USING "btree" ("cancha_id", "fecha");



CREATE INDEX "reservas_jugador_idx" ON "public"."reservas" USING "btree" ("jugador_id", "created_at" DESC);



CREATE INDEX "retiros_cancha_idx" ON "public"."retiros" USING "btree" ("cancha_id", "solicitado_at" DESC);



CREATE OR REPLACE TRIGGER "trg_autor_comentarios" BEFORE INSERT ON "public"."comentarios" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_autor_datos"();



CREATE OR REPLACE TRIGGER "trg_autor_mensajes" BEFORE INSERT ON "public"."mensajes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_autor_datos"();



CREATE OR REPLACE TRIGGER "trg_autor_posts" BEFORE INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_autor_datos"();



CREATE OR REPLACE TRIGGER "trg_cupos_del" AFTER DELETE ON "public"."partido_jugadores" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_cupos"();



CREATE OR REPLACE TRIGGER "trg_cupos_ins" AFTER INSERT ON "public"."partido_jugadores" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_cupos"();



ALTER TABLE ONLY "public"."bloqueos"
    ADD CONSTRAINT "bloqueos_bloqueado_id_fkey" FOREIGN KEY ("bloqueado_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bloqueos"
    ADD CONSTRAINT "bloqueos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cancha_disponibilidad"
    ADD CONSTRAINT "cancha_disponibilidad_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."canchas"
    ADD CONSTRAINT "canchas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios"
    ADD CONSTRAINT "comentarios_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comentarios"
    ADD CONSTRAINT "comentarios_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."datos_desembolso"
    ADD CONSTRAINT "datos_desembolso_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresias_cancha"
    ADD CONSTRAINT "membresias_cancha_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensajes"
    ADD CONSTRAINT "mensajes_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimientos_cancha"
    ADD CONSTRAINT "movimientos_cancha_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimientos_cancha"
    ADD CONSTRAINT "movimientos_cancha_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partido_jugadores"
    ADD CONSTRAINT "partido_jugadores_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partido_jugadores"
    ADD CONSTRAINT "partido_jugadores_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_organizador_id_fkey" FOREIGN KEY ("organizador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reportes"
    ADD CONSTRAINT "reportes_reportado_por_fkey" FOREIGN KEY ("reportado_por") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."retiros"
    ADD CONSTRAINT "retiros_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE CASCADE;



CREATE POLICY "admin_lee_membresias" ON "public"."membresias_cancha" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_movimientos" ON "public"."movimientos_cancha" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_pagos" ON "public"."pagos" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_reportes" ON "public"."reportes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_reservas" ON "public"."reservas" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admin_lee_retiros" ON "public"."retiros" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."bloqueos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bloqueos_delete" ON "public"."bloqueos" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "bloqueos_insert" ON "public"."bloqueos" FOR INSERT WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "bloqueos_lectura" ON "public"."bloqueos" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



ALTER TABLE "public"."calificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calificaciones_insert" ON "public"."calificaciones" FOR INSERT WITH CHECK ((("auth"."uid"() = "autor_id") AND (EXISTS ( SELECT 1
   FROM "public"."partido_jugadores" "pj"
  WHERE (("pj"."partido_id" = "calificaciones"."partido_id") AND ("pj"."jugador_id" = "auth"."uid"()))))));



CREATE POLICY "calificaciones_lectura" ON "public"."calificaciones" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."cancha_disponibilidad" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."canchas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "canchas_delete" ON "public"."canchas" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "canchas_insert" ON "public"."canchas" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "canchas_lectura" ON "public"."canchas" FOR SELECT USING (true);



CREATE POLICY "canchas_update" ON "public"."canchas" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."comentarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comentarios_insert" ON "public"."comentarios" FOR INSERT WITH CHECK (("auth"."uid"() = "autor_id"));



CREATE POLICY "comentarios_lectura" ON "public"."comentarios" FOR SELECT USING (true);



ALTER TABLE "public"."datos_desembolso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "desembolso_admin_lee" ON "public"."datos_desembolso" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "desembolso_dueno" ON "public"."datos_desembolso" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "disp_escritura" ON "public"."cancha_disponibilidad" USING ((EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "cancha_disponibilidad"."cancha_id") AND ("c"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "cancha_disponibilidad"."cancha_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "disp_lectura" ON "public"."cancha_disponibilidad" FOR SELECT USING (true);



CREATE POLICY "inscripciones_delete" ON "public"."partido_jugadores" FOR DELETE USING (("auth"."uid"() = "jugador_id"));



CREATE POLICY "inscripciones_insert" ON "public"."partido_jugadores" FOR INSERT WITH CHECK (("auth"."uid"() = "jugador_id"));



CREATE POLICY "inscripciones_lectura" ON "public"."partido_jugadores" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "likes_delete" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_insert" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_lectura" ON "public"."post_likes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."membresias_cancha" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membresias_lectura" ON "public"."membresias_cancha" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "membresias_cancha"."cancha_id") AND ("c"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."mensajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mensajes_insert" ON "public"."mensajes" FOR INSERT WITH CHECK (("auth"."uid"() = "autor_id"));



CREATE POLICY "mensajes_lectura" ON "public"."mensajes" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."partido_jugadores" "pj"
  WHERE (("pj"."partido_id" = "mensajes"."partido_id") AND ("pj"."jugador_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."partidos" "p"
  WHERE (("p"."id" = "mensajes"."partido_id") AND ("p"."organizador_id" = "auth"."uid"()))))));



ALTER TABLE "public"."movimientos_cancha" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimientos_lectura" ON "public"."movimientos_cancha" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "movimientos_cancha"."cancha_id") AND ("c"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagos_insert" ON "public"."pagos" FOR INSERT WITH CHECK ((("auth"."uid"() = "jugador_id") AND ("estado" = 'pendiente'::"text")));



CREATE POLICY "pagos_lectura" ON "public"."pagos" FOR SELECT USING (("auth"."uid"() = "jugador_id"));



ALTER TABLE "public"."partido_jugadores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partidos_delete" ON "public"."partidos" FOR DELETE USING (("auth"."uid"() = "organizador_id"));



CREATE POLICY "partidos_insert" ON "public"."partidos" FOR INSERT WITH CHECK (("auth"."uid"() = "organizador_id"));



CREATE POLICY "partidos_lectura" ON "public"."partidos" FOR SELECT USING (true);



CREATE POLICY "partidos_update" ON "public"."partidos" FOR UPDATE USING (("auth"."uid"() = "organizador_id"));



CREATE POLICY "perfiles_lectura_propia" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "perfiles_propio_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "perfiles_propio_update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "autor_id"));



CREATE POLICY "posts_insert" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "autor_id"));



CREATE POLICY "posts_lectura" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "posts_update" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "autor_id")) WITH CHECK (("auth"."uid"() = "autor_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reportes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reportes_insert" ON "public"."reportes" FOR INSERT WITH CHECK (("auth"."uid"() = "reportado_por"));



ALTER TABLE "public"."reservas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservas_insert" ON "public"."reservas" FOR INSERT WITH CHECK ((("auth"."uid"() = "jugador_id") AND ("estado" = ANY (ARRAY['pendiente'::"text", 'confirmada'::"text"]))));



CREATE POLICY "reservas_lectura" ON "public"."reservas" FOR SELECT USING ((("auth"."uid"() = "jugador_id") OR (EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "reservas"."cancha_id") AND ("c"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "reservas_update_dueno" ON "public"."reservas" FOR UPDATE USING ((("auth"."uid"() = "jugador_id") OR (EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "reservas"."cancha_id") AND ("c"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."retiros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "retiros_insert" ON "public"."retiros" FOR INSERT WITH CHECK ((("estado" = 'solicitado'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "retiros"."cancha_id") AND ("c"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "retiros_lectura" ON "public"."retiros" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."canchas" "c"
  WHERE (("c"."id" = "retiros"."cancha_id") AND ("c"."owner_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comentarios";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mensajes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."posts";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_ajuste_saldo"("p_cancha" "uuid", "p_monto" integer, "p_desc" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_ajuste_saldo"("p_cancha" "uuid", "p_monto" integer, "p_desc" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_ajuste_saldo"("p_cancha" "uuid", "p_monto" integer, "p_desc" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_procesar_retiro"("p_retiro" "uuid", "p_estado" "text", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_procesar_retiro"("p_retiro" "uuid", "p_estado" "text", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_procesar_retiro"("p_retiro" "uuid", "p_estado" "text", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_estado_cancha"("p_cancha" "uuid", "p_estado" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_estado_cancha"("p_cancha" "uuid", "p_estado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_estado_cancha"("p_cancha" "uuid", "p_estado" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_autor_datos"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_autor_datos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_autor_datos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sync_cupos"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sync_cupos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sync_cupos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."saldo_cancha"("p_cancha" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."saldo_cancha"("p_cancha" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."saldo_cancha"("p_cancha" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."bloqueos" TO "anon";
GRANT ALL ON TABLE "public"."bloqueos" TO "authenticated";
GRANT ALL ON TABLE "public"."bloqueos" TO "service_role";



GRANT ALL ON TABLE "public"."calificaciones" TO "anon";
GRANT ALL ON TABLE "public"."calificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."calificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."cancha_disponibilidad" TO "anon";
GRANT ALL ON TABLE "public"."cancha_disponibilidad" TO "authenticated";
GRANT ALL ON TABLE "public"."cancha_disponibilidad" TO "service_role";



GRANT ALL ON TABLE "public"."canchas" TO "anon";
GRANT ALL ON TABLE "public"."canchas" TO "authenticated";
GRANT ALL ON TABLE "public"."canchas" TO "service_role";



GRANT ALL ON TABLE "public"."comentarios" TO "anon";
GRANT ALL ON TABLE "public"."comentarios" TO "authenticated";
GRANT ALL ON TABLE "public"."comentarios" TO "service_role";



GRANT ALL ON TABLE "public"."datos_desembolso" TO "anon";
GRANT ALL ON TABLE "public"."datos_desembolso" TO "authenticated";
GRANT ALL ON TABLE "public"."datos_desembolso" TO "service_role";



GRANT ALL ON TABLE "public"."membresias_cancha" TO "anon";
GRANT ALL ON TABLE "public"."membresias_cancha" TO "authenticated";
GRANT ALL ON TABLE "public"."membresias_cancha" TO "service_role";



GRANT ALL ON TABLE "public"."mensajes" TO "anon";
GRANT ALL ON TABLE "public"."mensajes" TO "authenticated";
GRANT ALL ON TABLE "public"."mensajes" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_cancha" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_cancha" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_cancha" TO "service_role";



GRANT ALL ON TABLE "public"."pagos" TO "anon";
GRANT ALL ON TABLE "public"."pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos" TO "service_role";



GRANT ALL ON TABLE "public"."partido_jugadores" TO "anon";
GRANT ALL ON TABLE "public"."partido_jugadores" TO "authenticated";
GRANT ALL ON TABLE "public"."partido_jugadores" TO "service_role";



GRANT ALL ON TABLE "public"."partidos" TO "anon";
GRANT ALL ON TABLE "public"."partidos" TO "authenticated";
GRANT ALL ON TABLE "public"."partidos" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("nombre") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("ciudad") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("posicion") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("nivel") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("celular") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("politica_version") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("politica_aceptada_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("roles") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."perfiles_publicos" TO "anon";
GRANT ALL ON TABLE "public"."perfiles_publicos" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles_publicos" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."reportes" TO "anon";
GRANT ALL ON TABLE "public"."reportes" TO "authenticated";
GRANT ALL ON TABLE "public"."reportes" TO "service_role";



GRANT ALL ON TABLE "public"."reservas" TO "anon";
GRANT ALL ON TABLE "public"."reservas" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas" TO "service_role";



GRANT ALL ON TABLE "public"."retiros" TO "anon";
GRANT ALL ON TABLE "public"."retiros" TO "authenticated";
GRANT ALL ON TABLE "public"."retiros" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































