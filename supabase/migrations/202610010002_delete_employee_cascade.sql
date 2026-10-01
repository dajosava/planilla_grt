begin;
drop function if exists public.delete_employee(uuid);
create function public.delete_employee(p_id uuid,p_confirm_code text)
 returns void language plpgsql security definer set search_path='' as $$
 declare e public.employees;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select * into e from public.employees where id=p_id for update;
 if e.id is null then raise exception 'Empleado no encontrado';end if;
 if coalesce(p_confirm_code,'')<>e.code then raise exception 'El código de confirmación no coincide con el del empleado.';end if;
 -- Every deleted row is still captured by the audit triggers before it disappears.
 delete from public.attendance_adjustments where session_id in(select id from public.attendance_sessions where employee_id=p_id);
 delete from public.attendance_events where employee_id=p_id;
 delete from public.attendance_sessions where employee_id=p_id;
 delete from public.shifts where employee_id=p_id;
 delete from public.vacation_movements where employee_id=p_id;
 delete from public.absences where employee_id=p_id;
 delete from public.payroll_items where employee_id=p_id;
 delete from public.employee_secrets where employee_id=p_id;
 delete from public.employees where id=p_id;
 end;
$$;
revoke execute on function public.delete_employee(uuid,text) from public,anon;
grant execute on function public.delete_employee(uuid,text) to authenticated;
commit;
