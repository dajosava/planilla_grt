begin;
create function public.delete_employee(p_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 perform 1 from public.employees where id=p_id for update;
 if not found then raise exception 'Empleado no encontrado';end if;
 -- Labor and payroll records must be retained, so only employees without history can be removed.
 if exists(select 1 from public.attendance_sessions where employee_id=p_id)
 or exists(select 1 from public.attendance_events where employee_id=p_id)
 or exists(select 1 from public.shifts where employee_id=p_id)
 or exists(select 1 from public.absences where employee_id=p_id)
 or exists(select 1 from public.vacation_movements where employee_id=p_id)
 or exists(select 1 from public.payroll_items where employee_id=p_id) then
 raise exception 'El empleado tiene marcas, turnos, ausencias o planillas registradas. Desactívalo en lugar de eliminarlo para conservar su historial.';
 end if;
 delete from public.employee_secrets where employee_id=p_id;
 delete from public.employees where id=p_id;
 end;
$$;
revoke execute on function public.delete_employee(uuid) from public,anon;
grant execute on function public.delete_employee(uuid) to authenticated;
commit;
