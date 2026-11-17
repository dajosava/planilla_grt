-- Empleados con pago por horas (sin salario mensual fijo).
-- Ordinario = horas marcadas (menos extras) × tarifa; extras siguen el flujo OT 1.5×.

alter table public.employees
  add column if not exists pay_by_hours boolean not null default false,
  add column if not exists hourly_rate_cents bigint not null default 0
    check (hourly_rate_cents between 0 and 10000000000);

alter table public.payroll_items
  add column if not exists pay_by_hours boolean not null default false,
  add column if not exists ordinary_hours numeric(8,2) not null default 0
    check (ordinary_hours >= 0 and ordinary_hours <= 800);

-- create_employee con pago por horas
drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean);

create function public.create_employee(
  p_code text,
  p_name text,
  p_department text,
  p_position text,
  p_salary bigint,
  p_pin text,
  p_vacation numeric,
  p_hired_on date,
  p_cedula text,
  p_email text,
  p_hours_month numeric default 243.36,
  p_exempt_ccss boolean default false,
  p_pay_by_hours boolean default false,
  p_hourly_rate bigint default 0
) returns uuid
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  eid uuid;
  v_cedula text;
  v_email text;
  v_hours numeric;
  v_salary bigint;
  v_rate bigint;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_department not in ('Gasolinera','Supermercado','Transporte') then
    raise exception 'La sociedad debe ser Gasolinera, Supermercado o Transporte';
  end if;
  if coalesce(p_pin,'') !~ '^\d{4}$' then raise exception 'El PIN debe tener 4 dígitos'; end if;
  if p_hired_on is null or p_hired_on > (timezone('America/Costa_Rica',now()))::date then
    raise exception 'La fecha de ingreso no es válida';
  end if;
  if p_hired_on < date '1950-01-01' then raise exception 'La fecha de ingreso no es válida'; end if;
  v_cedula := regexp_replace(coalesce(p_cedula,''),'\D','','g');
  if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener entre 9 y 12 dígitos'; end if;
  v_email := lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' or length(v_email)>254 then
    raise exception 'El correo electrónico no es válido';
  end if;
  v_hours := coalesce(p_hours_month,243.36);
  if v_hours < 1 or v_hours > 400 then raise exception 'Horas/mes inválidas'; end if;

  if coalesce(p_pay_by_hours,false) then
    v_rate := coalesce(p_hourly_rate,0);
    if v_rate <= 0 then raise exception 'Indicá el precio por hora (CRC)'; end if;
    v_salary := 0;
  else
    v_salary := coalesce(p_salary,0);
    if v_salary < 0 then raise exception 'Salario inválido'; end if;
    v_rate := 0;
  end if;

  insert into public.employees(
    code,full_name,department,position,monthly_salary_cents,vacation_balance,
    hired_on,cedula,email,hours_per_month,exempt_from_ccss,pay_by_hours,hourly_rate_cents
  ) values (
    p_code,p_name,p_department,p_position,v_salary,p_vacation,
    p_hired_on,v_cedula,v_email,v_hours,coalesce(p_exempt_ccss,false),
    coalesce(p_pay_by_hours,false),v_rate
  ) returning id into eid;

  insert into public.employee_secrets(employee_id,pin_hash)
  values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
  return eid;
end;
$$;

revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean,boolean,bigint) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text,text,numeric,boolean,boolean,bigint) to authenticated;

-- update_employee con pago por horas
drop function if exists public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean);

