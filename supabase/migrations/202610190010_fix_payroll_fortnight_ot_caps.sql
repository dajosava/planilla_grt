-- Fix: crear 2ª quincena fallaba con 23514 cuando asistencia tenía
-- jornadas >24 h/día (o check mensual viejo en payroll_runs).

begin;

-- 1) Quitar checks solo-mensuales si todavía existen
do $$
declare r record;
begin
 for r in
  select c.conname
  from pg_constraint c
  where c.conrelid='public.payroll_runs'::regclass
    and c.contype='c'
    and (
     pg_get_constraintdef(c.oid) ilike '%date_trunc%month%'
     or pg_get_constraintdef(c.oid) ilike '%1 month%'
    )
 loop
  execute format('alter table public.payroll_runs drop constraint %I', r.conname);
 end loop;
end $$;

-- Asegurar checks de quincena
do $$ begin
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_order') then
  alter table public.payroll_runs add constraint payroll_runs_period_order check (period_end >= period_start);
 end if;
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_span') then
  alter table public.payroll_runs add constraint payroll_runs_period_span check (period_end <= period_start + 31);
 end if;
end $$;

-- 2) Sync OT: tope de horas por día + mensaje claro
create or replace function public.sync_payroll_ot_from_attendance(p_run_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  r public.payroll_runs;
  it public.payroll_items;
  v_suggested numeric;
  n_pending int:=0;
  n_items int:=0;
  bad record;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se pueden sincronizar extras en planillas en borrador'; end if;

  for it in select * from public.payroll_items where run_id=p_run_id loop
   n_items:=n_items+1;
   delete from public.payroll_ot_days where item_id=it.id;

   -- Detectar jornadas absurdas (suele ser marcación sin salida corregida mal)
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

   insert into public.payroll_ot_days(item_id, work_date, worked_hours, ot_hours)
   select
    it.id,
    d.work_date,
    least(d.hours, 24),
    least(greatest(d.hours - 8, 0), 16)
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
   where d.hours > 8;

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

revoke execute on function public.sync_payroll_ot_from_attendance(uuid) from public,anon;
grant execute on function public.sync_payroll_ot_from_attendance(uuid) to authenticated;

commit;
