-- Alertas de horas extra desde asistencia (>8 h/día) para el manager.
-- Sirve en /admin/asistencia y como badge del menú.

begin;

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
  if d_to < d_from then
   d_to := d_from;
  end if;

  with daily as (
   select
    es.employee_id,
    (timezone('America/Costa_Rica', es.started_at))::date as work_date,
    round(sum(coalesce(es.worked_hours,0))::numeric, 2) as worked_hours
   from public.effective_sessions es
   where es.ended_at is not null
     and (timezone('America/Costa_Rica', es.started_at))::date between d_from and d_to
   group by 1, 2
   having sum(coalesce(es.worked_hours,0)) > 8
  ),
  enriched as (
   select
    d.employee_id,
    e.full_name as employee_name,
    e.code as employee_code,
    e.department,
    d.work_date,
    least(d.worked_hours, 24) as worked_hours,
    least(greatest(d.worked_hours - 8, 0), 16) as ot_hours,
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
    end as alert_status
   from daily d
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
   'employee_id', employee_id,
   'employee_name', employee_name,
   'employee_code', employee_code,
   'department', department,
   'work_date', work_date,
   'worked_hours', worked_hours,
   'ot_hours', ot_hours,
   'item_id', item_id,
   'run_id', run_id,
   'company', company,
   'run_status', run_status,
   'ot_status', ot_status,
   'alert_status', alert_status
  ) order by work_date desc, employee_name), '[]'::jsonb)
  into rows
  from enriched
  where alert_status in ('pending_approval','needs_payroll','needs_sync');

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

create or replace function public.count_attendance_ot_alerts()
 returns integer language plpgsql security definer set search_path='' as $$
 declare n int;
 begin
  if not public.is_admin() then return 0; end if;
  select coalesce((public.list_attendance_ot_alerts(null,null)->>'count')::int, 0) into n;
  return n;
 end;
$$;

revoke execute on function public.list_attendance_ot_alerts(date,date) from public,anon;
revoke execute on function public.count_attendance_ot_alerts() from public,anon;
grant execute on function public.list_attendance_ot_alerts(date,date) to authenticated;
grant execute on function public.count_attendance_ot_alerts() to authenticated;

commit;