create function public.update_employee(
  p_id uuid,
  p_name text,
  p_department text,
  p_position text,
  p_salary bigint,
  p_hired_on date,
  p_cedula text,
  p_email text,
  p_hours_month numeric default 243.36,
  p_exempt_ccss boolean default false,
  p_pay_by_hours boolean default false,
  p_hourly_rate bigint default 0
) returns void
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  v_cedula text;
  v_email text;
  v_hours numeric;
  v_salary bigint;
  v_rate bigint;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_department not in ('Gasolinera','Supermercado','Transporte') then
    raise exception 'La sociedad debe ser Gasolinera, Supermercado o Transporte';
  end if;
  if p_hired_on is null or p_hired_on > (timezone('America/Costa_Rica',now()))::date then
    raise exception 'La fecha de ingreso no es válida';
  end if;
  if p_hired_on < date '1950-01-01' then raise exception 'La fecha de ingreso no es válida'; end if;
  v_cedula := regexp_replace(coalesce(p_cedula,''),'\D','','g');
  if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener entre 9 y 12 dígitos'; end if;
  v_email := lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' or length(v_email)>254 then
    raise exception 'El correo electrónico no es válido';
  end if;
  v_hours := coalesce(p_hours_month,243.36);
  if v_hours < 1 or v_hours > 400 then raise exception 'Horas/mes inválidas'; end if;

  if coalesce(p_pay_by_hours,false) then
    v_rate := coalesce(p_hourly_rate,0);
    if v_rate <= 0 then raise exception 'Indicá el precio por hora (CRC)'; end if;
    v_salary := 0;
  else
    v_salary := coalesce(p_salary,0);
    if v_salary < 0 then raise exception 'Salario inválido'; end if;
    v_rate := 0;
  end if;

  update public.employees set
    full_name=p_name,
    department=p_department,
    position=p_position,
    monthly_salary_cents=v_salary,
    hired_on=p_hired_on,
    cedula=v_cedula,
    email=v_email,
    hours_per_month=v_hours,
    exempt_from_ccss=coalesce(p_exempt_ccss,false),
    pay_by_hours=coalesce(p_pay_by_hours,false),
    hourly_rate_cents=v_rate
  where id=p_id;
  if not found then raise exception 'Empleado no encontrado'; end if;
end;
$$;

revoke execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean,boolean,bigint) from public,anon;
grant execute on function public.update_employee(uuid,text,text,text,bigint,date,text,text,numeric,boolean,boolean,bigint) to authenticated;

-- Crear quincena: mensuales = salario/2; por horas = tarifa fija (base se recalcula en sync)
create or replace function public.create_payroll_fortnight(p_month date, p_half int, p_company text)
 returns uuid
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  rid uuid;
  v_start date;
  v_end date;
  v_last int;
  n int;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_company not in ('Gasolinera','Supermercado','Transporte') then
    raise exception 'La planilla debe ser de Gasolinera, Supermercado o Transporte';
  end if;
  if p_half not in (1,2) then raise exception 'La quincena debe ser 1 (1–15) o 2 (16–fin)'; end if;
  if p_month <> date_trunc('month',p_month)::date then raise exception 'Indica el primer día del mes'; end if;
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
    addition_cents,deduction_cents,pay_by_hours,ordinary_hours
  )
  select
    rid,e.id,e.full_name,e.code,e.email,
    case when e.pay_by_hours then 0
         else round(e.monthly_salary_cents::numeric/2)::bigint end,
    e.hours_per_month,
    case when e.pay_by_hours then e.hourly_rate_cents
         else public._crc_hourly(e.monthly_salary_cents,e.hours_per_month) end,
    case when e.pay_by_hours then e.hourly_rate_cents * 2
         else public._crc_hourly(e.monthly_salary_cents,e.hours_per_month)*2 end,
    case
      when e.exempt_from_ccss or e.pay_by_hours then 0
      else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint
    end,
    (e.exempt_from_ccss or e.pay_by_hours),
    0,
    case
      when e.exempt_from_ccss or e.pay_by_hours then 0
      else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint
    end,
    e.pay_by_hours,
    0
  from public.employees e
  where e.active and e.department=p_company;

  get diagnostics n = row_count;
  if n = 0 then
    delete from public.payroll_runs where id=rid;
    raise exception 'No hay empleados activos en %', p_company;
  end if;

  perform public.sync_payroll_ot_from_attendance(rid);
  return rid;
end;
$$;

revoke execute on function public.create_payroll_fortnight(date,int,text) from public,anon;
grant execute on function public.create_payroll_fortnight(date,int,text) to authenticated;

