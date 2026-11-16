-- Clasificación DIURNA / MIXTA / NOCTURNA (art. 135 Código de Trabajo CR)
-- y umbrales ordinarios 8h / 7h / 6h para horas extra.
begin;

create or replace function public.classify_shift_cr(p_start timestamptz, p_end timestamptz)
 returns jsonb
 language plpgsql
 immutable
 set search_path=''
as $$
declare
  worked int;
  night int:=0;
  day_m int;
  ts timestamptz;
  hr int;
  kind text;
  lim int;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return jsonb_build_object('error','Intervalo inválido');
  end if;

  worked := greatest(0, round(extract(epoch from p_end - p_start) / 60.0)::int);

  ts := p_start;
  while ts < p_end loop
    hr := extract(hour from (ts at time zone 'America/Costa_Rica'))::int;
    if hr >= 19 or hr < 5 then
      night := night + 1;
    end if;
    ts := ts + interval '1 minute';
  end loop;

  day_m := greatest(0, worked - night);

  if night = 0 then
    kind := 'DAY';
    lim := 480;
  elsif day_m = 0 or night >= 210 then
    kind := 'NIGHT';
    lim := 360;
  else
    kind := 'MIXED';
    lim := 420;
  end if;

  return jsonb_build_object(
    'type', kind,
    'label', case kind when 'DAY' then 'Diurna' when 'MIXED' then 'Mixta' else 'Nocturna' end,
    'workedMinutes', worked,
    'dayMinutes', day_m,
    'nightMinutes', night,
    'legalOrdinaryLimitMinutes', lim,
    'legalOrdinaryLimitHours', lim / 60.0
  );
end;
$$;

-- Para un empleado/día: prioriza turno asignado (jornada pactada) para el límite OT.
create or replace function public.shift_ot_context(
  p_employee uuid,
  p_work_date date,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_worked_hours numeric
) returns jsonb
 language plpgsql
 stable
 security definer
 set search_path=''
as $$
declare
  sh public.shifts;
  classified jsonb;
  scheduled boolean:=false;
  needs_review boolean:=true;
  lim_h numeric;
  ot numeric;
begin
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    return jsonb_build_object('error','Ventana inválida');
  end if;

  -- Turno planificado que cae ese día (CR) o se solapa con la ventana real.
  select * into sh
  from public.shifts s
  where s.employee_id = p_employee
    and (
      (timezone('America/Costa_Rica', s.starts_at))::date = p_work_date
      or (s.starts_at, s.ends_at) overlaps (p_window_start, p_window_end)
    )
  order by s.starts_at
  limit 1;

  if sh.id is not null then
    classified := public.classify_shift_cr(sh.starts_at, sh.ends_at);
    scheduled := true;
    needs_review := false;
  else
    classified := public.classify_shift_cr(p_window_start, p_window_end);
    scheduled := false;
    needs_review := true;
  end if;

  if classified ? 'error' then
    return classified;
  end if;

  lim_h := (classified->>'legalOrdinaryLimitHours')::numeric;
  ot := least(greatest(coalesce(p_worked_hours,0) - lim_h, 0), 16);

  return classified || jsonb_build_object(
    'scheduled', scheduled,
    'needs_review', needs_review,
    'ordinaryLimitHours', lim_h,
    'otHours', round(ot, 2),
    'workedHours', round(coalesce(p_worked_hours,0), 2)
  );
end;
$$;

revoke all on function public.classify_shift_cr(timestamptz,timestamptz) from public,anon;
revoke all on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) from public,anon;
grant execute on function public.classify_shift_cr(timestamptz,timestamptz) to authenticated;
grant execute on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) to authenticated;

-- Sync OT planilla con umbral 8/7/6 según jornada
create or replace function public.sync_payroll_ot_from_attendance(p_run_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  r public.payroll_runs;
  it public.payroll_items;
  v_suggested numeric;
  n_pending int:=0;
  n_items int:=0;
  bad record;
  day_row record;
  ctx jsonb;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se pueden sincronizar extras en planillas en borrador'; end if;

  for it in select * from public.payroll_items where run_id=p_run_id loop
   n_items:=n_items+1;
   delete from public.payroll_ot_days where item_id=it.id;

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
    if coalesce((ctx->>'otHours')::numeric, 0) > 0 then
     insert into public.payroll_ot_days(item_id, work_date, worked_hours, ot_hours)
     values(
      it.id,
      day_row.work_date,
      least(day_row.hours, 24),
      least((ctx->>'otHours')::numeric, 16)
     );
    end if;
   end loop;

   select coalesce(round(sum(ot_hours)::numeric, 2), 0) into v_suggested
   from public.payroll_ot_days where item_id=it.id;

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
   'pending', n_pending
  );
 end;
$$;

