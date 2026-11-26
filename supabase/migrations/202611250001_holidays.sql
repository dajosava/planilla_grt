-- Feriados nacionales / de negocio: horas trabajadas ese día se pagan a 2×.

create table if not exists public.holidays (
 holiday_date date primary key,
 name text not null default 'Feriado' check (char_length(trim(name)) between 2 and 80),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists holidays_year_idx on public.holidays ((extract(year from holiday_date)));

alter table public.holidays enable row level security;
revoke all on public.holidays from public, anon, authenticated;
grant select, insert, update, delete on public.holidays to authenticated;

create policy admin_all_holidays on public.holidays
 for all to authenticated
 using (public.is_admin())
 with check (public.is_admin());

create or replace function public.list_holidays(p_year integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $$
 declare
  y int := coalesce(p_year, extract(year from timezone('America/Costa_Rica', now()))::int);
  rows jsonb;
 begin
  if not public.is_admin() then
   return jsonb_build_object('ok', false, 'error', 'No autorizado', 'holidays', '[]'::jsonb);
  end if;
  if y < 2000 or y > 2100 then
   return jsonb_build_object('ok', false, 'error', 'Año inválido', 'holidays', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
   'date', h.holiday_date,
   'name', h.name
  ) order by h.holiday_date), '[]'::jsonb)
  into rows
  from public.holidays h
  where extract(year from h.holiday_date) = y;

  return jsonb_build_object('ok', true, 'year', y, 'holidays', rows);
 end;
$$;

create or replace function public.upsert_holiday(p_date date, p_name text default 'Feriado')
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $$
 declare
  v_name text := left(trim(coalesce(p_name, 'Feriado')), 80);
 begin
  if not public.is_admin() then
   return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;
  if p_date is null then
   return jsonb_build_object('ok', false, 'error', 'Fecha inválida');
  end if;
  if char_length(v_name) < 2 then v_name := 'Feriado'; end if;

  insert into public.holidays as h (holiday_date, name, updated_at)
  values (p_date, v_name, now())
  on conflict (holiday_date) do update set
   name = excluded.name,
   updated_at = now();

  return jsonb_build_object('ok', true, 'date', p_date, 'name', v_name);
 end;
$$;

create or replace function public.delete_holiday(p_date date)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $$
 begin
  if not public.is_admin() then
   return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;
  if p_date is null then
   return jsonb_build_object('ok', false, 'error', 'Fecha inválida');
  end if;
  delete from public.holidays where holiday_date = p_date;
  return jsonb_build_object('ok', true, 'date', p_date);
 end;
$$;

revoke execute on function public.list_holidays(integer) from public, anon;
revoke execute on function public.upsert_holiday(date, text) from public, anon;
revoke execute on function public.delete_holiday(date) from public, anon;
grant execute on function public.list_holidays(integer) to authenticated;
grant execute on function public.upsert_holiday(date, text) to authenticated;
grant execute on function public.delete_holiday(date) to authenticated;

-- Sync OT + feriados (2×) + recalcular ordinario/base para pago por horas
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
  v_double numeric;
  v_dbl_amt bigint;
  v_base bigint;
  v_ccss bigint;
  v_ded bigint;
  n_pending int:=0;
  n_items int:=0;
  n_holiday_days int:=0;
  bad record;
  day_row record;
  ctx jsonb;
  day_ot numeric;
  is_holiday boolean;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se pueden sincronizar extras en planillas en borrador'; end if;

  for it in select * from public.payroll_items where run_id=p_run_id loop
    n_items:=n_items+1;
    delete from public.payroll_ot_days where item_id=it.id;
    v_ordinary := 0;
    v_double := 0;

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
      is_holiday := exists (
        select 1 from public.holidays h where h.holiday_date = day_row.work_date
      );

      if is_holiday then
        -- Día feriado: todas las horas trabajadas van a pago doble (2×), sin OT 1.5×.
        v_double := v_double + least(day_row.hours, 24);
        n_holiday_days := n_holiday_days + 1;
      else
        ctx := public.shift_ot_context(it.employee_id, day_row.work_date, day_row.window_start, day_row.window_end, day_row.hours);
        day_ot := least(coalesce((ctx->>'otHours')::numeric, 0), 16);
        v_ordinary := v_ordinary + greatest(least(day_row.hours, 24) - day_ot, 0);

        if day_ot > 0 then
          insert into public.payroll_ot_days(item_id, work_date, worked_hours, ot_hours)
          values(it.id, day_row.work_date, least(day_row.hours, 24), day_ot);
        end if;
      end if;
    end loop;

    v_ordinary := round(v_ordinary, 2);
    v_double := round(v_double, 2);
    v_dbl_amt := round(v_double * coalesce(nullif(it.double_rate_cents,0), it.hourly_rate_cents*2))::bigint;

    select coalesce(round(sum(ot_hours)::numeric, 2), 0) into v_suggested
    from public.payroll_ot_days where item_id=it.id;

    if it.pay_by_hours then
      v_base := round(v_ordinary * it.hourly_rate_cents)::bigint;
      v_ccss := case when it.exempt_from_ccss or it.pay_by_hours then 0 else round(v_base * 0.1083)::bigint end;
      v_ded := v_ccss + coalesce(it.shortage_cents,0) + coalesce(it.receipt_cents,0) + coalesce(it.other_deduction_cents,0);
      if v_ded > v_base + coalesce(it.addition_cents,0) + v_dbl_amt then
        v_ded := v_base + coalesce(it.addition_cents,0) + v_dbl_amt;
      end if;

      update public.payroll_items set
        ordinary_hours = v_ordinary,
        base_cents = v_base,
        ccss_cents = v_ccss,
        deduction_cents = v_ded,
        double_hours = v_double,
        double_amount_cents = v_dbl_amt
      where id = it.id;
    else
      update public.payroll_items set
        double_hours = v_double,
        double_amount_cents = v_dbl_amt
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

  return jsonb_build_object(
   'ok', true,
   'items', n_items,
   'pending', n_pending,
   'holiday_days', n_holiday_days
  );
end;
$$;

revoke execute on function public.sync_payroll_ot_from_attendance(uuid) from public,anon;
grant execute on function public.sync_payroll_ot_from_attendance(uuid) to authenticated;