-- Sync OT + recalcular ordinario/base para pago por horas
create or replace function public.sync_payroll_ot_from_attendance(p_run_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  r public.payroll_runs;
  it public.payroll_items;
  v_suggested numeric;
  v_ordinary numeric;
  v_base bigint;
  v_ccss bigint;
  v_ded bigint;
  n_pending int:=0;
  n_items int:=0;
  bad record;
  day_row record;
  ctx jsonb;
  day_ot numeric;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se pueden sincronizar extras en planillas en borrador'; end if;

  for it in select * from public.payroll_items where run_id=p_run_id loop
    n_items:=n_items+1;
    delete from public.payroll_ot_days where item_id=it.id;
    v_ordinary := 0;

    select d.work_date, d.hours into bad
    from (
      select
       (timezone('America/Costa_Rica', es.started_at))::date as work_date,
       round(sum(coalesce(es.worked_hours,0))::numeric, 2) as hours
      from public.effective_sessions es
      where es.employee_id = it.employee_id
        and es.ended_at is not null
        and (timezone('America/Costa_Rica', es.started_at))::date between r.period_start and r.period_end
      group by 1
    ) d
    where d.hours > 24
    order by d.hours desc
    limit 1;

    if found then
      raise exception
       'Asistencia inválida: % (%) el % tiene % h trabajadas (máx. 24). Corregí esa jornada en Asistencia y volvé a crear/sincronizar la planilla.',
       it.employee_name, it.employee_code, bad.work_date, bad.hours;
    end if;

    for day_row in
      select
       (timezone('America/Costa_Rica', es.started_at))::date as work_date,
       round(sum(coalesce(es.worked_hours,0))::numeric, 2) as hours,
       min(es.started_at) as window_start,
       max(es.ended_at) as window_end
      from public.effective_sessions es
      where es.employee_id = it.employee_id
        and es.ended_at is not null
        and (timezone('America/Costa_Rica', es.started_at))::date between r.period_start and r.period_end
      group by 1
    loop
      ctx := public.shift_ot_context(it.employee_id, day_row.work_date, day_row.window_start, day_row.window_end, day_row.hours);
      day_ot := least(coalesce((ctx->>'otHours')::numeric, 0), 16);
      v_ordinary := v_ordinary + greatest(least(day_row.hours, 24) - day_ot, 0);

      if day_ot > 0 then
        insert into public.payroll_ot_days(item_id, work_date, worked_hours, ot_hours)
        values(it.id, day_row.work_date, least(day_row.hours, 24), day_ot);
      end if;
    end loop;

    v_ordinary := round(v_ordinary, 2);

    select coalesce(round(sum(ot_hours)::numeric, 2), 0) into v_suggested
    from public.payroll_ot_days where item_id=it.id;

    if it.pay_by_hours then
      v_base := round(v_ordinary * it.hourly_rate_cents)::bigint;
      v_ccss := case when it.exempt_from_ccss or it.pay_by_hours then 0 else round(v_base * 0.1083)::bigint end;
      v_ded := v_ccss + coalesce(it.shortage_cents,0) + coalesce(it.receipt_cents,0) + coalesce(it.other_deduction_cents,0);
      if v_ded > v_base + coalesce(it.addition_cents,0) then
        v_ded := v_base + coalesce(it.addition_cents,0);
      end if;

      update public.payroll_items set
        ordinary_hours = v_ordinary,
        base_cents = v_base,
        ccss_cents = v_ccss,
        deduction_cents = v_ded
      where id = it.id;
    end if;

    if v_suggested > 0 then
      if it.ot_status = 'approved' then
        update public.payroll_items set suggested_ot_hours=v_suggested where id=it.id;
      else
        update public.payroll_items
          set suggested_ot_hours=v_suggested, ot_status='pending'
        where id=it.id;
        n_pending:=n_pending+1;
      end if;
    else
      update public.payroll_items
        set suggested_ot_hours=0,
            ot_status=case when ot_status='pending' then 'none' else ot_status end
      where id=it.id;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'items', n_items, 'pending', n_pending);
end;
$$;

revoke execute on function public.sync_payroll_ot_from_attendance(uuid) from public,anon;
grant execute on function public.sync_payroll_ot_from_attendance(uuid) to authenticated;
