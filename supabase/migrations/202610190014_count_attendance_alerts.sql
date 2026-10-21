-- Badge de Asistencia: suma avisos por revisar
-- (sin salida + sin foto + extras pendientes).

begin;

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

  -- Jornadas abiertas que ya deberían haberse cerrado (>12 h o de un día anterior)
  select count(*)::int into n_open
  from public.effective_sessions s
  where s.ended_at is null
    and (
     (timezone('America/Costa_Rica', s.started_at))::date < today
     or extract(epoch from (now() - s.started_at))/3600.0 > 12
    );

  -- Marcas sin foto en los últimos 7 días (CR)
  select count(*)::int into n_photo
  from public.attendance_events e
  join public.punch_photos p on p.event_id = e.id
  where p.status = 'missing'
    and (timezone('America/Costa_Rica', e.occurred_at))::date between d_from and today;

  -- Extras >8 h/día pendientes de planilla
  begin
   select coalesce((public.list_attendance_ot_alerts(d_from, today)->>'count')::int, 0) into n_ot;
  exception when undefined_function then
   n_ot := 0;
  end;

  return coalesce(n_open,0) + coalesce(n_photo,0) + coalesce(n_ot,0);
 end;
$$;

revoke execute on function public.count_attendance_alerts() from public,anon;
grant execute on function public.count_attendance_alerts() to authenticated;

commit;
