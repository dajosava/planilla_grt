-- El manager puede aceptar (revisar) avisos de asistencia para que
-- dejen de aparecer en el panel y en el badge del menú.

begin;

create table if not exists public.attendance_alert_acks (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('missing_photo','missing_exit','ot_day')),
 ref_id text not null check (length(trim(ref_id)) between 1 and 120),
 note text not null default '' check (length(note) <= 500),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 unique (kind, ref_id)
);

create index if not exists attendance_alert_acks_kind_ref
 on public.attendance_alert_acks (kind, ref_id);

alter table public.attendance_alert_acks enable row level security;
revoke all on public.attendance_alert_acks from anon, authenticated;
grant select on public.attendance_alert_acks to authenticated;
drop policy if exists admin_attendance_acks_read on public.attendance_alert_acks;
create policy admin_attendance_acks_read on public.attendance_alert_acks
 for select to authenticated using (public.is_admin());

create or replace function public.ack_attendance_alert(p_kind text, p_ref_id text, p_note text default '')
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_kind not in ('missing_photo','missing_exit','ot_day') then
   raise exception 'Tipo de aviso no válido';
  end if;
  if length(trim(coalesce(p_ref_id,''))) < 1 then
   raise exception 'Referencia del aviso no válida';
  end if;
  insert into public.attendance_alert_acks(kind, ref_id, note, created_by)
  values (p_kind, trim(p_ref_id), coalesce(left(trim(p_note),500),''), auth.uid())
  on conflict (kind, ref_id) do update
   set note = excluded.note,
       created_by = excluded.created_by,
       created_at = now();
 end;
$$;

-- Actualizar listado de extras: excluir días aceptados
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
    end as alert_status,
    (d.employee_id::text || '|' || d.work_date::text) as ack_ref
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
   'employee_id', enr.employee_id,
   'employee_name', enr.employee_name,
   'employee_code', enr.employee_code,
   'department', enr.department,
   'work_date', enr.work_date,
   'worked_hours', enr.worked_hours,
   'ot_hours', enr.ot_hours,
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

create or replace function public.count_attendance_alerts()
 returns integer language plpgsql security definer set search_path='' as $$
 declare
  today date:=(timezone('America/Costa_Rica',now()))::date;
  d_from date:=today - 6;
  n_open int:=0;
  n_photo int:=0;
  n_ot int:=0;
 begin
  if not public.is_admin() then return 0; end if;

  select count(*)::int into n_open
  from public.effective_sessions s
  where s.ended_at is null
    and (
     (timezone('America/Costa_Rica', s.started_at))::date < today
     or extract(epoch from (now() - s.started_at))/3600.0 > 12
    )
    and not exists (
     select 1 from public.attendance_alert_acks a
     where a.kind = 'missing_exit' and a.ref_id = s.id::text
    );

  select count(*)::int into n_photo
  from public.attendance_events e
  join public.punch_photos p on p.event_id = e.id
  where p.status = 'missing'
    and (timezone('America/Costa_Rica', e.occurred_at))::date between d_from and today
    and not exists (
     select 1 from public.attendance_alert_acks a
     where a.kind = 'missing_photo' and a.ref_id = e.id::text
    );

  begin
   select coalesce((public.list_attendance_ot_alerts(d_from, today)->>'count')::int, 0) into n_ot;
  exception when undefined_function then
   n_ot := 0;
  end;

  return coalesce(n_open,0) + coalesce(n_photo,0) + coalesce(n_ot,0);
 end;
$$;

revoke execute on function public.ack_attendance_alert(text,text,text) from public,anon;
grant execute on function public.ack_attendance_alert(text,text,text) to authenticated;
revoke execute on function public.list_attendance_ot_alerts(date,date) from public,anon;
grant execute on function public.list_attendance_ot_alerts(date,date) to authenticated;
revoke execute on function public.count_attendance_alerts() from public,anon;
grant execute on function public.count_attendance_alerts() to authenticated;

commit;
