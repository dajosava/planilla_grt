begin;
alter table public.employees add column if not exists hired_on date;
update public.employees
 set hired_on=(created_at at time zone 'America/Costa_Rica')::date
 where hired_on is null;
alter table public.employees alter column hired_on set not null;
alter table public.employees drop constraint if exists employees_hired_on_check;
alter table public.employees add constraint employees_hired_on_check
 check(hired_on>='1950-01-01' and hired_on<=(timezone('America/Costa_Rica',now()))::date);

drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric);
drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric,date);
create function public.create_employee(p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric,p_hired_on date)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{6,8}$' then raise exception 'PIN debe tener de 6 a 8 dígitos';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance,hired_on)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation,p_hired_on) returning id into eid;
 insert into public.employee_secrets values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 if p_vacation>0 then insert into public.vacation_movements(employee_id,days,reason) values(eid,p_vacation,'Saldo inicial validado por administrador');end if;
 return eid;
 end;
$$;
revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date) to authenticated;

drop function if exists public.update_employee(uuid,text,text,text,bigint);
drop function if exists public.update_employee(uuid,text,text,text,bigint,date);
create function public.update_employee(p_id uuid,p_name text,p_department text,p_position text,p_salary bigint,p_hired_on date)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 update public.employees
  set full_name=p_name,department=p_department,position=p_position,monthly_salary_cents=p_salary,hired_on=p_hired_on
  where id=p_id;
 if not found then raise exception 'Empleado no encontrado';end if;
 end;
$$;
revoke execute on function public.update_employee(uuid,text,text,text,bigint,date) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint,date) to authenticated;
commit;
