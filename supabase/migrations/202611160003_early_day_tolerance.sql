-- Tolerancia 20 min antes de las 05:00 CR para clasificación diurna.
-- Entrada 04:40–04:59: el conteo diurno/nocturno usa 05:00; workedMinutes sigue con la hora real.

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
  classify_from timestamptz;
  hr int;
  mn int;
  kind text;
  lim int;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return jsonb_build_object('error','Intervalo inválido');
  end if;

  worked := greatest(0, round(extract(epoch from p_end - p_start) / 60.0)::int);

  -- Tolerancia: 04:40–04:59 CR → clasificar desde 05:00 CR del mismo instante calendario.
  hr := extract(hour from (p_start at time zone 'America/Costa_Rica'))::int;
  mn := extract(minute from (p_start at time zone 'America/Costa_Rica'))::int;
  if hr = 4 and mn >= 40 then
    classify_from := p_start + make_interval(mins => (60 - mn));
  else
    classify_from := p_start;
  end if;

  ts := classify_from;
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

revoke all on function public.classify_shift_cr(timestamptz,timestamptz) from public,anon;
grant execute on function public.classify_shift_cr(timestamptz,timestamptz) to authenticated;
