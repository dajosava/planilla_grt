begin;
-- Tres sociedades (planillas separadas): Gasolinera, Supermercado, Transporte.

-- 1) Quitar check viejo ANTES de migrar valores (Gasolinera no existía en el enum anterior)
do $$
declare r record;
begin
 for r in
  select c.conname
  from pg_constraint c
  where c.conrelid='public.employees'::regclass and c.contype='c'
    and pg_get_constraintdef(c.oid) ilike '%department%'
 loop
  execute format('alter table public.employees drop constraint %I', r.conname);
 end loop;
end $$;

-- 2) Migrar áreas antiguas → sociedades
update public.employees set department = case
 when department in ('Pista','Administración','Tienda','Gasolinera') then 'Gasolinera'
 when department = 'Supermercado' then 'Supermercado'
 when department = 'Transporte' then 'Transporte'
 else 'Gasolinera'
end;

-- 3) Nuevo check
alter table public.employees
 add constraint employees_department_check
 check (department in ('Gasolinera','Supermercado','Transporte'));

-- Planilla por sociedad
alter table public.payroll_runs
 add column if not exists company text;

update public.payroll_runs set company='Gasolinera' where company is null;
alter table public.payroll_runs alter column company set default 'Gasolinera';
alter table public.payroll_runs alter column company set not null;

do $$
declare r record;
begin
 -- period_start ya no puede ser único solo: misma quincena × 3 sociedades
 for r in
  select c.conname
  from pg_constraint c
  where c.conrelid='public.payroll_runs'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) ilike '%period_start%'
    and pg_get_constraintdef(c.oid) not ilike '%company%'
 loop
  execute format('alter table public.payroll_runs drop constraint %I', r.conname);
 end loop;
end $$;

do $$ begin
 if not exists(select 1 from pg_constraint where conname='payroll_runs_company_check') then
  alter table public.payroll_runs
   add constraint payroll_runs_company_check
   check (company in ('Gasolinera','Supermercado','Transporte'));
 end if;
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_company_unique') then
  alter table public.payroll_runs
   add constraint payroll_runs_period_company_unique unique (period_start, company);
 end if;
end $$;

-- Validar sociedad al crear/actualizar empleado
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
 insert into public.employee_secrets(employee_id,pin_hash) values(eid,crypt(p_pin,gen_salt('bf')));
 return eid;
 end;
$$;

create or replace function public.update_employee(
 p_id uuid,p_name text,p_department text,p_position text,p_salary bigint,p_hired_on date,p_cedula text,p_email text,
 p_hours_month numeric default 243.36,p_exempt_ccss boolean default false
) returns void language plpgsql security definer set search_path='' as $$
 declare v_cedula text; v_email text; v_hours numeric;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_department not in ('Gasolinera','Supermercado','Transporte') then
  raise exception 'La sociedad debe ser Gasolinera, Supermercado o Transporte';
 end if;
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
 update public.employees
  set full_name=p_name,department=p_department,position=p_position,monthly_salary_cents=p_salary,
      hired_on=p_hired_on,cedula=v_cedula,email=v_email,hours_per_month=v_hours,exempt_from_ccss=coalesce(p_exempt_ccss,false)
 where id=p_id;
 if not found then raise exception 'Empleado no encontrado';end if;
 end;
$$;

-- Quincena por sociedad: solo empleados de esa área
create or replace function public.create_payroll_fortnight(p_month date, p_half int, p_company text)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid; v_start date; v_end date; v_last int; n int;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_company not in ('Gasolinera','Supermercado','Transporte') then
  raise exception 'La planilla debe ser de Gasolinera, Supermercado o Transporte';
 end if;
 if p_half not in (1,2) then raise exception 'La quincena debe ser 1 (1–15) o 2 (16–fin)';end if;
 if p_month <> date_trunc('month',p_month)::date then raise exception 'Indica el primer día del mes';end if;
 v_last := extract(day from (p_month + interval '1 month' - interval '1 day'))::int;
 if p_half = 1 then
  v_start := p_month;
  v_end := p_month + 14;
 else
  v_start := p_month + 15;
  v_end := (p_month + (v_last - 1) * interval '1 day')::date;
 end if;
 insert into public.payroll_runs(period_start,period_end,kind,company)
 values(v_start,v_end,'fortnight',p_company) returning id into rid;
 insert into public.payroll_items(
  run_id,employee_id,employee_name,employee_code,employee_email,
  base_cents,hours_month,hourly_rate_cents,double_rate_cents,ccss_cents,exempt_from_ccss,
  addition_cents,deduction_cents
 )
 select
  rid,e.id,e.full_name,e.code,e.email,
  round(e.monthly_salary_cents::numeric/2)::bigint,
  e.hours_per_month,
  public._crc_hourly(e.monthly_salary_cents,e.hours_per_month),
  public._crc_hourly(e.monthly_salary_cents,e.hours_per_month)*2,
  case when e.exempt_from_ccss then 0
       else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint end,
  e.exempt_from_ccss,
  0,
  case when e.exempt_from_ccss then 0
       else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint end
 from public.employees e where e.active and e.department=p_company;
 get diagnostics n = row_count;
 if n = 0 then
  delete from public.payroll_runs where id=rid;
  raise exception 'No hay empleados activos en %', p_company;
 end if;
 return rid;
 end;
$$;

-- Firma anterior (2 args) → error claro si alguien la llama
drop function if exists public.create_payroll_fortnight(date,int);

revoke execute on function public.create_payroll_fortnight(date,int,text) from public,anon;
grant execute on function public.create_payroll_fortnight(date,int,text) to authenticated;
revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) to authenticated;
revoke execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean) to authenticated;

commit;
