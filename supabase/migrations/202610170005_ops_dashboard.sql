begin;
-- Dashboard de operaciones con rango de fechas, métricas por estado/área/día/empleado.

create or replace function public.ops_dashboard(p_from date default null, p_to date default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  today date:=(timezone('America/Costa_Rica',now()))::date;
  d_from date:=coalesce(p_from,today);
  d_to date:=coalesce(p_to,today);
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if d_to < d_from then raise exception 'La fecha final debe ser posterior o igual a la inicial'; end if;
  if d_to - d_from > 90 then raise exception 'El rango máximo es de 90 días'; end if;

  return jsonb_build_object(
   'from', d_from,
   'to', d_to,
   'tasks', (select jsonb_build_object(
     'total', count(*),
     'pending', count(*) filter (where status='pending'),
     'in_progress', count(*) filter (where status='in_progress'),
     'completed', count(*) filter (where status='completed'),
     'approved', count(*) filter (where status='approved'),
     'rejected', count(*) filter (where status='rejected'),
     'late', count(*) filter (where status in ('pending','in_progress') and due_at < now()),
     'done', count(*) filter (where status in ('completed','approved'))
    ) from public.tasks where run_date between d_from and d_to),
   'by_status', coalesce((select jsonb_agg(row_to_json(s) order by s.sort) from (
     select status::text as status, count(*)::int as count,
      case status
       when 'pending' then 1 when 'in_progress' then 2 when 'completed' then 3
       when 'approved' then 4 when 'rejected' then 5 else 6 end as sort
     from public.tasks where run_date between d_from and d_to
     group by status
   ) s),'[]'::jsonb),
   'by_area', coalesce((select jsonb_agg(row_to_json(a) order by a.area) from (
     select area::text as area,
      count(*)::int as total,
      count(*) filter (where status='pending')::int as pending,
      count(*) filter (where status='in_progress')::int as in_progress,
      count(*) filter (where status in ('completed','approved'))::int as done,
      count(*) filter (where status='approved')::int as approved,
      count(*) filter (where status='rejected')::int as rejected
     from public.tasks where run_date between d_from and d_to
     group by area
   ) a),'[]'::jsonb),
   'by_day', coalesce((select jsonb_agg(row_to_json(d) order by d.day) from (
     select run_date::text as day,
      count(*)::int as total,
      count(*) filter (where status in ('completed','approved'))::int as done,
      count(*) filter (where status='pending')::int as pending,
      count(*) filter (where status='in_progress')::int as in_progress,
      count(*) filter (where status='rejected')::int as rejected
     from public.tasks where run_date between d_from and d_to
     group by run_date
   ) d),'[]'::jsonb),
   'by_employee', coalesce((select jsonb_agg(row_to_json(e) order by e.full_name) from (
     select emp.id as employee_id, emp.full_name, emp.code,
      count(*)::int as total,
      count(*) filter (where t.status in ('completed','approved'))::int as done,
      count(*) filter (where t.status in ('pending','in_progress'))::int as pending,
      count(*) filter (where t.status='in_progress')::int as in_progress,
      count(*) filter (where t.status='rejected')::int as rejected
     from public.tasks t
     join public.employees emp on emp.id=t.assigned_employee_id
     where t.run_date between d_from and d_to
     group by emp.id, emp.full_name, emp.code
   ) e),'[]'::jsonb),
   'unassigned', (select count(*)::int from public.tasks
     where run_date between d_from and d_to and assigned_employee_id is null
       and status in ('pending','in_progress','rejected')),
   'incidents', (select jsonb_build_object(
     'open', count(*) filter (where status in ('open','assigned')),
     'critical', count(*) filter (where severity='critical' and status in ('open','assigned')),
     'resolved', count(*) filter (where status in ('resolved','closed')
       and coalesce(resolved_at,closed_at,created_at)::date between d_from and d_to),
     'reported', count(*) filter (where created_at::date between d_from and d_to)
    ) from public.incidents)
  );
 end;
$$;

create or replace function public.ops_dashboard_today()
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare d date:=(timezone('America/Costa_Rica',now()))::date;
 begin
  return public.ops_dashboard(d, d);
 end;
$$;

revoke execute on function public.ops_dashboard(date,date) from public,anon;
grant execute on function public.ops_dashboard(date,date) to authenticated;

commit;