create or replace function public.list_attendance_ot_alerts(p_from date default null, p_to date default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  d_from date:=coalesce(p_from,(timezone('America/Costa_Rica',now()))::date - 15);
  d_to date:=coalesce(p_to,(timezone('America/Costa_Rica',now()))::date);
  rows jsonb;
 begin
  if not public.is_admin() then
   return jsonb_build_object('ok',false,'error','No autorizado','count',0,'people',0,'items','[]'::jsonb);
  end if;
  if d_to < d_from then d_to := d_from; end if;

  with daily as (
   select
    es.employee_id,
    (timezone('America/Costa_Rica', es.started_at))::date as work_date,
    round(sum(coalesce(es.worked_hours,0))::numeric, 2) as worked_hours,
    min(es.started_at) as window_start,
    max(es.ended_at) as window_end
   from public.effective_sessions es
   where es.ended_at is not null
     and (timezone('America/Costa_Rica', es.started_at))::date between d_from and d_to
   group by 1, 2
  ),
  classified as (
   select
    d.*,
    public.shift_ot_context(d.employee_id, d.work_date, d.window_start, d.window_end, d.worked_hours) as ctx
   from daily d
  ),
  with_ot as (
   select
    c.employee_id,
    c.work_date,
    least(c.worked_hours, 24) as worked_hours,
    least(coalesce((c.ctx->>'otHours')::numeric, 0), 16) as ot_hours,
    coalesce(c.ctx->>'type','DAY') as shift_type,
    coalesce(c.ctx->>'label','Diurna') as shift_label,
    coalesce((c.ctx->>'ordinaryLimitHours')::numeric, 8) as ordinary_limit_hours,
    coalesce((c.ctx->>'nightMinutes')::int, 0) as night_minutes,
    coalesce((c.ctx->>'scheduled')::boolean, false) as scheduled,
    coalesce((c.ctx->>'needs_review')::boolean, true) as needs_review
   from classified c
   where coalesce((c.ctx->>'otHours')::numeric, 0) > 0
  ),
  enriched as (
   select
    d.employee_id,
    e.full_name as employee_name,
    e.code as employee_code,
    e.department,
    d.work_date,
    d.worked_hours,
    d.ot_hours,
    d.shift_type,
    d.shift_label,
    d.ordinary_limit_hours,
    d.night_minutes,
    d.scheduled,
    d.needs_review,
    x.item_id,
    x.run_id,
    x.company,
    x.run_status,
    x.ot_status,
    case
     when x.ot_status = 'pending' then 'pending_approval'
     when x.ot_status = 'approved' then 'approved'
     when x.ot_status = 'rejected' then 'rejected'
     when x.run_id is null then 'needs_payroll'
     else 'needs_sync'
    end as alert_status,
    (d.employee_id::text || '|' || d.work_date::text) as ack_ref
   from with_ot d
   join public.employees e on e.id = d.employee_id
   left join lateral (
    select
     i.id as item_id,
     i.ot_status,
     r.id as run_id,
     r.company,
     r.status as run_status
    from public.payroll_items i
    join public.payroll_runs r on r.id = i.run_id
    where i.employee_id = d.employee_id
      and d.work_date between r.period_start and r.period_end
      and r.company = e.department
    order by case when r.status='draft' then 0 else 1 end, r.period_start desc
    limit 1
   ) x on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
   'employee_id', enr.employee_id,
   'employee_name', enr.employee_name,
   'employee_code', enr.employee_code,
   'department', enr.department,
   'work_date', enr.work_date,
   'worked_hours', enr.worked_hours,
   'ot_hours', enr.ot_hours,
   'shift_type', enr.shift_type,
   'shift_label', enr.shift_label,
   'ordinary_limit_hours', enr.ordinary_limit_hours,
   'night_minutes', enr.night_minutes,
   'scheduled', enr.scheduled,
   'needs_review', enr.needs_review,
   'item_id', enr.item_id,
   'run_id', enr.run_id,
   'company', enr.company,
   'run_status', enr.run_status,
   'ot_status', enr.ot_status,
   'alert_status', enr.alert_status,
   'ack_ref', enr.ack_ref
  ) order by enr.work_date desc, enr.employee_name), '[]'::jsonb)
  into rows
  from enriched enr
  where enr.alert_status in ('pending_approval','needs_payroll','needs_sync')
    and not exists (
     select 1 from public.attendance_alert_acks a
     where a.kind = 'ot_day' and a.ref_id = enr.ack_ref
    );

  return jsonb_build_object(
   'ok', true,
   'from', d_from,
   'to', d_to,
   'count', jsonb_array_length(rows),
   'people', (
    select count(distinct x->>'employee_id')
    from jsonb_array_elements(rows) x
   ),
   'ot_hours', coalesce((
    select round(sum((x->>'ot_hours')::numeric), 2)
    from jsonb_array_elements(rows) x
   ), 0),
   'items', rows
  );
 end;
$$;

commit;
