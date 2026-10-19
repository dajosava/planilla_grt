begin;

-- Datos de empleado para valor hora y excepción CCSS (Elmer, etc.)
alter table public.employees
  add column if not exists hours_per_month numeric(6,2) not null default 243.36
    check (hours_per_month between 1 and 400),
  add column if not exists exempt_from_ccss boolean not null default false;

-- Corridas: permitir quincenas (1–15 / 16–fin). Quitar checks solo-mensuales.
do $$
declare r record;
begin
 for r in
  select c.conname
  from pg_constraint c
  where c.conrelid='public.payroll_runs'::regclass and c.contype='c'
    and (
     pg_get_constraintdef(c.oid) ilike '%date_trunc%month%'
     or pg_get_constraintdef(c.oid) ilike '%1 month%'
    )
 loop
  execute format('alter table public.payroll_runs drop constraint %I', r.conname);
 end loop;
end $$;

alter table public.payroll_runs
  add column if not exists kind text;

update public.payroll_runs set kind='monthly' where kind is null;
alter table public.payroll_runs alter column kind set default 'fortnight';
alter table public.payroll_runs alter column kind set not null;

do $$ begin
 if not exists(select 1 from pg_constraint where conname='payroll_runs_kind_check') then
  alter table public.payroll_runs add constraint payroll_runs_kind_check check (kind in ('fortnight','monthly'));
 end if;
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_order') then
  alter table public.payroll_runs add constraint payroll_runs_period_order check (period_end >= period_start);
 end if;
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_span') then
  alter table public.payroll_runs add constraint payroll_runs_period_span check (period_end <= period_start + 31);
 end if;
end $$;

-- Desglose de conceptos quincenales (Excel GRT)
alter table public.payroll_items
  add column if not exists hours_month numeric(6,2) not null default 243.36,
  add column if not exists hourly_rate_cents bigint not null default 0 check (hourly_rate_cents between 0 and 10000000000),
  add column if not exists ot_hours numeric(6,2) not null default 0 check (ot_hours between 0 and 400),
  add column if not exists ot_amount_cents bigint not null default 0 check (ot_amount_cents between 0 and 10000000000),
  add column if not exists double_hours numeric(6,2) not null default 0 check (double_hours between 0 and 400),
  add column if not exists double_rate_cents bigint not null default 0 check (double_rate_cents between 0 and 10000000000),
  add column if not exists double_amount_cents bigint not null default 0 check (double_amount_cents between 0 and 10000000000),
  add column if not exists other_pay_cents bigint not null default 0 check (other_pay_cents between 0 and 10000000000),
  add column if not exists ccss_cents bigint not null default 0 check (ccss_cents between 0 and 10000000000),
  add column if not exists shortage_cents bigint not null default 0 check (shortage_cents between 0 and 10000000000),
  add column if not exists receipt_cents bigint not null default 0 check (receipt_cents between 0 and 10000000000),
  add column if not exists other_deduction_cents bigint not null default 0 check (other_deduction_cents between 0 and 10000000000),
  add column if not exists exempt_from_ccss boolean not null default false;

create or replace function public.guard_payroll_close() returns trigger language plpgsql set search_path='' as $$
 begin
 if NEW.status='closed' and OLD.status<>'closed' and
  clock_timestamp()<((NEW.period_end+1)::timestamp at time zone 'America/Costa_Rica') then
  raise exception 'El período todavía no ha terminado';
 end if;
 return NEW;
 end;
$$;

-- Helpers: redondeo a colón (centavos múltiplo de 100)
create or replace function public._crc_round_colon(p_cents numeric) returns bigint language sql immutable as $$
 select (round(p_cents/100.0)*100)::bigint;
$$;

create or replace function public._crc_hourly(p_salary bigint, p_hours numeric) returns bigint language sql immutable as $$
 select public._crc_round_colon(p_salary::numeric / nullif(p_hours,0));
$$;

-- Empleados: create/update con horas y exención CCSS
drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text);
create function public.create_employee(
 p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric,
 p_hired_on date,p_cedula text,p_email text,p_hours_month numeric default 243.36,p_exempt_ccss boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid; v_cedula text:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_hours numeric:=coalesce(nullif(p_hours_month,0),243.36);
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{4}$' then raise exception 'PIN debe tener 4 dígitos';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener de 9 a 12 dígitos';end if;
 if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Indica un correo electrónico válido';end if;
 if v_hours < 1 or v_hours > 400 then raise exception 'Horas del mes fuera de rango';end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance,hired_on,cedula,email,hours_per_month,exempt_from_ccss)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation,p_hired_on,v_cedula,v_email,v_hours,coalesce(p_exempt_ccss,false))
 returning id into eid;
 insert into public.employee_secrets values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 if p_vacation>0 then insert into public.vacation_movements(employee_id,days,reason) values(eid,p_vacation,'Saldo inicial validado por administrador');end if;
 return eid;
 end;
$$;
revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean) to authenticated;

