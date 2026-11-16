-- Umbral de 30 min para registrar horas extra.
-- Exceso < 0.5 h → ot_hours = 0; exceso ≥ 0.5 h → se registra el total del exceso.

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
  raw_ot numeric;
  ot numeric;
  grace_h numeric := 0.5; -- 30 minutos
begin
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    return jsonb_build_object('error','Ventana inválida');
  end if;

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
  raw_ot := greatest(coalesce(p_worked_hours,0) - lim_h, 0);
  -- Menos de 30 min → 0; 30 min o más → se registra todo el exceso.
  ot := case when raw_ot < grace_h then 0 else least(raw_ot, 16) end;

  return classified || jsonb_build_object(
    'scheduled', scheduled,
    'needs_review', needs_review,
    'ordinaryLimitHours', lim_h,
    'otGraceHours', grace_h,
    'otHours', round(ot, 2),
    'workedHours', round(coalesce(p_worked_hours,0), 2)
  );
end;
$$;

revoke all on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) from public,anon;
grant execute on function public.shift_ot_context(uuid,date,timestamptz,timestamptz,numeric) to authenticated;
