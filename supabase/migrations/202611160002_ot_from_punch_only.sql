-- Clasificación OT solo por marcación real (ya no se usa el módulo / tabla de turnos planificados).

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
  classified jsonb;
  lim_h numeric;
  raw_ot numeric;
  ot numeric;
  grace_h numeric := 0.5; -- 30 minutos
begin
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    return jsonb_build_object('error','Ventana inválida');
  end if;

  -- Ignora p_employee / p_work_date para lookup de shifts: la jornada sale de la ventana real.
  classified := public.classify_shift_cr(p_window_start, p_window_end);

  if classified ? 'error' then
    return classified;
  end if;

  lim_h := (classified->>'legalOrdinaryLimitHours')::numeric;
  raw_ot := greatest(coalesce(p_worked_hours,0) - lim_h, 0);
  ot := case when raw_ot < grace_h then 0 else least(raw_ot, 16) end;

  return classified || jsonb_build_object(
    'scheduled', false,
    'needs_review', false,
    'ordinaryLimitHours', lim_h,
    'otGraceHours', grace_h,
    'otHours', round(ot, 2),
    'workedHours', round(coalesce(p_worked_hours,0), 2)
  );
end;
$$;

revoke all on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) from public,anon;
grant execute on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) to authenticated;