drop function if exists public.update_employee(uuid,text,text,text,bigint,date,text,text);
create function public.update_employee(
 p_id uuid,p_name text,p_department text,p_position text,p_salary bigint,p_hired_on date,p_cedula text,p_email text,
 p_hours_month numeric default 243.36,p_exempt_ccss boolean default false
) returns void language plpgsql security definer set search_path='' as $$
 declare v_cedula text:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_hours numeric:=coalesce(nullif(p_hours_month,0),243.36);
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener de 9 a 12 dígitos';end if;
 if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Indica un correo electrónico válido';end if;
 if v_hours < 1 or v_hours > 400 then raise exception 'Horas del mes fuera de rango';end if;
 update public.employees
  set full_name=p_name,department=p_department,position=p_position,monthly_salary_cents=p_salary,
      hired_on=p_hired_on,cedula=v_cedula,email=v_email,hours_per_month=v_hours,exempt_from_ccss=coalesce(p_exempt_ccss,false)
  where id=p_id;
 if not found then raise exception 'Empleado no encontrado';end if;
 end;
$$;
revoke execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean) to authenticated;

-- Crear quincena: p_month = primer día del mes, p_half = 1|2
create or replace function public.create_payroll_fortnight(p_month date, p_half int)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid; v_start date; v_end date; v_last int;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
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
 insert into public.payroll_runs(period_start,period_end,kind)
 values(v_start,v_end,'fortnight') returning id into rid;
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
 from public.employees e where e.active;
 return rid;
 end;
$$;
revoke execute on function public.create_payroll_fortnight(date,int) from public,anon;
grant execute on function public.create_payroll_fortnight(date,int) to authenticated;

-- Mantener create_payroll mensual por compatibilidad (base = salario completo)
create or replace function public.create_payroll(p_month date) returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_month <> date_trunc('month',p_month)::date then raise exception 'Indica el primer día del mes';end if;
 insert into public.payroll_runs(period_start,period_end,kind)
 values(p_month,(p_month+interval '1 month'-interval '1 day')::date,'monthly') returning id into rid;
 insert into public.payroll_items(
  run_id,employee_id,employee_name,employee_code,employee_email,
  base_cents,hours_month,hourly_rate_cents,double_rate_cents,exempt_from_ccss
 )
 select rid,id,full_name,code,email,monthly_salary_cents,hours_per_month,
        public._crc_hourly(monthly_salary_cents,hours_per_month),
        public._crc_hourly(monthly_salary_cents,hours_per_month)*2,
        exempt_from_ccss
 from public.employees where active;
 return rid;
 end;
$$;

-- Actualizar ítem con desglose quincenal; CCSS se recalcula en servidor
drop function if exists public.update_payroll_item(uuid,bigint,bigint,bigint,text,boolean);
create function public.update_payroll_item(
 p_id uuid,
 p_ot_hours numeric,
 p_double_hours numeric,
 p_other_pay bigint,
 p_shortage bigint,
 p_receipt bigint,
 p_other_deduction bigint,
 p_note text,
 p_reviewed boolean
) returns void language plpgsql security definer set search_path='' as $$
 declare rid uuid; it public.payroll_items;
  v_ot bigint; v_dbl bigint; v_add bigint; v_ccss bigint; v_ded bigint;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select * into it from public.payroll_items where id=p_id for update;
 if not found then raise exception 'Ítem no encontrado';end if;
 select run_id into rid from public.payroll_items where id=p_id;
 perform 1 from public.payroll_runs where id=rid and status='draft' for update;
 if not found then raise exception 'La planilla ya está cerrada';end if;
 if coalesce(p_ot_hours,0) < 0 or coalesce(p_double_hours,0) < 0 then raise exception 'Las horas no pueden ser negativas';end if;
 v_ot := round(coalesce(p_ot_hours,0) * it.hourly_rate_cents * 1.5)::bigint;
 v_dbl := round(coalesce(p_double_hours,0) * coalesce(nullif(it.double_rate_cents,0), it.hourly_rate_cents*2))::bigint;
 v_add := v_ot + v_dbl + coalesce(p_other_pay,0);
 v_ccss := case when it.exempt_from_ccss then 0 else round(it.base_cents * 0.1083)::bigint end;
 v_ded := v_ccss + coalesce(p_shortage,0) + coalesce(p_receipt,0) + coalesce(p_other_deduction,0);
 if v_ded > it.base_cents + v_add then raise exception 'Las deducciones superan el salario bruto';end if;
 update public.payroll_items set
  ot_hours=coalesce(p_ot_hours,0),
  ot_amount_cents=v_ot,
  double_hours=coalesce(p_double_hours,0),
  double_amount_cents=v_dbl,
  other_pay_cents=coalesce(p_other_pay,0),
  addition_cents=v_add,
  ccss_cents=v_ccss,
  shortage_cents=coalesce(p_shortage,0),
  receipt_cents=coalesce(p_receipt,0),
  other_deduction_cents=coalesce(p_other_deduction,0),
  deduction_cents=v_ded,
  note=coalesce(p_note,''),
  reviewed=coalesce(p_reviewed,false)
 where id=p_id;
 end;
$$;
revoke execute on function public.update_payroll_item(uuid,numeric,numeric,bigint,bigint,bigint,bigint,text,boolean) from public,anon;
grant execute on function public.update_payroll_item(uuid,numeric,numeric,bigint,bigint,bigint,bigint,text,boolean) to authenticated;

commit;
