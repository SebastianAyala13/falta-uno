begin;
-- Rechazar intentos de acreditarse online en lugar de normalizarlos en silencio.
-- Efectivo confirmado significa reserva del horario, no dinero acreditado.
create or replace function public.fn_rechazar_confirmacion_cliente() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() in ('anon','authenticated') and new.medio='online' and new.estado<>'pendiente' then
    raise exception 'Un pago online sólo lo confirma el servidor' using errcode='42501';
  end if;
  return new;
end $$;
create trigger trg_00_rechazar_confirmacion_cliente before insert on public.reservas
for each row execute function public.fn_rechazar_confirmacion_cliente();
revoke all on function public.fn_rechazar_confirmacion_cliente() from public,anon,authenticated;
-- Sin policy, UPDATE podía "tener éxito" afectando cero filas; además de RLS,
-- revocar la operación evita respuestas ambiguas e impide futuras policies laxas.
revoke update,delete on public.pagos,public.retiros from anon,authenticated;
commit;
