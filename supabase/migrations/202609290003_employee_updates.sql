begin;
create function public.update_employee(p_id uuid,p_name text,p_department text,p_position text,p_salary bigint)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 update public.employees set full_name=p_name,department=p_department,position=p_position,monthly_salary_cents=p_salary where id=p_id;
 if not found then raise exception 'Empleado no encontrado';end if;
 -- Existing payroll rows keep their historical salary and identity snapshots.
 end;
$$;
revoke execute on function public.update_employee(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint) to authenticated;
commit;
