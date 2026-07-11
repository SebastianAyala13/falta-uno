-- Fix de escalada de privilegios (CRÍTICO): impedir que un usuario se auto-asigne el rol 'admin'.
--
-- Contexto del agujero:
--   * `authenticated` tiene GRANT UPDATE("roles") sobre public.profiles (necesario para el
--     flujo legítimo de auto-asignarse el rol 'cancha' al crear su primera cancha —
--     ver app/cancha/editar.tsx).
--   * La policy `perfiles_propio_update` permite a cada usuario editar su propia fila.
--   * `is_admin()` deriva el admin de public.profiles.roles ('admin' = any(roles)).
--   => Sin guard, cualquier usuario autenticado (incluso con solo la anon key pública) podía:
--        update public.profiles set roles = roles || '{admin}' where id = auth.uid();
--      y volverse admin. Escalada de privilegios remota.
--
-- Fix: trigger BEFORE UPDATE OF roles que rechaza cualquier cambio en la pertenencia al rol
-- 'admin' salvo que el que ejecuta sea (a) un admin ya existente, o (b) un contexto de backend
-- sin usuario JWT (service_role o conexión directa/SQL editor → auth.uid() is null). Los cambios
-- a los roles 'jugador'/'cancha' siguen permitidos: el flujo de "volverse dueño de cancha" no se rompe.

create or replace function public.fn_guard_roles()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Solo importa cuando CAMBIA la pertenencia al rol 'admin'.
  if ('admin' = any(new.roles)) is distinct from ('admin' = any(coalesce(old.roles, '{}'::text[]))) then
    -- auth.uid() not null  => usuario autenticado por la API: solo permitido si YA es admin.
    -- auth.uid() is null    => service_role / conexión directa (backend confiable): permitido.
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'No autorizado a modificar el rol admin' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

alter function public.fn_guard_roles() owner to postgres;

drop trigger if exists trg_guard_roles on public.profiles;
create trigger trg_guard_roles
  before update of roles on public.profiles
  for each row
  execute function public.fn_guard_roles();
