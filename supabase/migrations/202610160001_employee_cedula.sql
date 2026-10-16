begin;
alter table public.employees add column if not exists cedula text;
update public.employees set cedula=regexp_replace(cedula,'[^0-9]','','g') where cedula is not null;
alter table public.employees drop constraint if exists employees_cedula_format;
alter table public.employees add constraint employees_cedula_format
 check(cedula is null or cedula ~ '^\d{9,12}$');
create unique index if not exists employees_cedula_unique on public.employees(cedula) where cedula is not null;

drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric,date);
create function public.create_employee(p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric,p_hired_on date,p_cedula text)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid; v_cedula text:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{6,8}$' then raise exception 'PIN debe tener de 6 a 8 dígitos';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener de 9 a 12 dígitos';end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance,hired_on,cedula)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation,p_hired_on,v_cedula) returning id into eid;
 insert into public.employee_secrets values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 if p_vacation>0 then insert into public.vacation_movements(employee_id,days,reason) values(eid,p_vacation,'Saldo inicial validado por administrador');end if;
 return eid;
 end;
$$;
revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text) to authenticated;

drop function if exists public.update_employee(uuid,text,text,text,bigint,date);
create function public.update_employee(p_id uuid,p_name text,p_department text,p_position text,p_salary bigint,p_hired_on date,p_cedula text)
 returns void language plpgsql security definer set search_path='' as $$
 declare v_cedula text:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener de 9 a 12 dígitos';end if;
 update public.employees
  set full_name=p_name,department=p_department,position=p_position,monthly_salary_cents=p_salary,hired_on=p_hired_on,cedula=v_cedula
  where id=p_id;
 if not found then raise exception 'Empleado no encontrado';end if;
 end;
$$;
revoke execute on function public.update_employee(uuid,text,text,text,bigint,date,text) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint,date,text) to authenticated;
commit;
