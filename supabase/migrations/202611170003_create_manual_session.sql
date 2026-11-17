-- Registrar jornada faltante (sin marcación en tablet): crea sesión + ajuste auditado.

create or replace function public.create_manual_session(
  p_employee uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_break integer,
  p_reason text
) returns uuid
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  e public.employees;
  sid uuid;
  overlap_id uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'La salida debe ser posterior a la entrada';
  end if;
  if coalesce(p_break, 0) < 0 or p_break > 1440 then
    raise exception 'Descanso inválido';
  end if;
  if extract(epoch from p_end - p_start) < coalesce(p_break, 0) * 60 then
    raise exception 'El descanso no puede ser mayor que la jornada';
  end if;
  if extract(epoch from p_end - p_start) > 86400 then
    raise exception 'La jornada no puede superar 24 horas';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Indica un motivo de al menos 5 caracteres';
  end if;

  select * into e from public.employees where id = p_employee for update;
  if e.id is null then
    raise exception 'Empleado no encontrado';
  end if;
  if not e.active then
    raise exception 'El empleado está inactivo';
  end if;

  if exists(
    select 1 from public.payroll_runs
    where status = 'closed'
      and (
        (p_start at time zone 'America/Costa_Rica')::date between period_start and period_end
        or (p_end at time zone 'America/Costa_Rica')::date between period_start and period_end
      )
  ) then
    raise exception 'La jornada pertenece a una planilla cerrada';
  end if;

  if exists(
    select 1 from public.attendance_sessions
    where employee_id = p_employee and ended_at is null
  ) then
    raise exception 'El empleado tiene una jornada abierta. Cerrala o corregila antes de registrar otra.';
  end if;

  select s.id into overlap_id
  from public.attendance_sessions s
  left join public.attendance_adjustments a on a.session_id = s.id
  where s.employee_id = p_employee
    and coalesce(a.ended_at, s.ended_at) is not null
    and tstzrange(
          coalesce(a.started_at, s.started_at),
          coalesce(a.ended_at, s.ended_at),
          '[)'
        ) && tstzrange(p_start, p_end, '[)')
  limit 1;

  if overlap_id is not null then
    raise exception 'Ya existe una jornada que se solapa con ese horario. Corregí o borrá la existente.';
  end if;

  insert into public.attendance_sessions(employee_id, started_at, ended_at, break_seconds)
  values (p_employee, p_start, p_end, coalesce(p_break, 0) * 60)
  returning id into sid;

  insert into public.attendance_adjustments(session_id, started_at, ended_at, break_minutes, reason)
  values (sid, p_start, p_end, coalesce(p_break, 0), trim(p_reason));

  return sid;
end;
$$;

revoke execute on function public.create_manual_session(uuid,timestamptz,timestamptz,integer,text) from public,anon;
grant execute on function public.create_manual_session(uuid,timestamptz,timestamptz,integer,text) to authenticated;
