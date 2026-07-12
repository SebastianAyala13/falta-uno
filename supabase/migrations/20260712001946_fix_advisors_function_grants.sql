-- Advisors 0028/0029: funciones SECURITY DEFINER ejecutables por anon/authenticated vía RPC.
-- Sacamos EXECUTE a los roles del API donde no corresponde.
--
-- Nota clave: en Postgres las funciones tienen EXECUTE para PUBLIC por defecto, así que hay que
-- revocar también de PUBLIC (si no, anon/authenticated lo heredan por ser miembros de PUBLIC).
-- service_role conserva su GRANT explícito (del baseline) en todos los casos; los triggers y las
-- funciones DEFINER que llamen a otras no dependen del EXECUTE del rol del API.
--
-- is_admin() NO se toca: lo usan varias policies (admin_lee_*); revocar EXECUTE rompería la
-- evaluación de RLS para anon/authenticated. Su warning queda como aceptado/intencional.

-- 1) Funciones de TRIGGER / EVENT TRIGGER: nunca se invocan por RPC.
revoke execute on function public.fn_guard_roles() from anon, authenticated, public;
revoke execute on function public.fn_set_autor_datos() from anon, authenticated, public;
revoke execute on function public.fn_sync_cupos() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- 2) Funciones admin (revalidan is_admin() adentro). La app las llama SOLO como admin
--    autenticado (lib/admin.ts vía .rpc), nunca anon → sacamos anon + PUBLIC, mantenemos el
--    grant explícito de authenticated (su warning 0029 queda intencional: el panel las necesita).
revoke execute on function public.admin_ajuste_saldo(uuid, integer, text) from anon, public;
revoke execute on function public.admin_procesar_retiro(uuid, text, text) from anon, public;
revoke execute on function public.admin_set_estado_cancha(uuid, text) from anon, public;

-- 3) saldo_cancha: la app calcula el saldo del lado cliente (suma movimientos_cancha), no la
--    llama por RPC, y no se usa en policies.
revoke execute on function public.saldo_cancha(uuid) from anon, authenticated, public;
