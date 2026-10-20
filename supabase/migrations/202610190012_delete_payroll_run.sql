-- Permite al admin eliminar una quincena (borrador o cerrada) por error.

begin;

create or replace function public.delete_payroll_run(p_id uuid, p_confirm text)
 returns void language plpgsql security definer set search_path='' as $$
 declare r public.payroll_runs;
  expected text;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;

  -- Confirmación: escribir el código de la sociedad (Gasolinera / Supermercado / Transporte)
  expected := upper(trim(coalesce(r.company,'')));
  if upper(trim(coalesce(p_confirm,''))) is distinct from expected then
   raise exception 'Para confirmar, escribí exactamente: %', r.company;
  end if;

  -- OT days → items (cascade) → run
  delete from public.payroll_ot_days
   where item_id in (select id from public.payroll_items where run_id=p_id);
  delete from public.payroll_items where run_id=p_id;
  delete from public.payroll_runs where id=p_id;
 end;
$$;

revoke execute on function public.delete_payroll_run(uuid,text) from public,anon;
grant execute on function public.delete_payroll_run(uuid,text) to authenticated;

commit;
