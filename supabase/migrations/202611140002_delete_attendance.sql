-- Admin: borrar jornada completa o solo la marca de salida (con motivo y auditoría).
begin;

create function public.delete_attendance_session(
  p_session uuid,
  p_reason text,
  p_scope text default 'session'
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.attendance_sessions;
  ev_count integer;
  scope text:=lower(trim(coalesce(p_scope,'session')));
  snap jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Indica un motivo de al menos 5 caracteres.';
  end if;
  if scope not in ('session','exit') then
    raise exception 'Ámbito inválido. Usa session o exit.';
  end if;

  select * into s from public.attendance_sessions where id=p_session for update;
  if s.id is null then
    raise exception 'Jornada no encontrada';
  end if;

  if exists(
    select 1 from public.payroll_runs
    where status='closed'
      and (s.started_at at time zone 'America/Costa_Rica')::date between period_start and period_end
  ) then
    raise exception 'La jornada pertenece a una planilla cerrada';
  end if;

  select count(*)::integer into ev_count from public.attendance_events where session_id=s.id;

  snap:=jsonb_build_object(
    'session',to_jsonb(s),
    'events',coalesce((
      select jsonb_agg(to_jsonb(e) order by e.occurred_at)
      from public.attendance_events e where e.session_id=s.id
    ),'[]'::jsonb),
    'adjustment',(
      select to_jsonb(a) from public.attendance_adjustments a where a.session_id=s.id
    ),
    'scope',scope,
    'reason',trim(p_reason),
    'event_count',ev_count
  );

  insert into public.audit_log(table_name,record_id,operation,before_data,after_data)
  values(
    'attendance_sessions',
    s.id::text,
    case when scope='exit' then 'DELETE_EXIT' else 'DELETE_SESSION' end,
    snap,
    null
  );

  if scope='exit' then
    if s.ended_at is null then
      raise exception 'Esta jornada no tiene marca de salida.';
    end if;
    if exists(
      select 1 from public.attendance_sessions
      where employee_id=s.employee_id and ended_at is null and id<>s.id
    ) then
      raise exception 'El empleado ya tiene otra jornada abierta. No se puede reabrir esta.';
    end if;

    delete from public.attendance_adjustments where session_id=s.id;
    delete from public.attendance_events where session_id=s.id and kind='exit';
    update public.attendance_sessions
      set ended_at=null, break_started_at=null
    where id=s.id;
    return;
  end if;

  -- Borrar jornada completa (entrada, descansos, salida, fotos y ajuste).
  delete from public.attendance_adjustments where session_id=s.id;
  delete from public.attendance_events where session_id=s.id;
  delete from public.attendance_sessions where id=s.id;
end;
$$;

revoke all on function public.delete_attendance_session(uuid,text,text) from public,anon;
grant execute on function public.delete_attendance_session(uuid,text,text) to authenticated;

commit;
