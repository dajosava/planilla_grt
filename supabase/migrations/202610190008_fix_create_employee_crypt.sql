-- Fix: create_employee usaba crypt/gen_salt sin schema; con search_path='' fallaba
-- al crear empleados ("No se pudo guardar. Revisa los datos y los permisos").

begin;

create or replace function public.create_employee(
 p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric,
 p_hired_on date,p_cedula text,p_email text,p_hours_month numeric default 243.36,p_exempt_ccss boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid; v_cedula text; v_email text; v_hours numeric;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_department not in ('Gasolinera','Supermercado','Transporte') then
  raise exception 'La sociedad debe ser Gasolinera, Supermercado o Transporte';
 end if;
 if coalesce(p_pin,'') !~ '^\d{4}$' then raise exception 'El PIN debe tener 4 dígitos';end if;
 if p_hired_on is null or p_hired_on > (timezone('America/Costa_Rica',now()))::date then raise exception 'La fecha de ingreso no es válida';end if;
 if p_hired_on < date '1950-01-01' then raise exception 'La fecha de ingreso no es válida';end if;
 v_cedula := regexp_replace(coalesce(p_cedula,''),'\D','','g');
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener entre 9 y 12 dígitos';end if;
 v_email := lower(trim(coalesce(p_email,'')));
 if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' or length(v_email)>254 then
  raise exception 'El correo electrónico no es válido';
 end if;
 v_hours := coalesce(p_hours_month,243.36);
 if v_hours < 1 or v_hours > 400 then raise exception 'Horas/mes inválidas';end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance,hired_on,cedula,email,hours_per_month,exempt_from_ccss)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation,p_hired_on,v_cedula,v_email,v_hours,coalesce(p_exempt_ccss,false))
 returning id into eid;
 insert into public.employee_secrets(employee_id,pin_hash)
 values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 return eid;
 end;
$$;

revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) to authenticated;

commit;
