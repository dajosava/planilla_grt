begin;
-- Horas extra desde asistencia (>8 h/día) con aprobación del admin.

alter table public.payroll_items
  add column if not exists suggested_ot_hours numeric(6,2) not null default 0
    check (suggested_ot_hours between 0 and 400),
  add column if not exists ot_status text not null default 'none'
    check (ot_status in ('none','pending','approved','rejected'));

create table if not exists public.payroll_ot_days (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.payroll_items(id) on delete cascade,
 work_date date not null,
 worked_hours numeric(6,2) not null check (worked_hours >= 0 and worked_hours <= 24),
 ot_hours numeric(6,2) not null check (ot_hours >= 0 and ot_hours <= 16),
 unique (item_id, work_date)
);

create index if not exists payroll_ot_days_item on public.payroll_ot_days(item_id);

alter table public.payroll_ot_days enable row level security;
revoke all on public.payroll_ot_days from anon, authenticated;
grant select on public.payroll_ot_days to authenticated;
drop policy if exists admin_ot_days_read on public.payroll_ot_days;
create policy admin_ot_days_read on public.payroll_ot_days
 for select to authenticated using (public.is_admin());

-- Recalcula montos OT de un ítem (helper interno)
create or replace function public._payroll_apply_ot(p_item_id uuid, p_ot_hours numeric)
 returns void language plpgsql security definer set search_path='' as $$
 declare it public.payroll_items;
  v_ot bigint; v_dbl bigint; v_add bigint; v_ccss bigint; v_ded bigint;
 begin
  select * into it from public.payroll_items where id=p_item_id for update;
  if not found then raise exception 'Ítem no encontrado'; end if;
  v_ot := round(coalesce(p_ot_hours,0) * it.hourly_rate_cents * 1.5)::bigint;
  v_dbl := round(coalesce(it.double_hours,0) * coalesce(nullif(it.double_rate_cents,0), it.hourly_rate_cents*2))::bigint;
  v_add := v_ot + v_dbl + coalesce(it.other_pay_cents,0);
  v_ccss := case when it.exempt_from_ccss then 0 else round(it.base_cents * 0.1083)::bigint end;
  v_ded := v_ccss + coalesce(it.shortage_cents,0) + coalesce(it.receipt_cents,0) + coalesce(it.other_deduction_cents,0);
  if v_ded > it.base_cents + v_add then raise exception 'Las deducciones superan el salario bruto'; end if;
  update public.payroll_items set
   ot_hours=coalesce(p_ot_hours,0),
   ot_amount_cents=v_ot,
   addition_cents=v_add,
   ccss_cents=v_ccss,
   deduction_cents=v_ded
  where id=p_item_id;
 end;
$$;

-- Sincroniza sugerencias OT desde effective_sessions (jornada > 8 h)
create or replace function public.sync_payroll_ot_from_attendance(p_run_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  r public.payroll_runs;
  it public.payroll_items;
  v_suggested numeric;
  n_pending int:=0;
  n_items int:=0;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se pueden sincronizar extras en planillas en borrador'; end if;

  for it in select * from public.payroll_items where run_id=p_run_id loop
   n_items:=n_items+1;
   delete from public.payroll_ot_days where item_id=it.id;

   insert into public.payroll_ot_days(item_id, work_date, worked_hours, ot_hours)
   select it.id, d.work_date, d.hours, greatest(d.hours - 8, 0)
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
     -- Solo actualiza la sugerencia; mantiene OT ya aprobado
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

create or replace function public.approve_payroll_ot(p_item_id uuid, p_hours numeric default null)
 returns void language plpgsql security definer set search_path='' as $$
 declare it public.payroll_items; rid uuid; v_hours numeric;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into it from public.payroll_items where id=p_item_id for update;
  if not found then raise exception 'Ítem no encontrado'; end if;
  select run_id into rid from public.payroll_items where id=p_item_id;
  perform 1 from public.payroll_runs where id=rid and status='draft' for update;
  if not found then raise exception 'La planilla ya está cerrada'; end if;

  v_hours := coalesce(p_hours, it.suggested_ot_hours, 0);
  if v_hours < 0 or v_hours > 400 then raise exception 'Horas extra fuera de rango'; end if;
  if coalesce(it.suggested_ot_hours,0) <= 0 and coalesce(p_hours,0) <= 0 then
   raise exception 'No hay horas extra sugeridas para aprobar';
  end if;

  perform public._payroll_apply_ot(p_item_id, v_hours);
  update public.payroll_items set ot_status='approved' where id=p_item_id;
 end;
$$;

create or replace function public.reject_payroll_ot(p_item_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
 declare rid uuid;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select run_id into rid from public.payroll_items where id=p_item_id;
  if rid is null then raise exception 'Ítem no encontrado'; end if;
  perform 1 from public.payroll_runs where id=rid and status='draft' for update;
  if not found then raise exception 'La planilla ya está cerrada'; end if;

  perform public._payroll_apply_ot(p_item_id, 0);
  update public.payroll_items set ot_status='rejected' where id=p_item_id;
 end;
$$;

create or replace function public.count_pending_payroll_ot()
 returns integer language plpgsql security definer set search_path='' as $$
 declare n int;
 begin
  if not public.is_admin() then return 0; end if;
  select count(*)::int into n
  from public.payroll_items i
  join public.payroll_runs r on r.id=i.run_id
  where r.status='draft' and i.ot_status='pending';
  return coalesce(n,0);
 end;
$$;

-- Al cerrar: no permitir pendientes de OT
create or replace function public.close_payroll(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r public.payroll_runs; pending int;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.payroll_runs where id=p_id for update;
  if not found then raise exception 'Planilla no encontrada'; end if;
  if r.status<>'draft' then raise exception 'La planilla ya está cerrada'; end if;
  if exists(select 1 from public.payroll_items where run_id=p_id and not reviewed) then
   raise exception 'Revisa todos los empleados antes de cerrar';
  end if;
  select count(*)::int into pending from public.payroll_items where run_id=p_id and ot_status='pending';
  if coalesce(pending,0) > 0 then
   raise exception 'Hay % empleado(s) con horas extra pendientes de aprobar', pending;
  end if;
  if exists(select 1 from public.effective_sessions where ended_at is null and started_at<((r.period_end+1)::timestamp at time zone 'America/Costa_Rica')) then
   raise exception 'Hay jornadas abiertas anteriores al cierre';
  end if;
  update public.payroll_runs set status='closed', closed_at=now() where id=p_id;
 end;
$$;

-- update_payroll_item: edición manual marca OT como aprobado
create or replace function public.update_payroll_item(
 p_id uuid,
 p_ot_hours numeric,
 p_double_hours numeric,
 p_other_pay bigint,
 p_shortage bigint,
 p_receipt bigint,
 p_other_deduction bigint,
 p_note text,
 p_reviewed boolean
) returns void language plpgsql security definer set search_path='' as $$
 declare rid uuid; it public.payroll_items;
  v_ot bigint; v_dbl bigint; v_add bigint; v_ccss bigint; v_ded bigint;
  v_ot_status text;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into it from public.payroll_items where id=p_id for update;
  if not found then raise exception 'Ítem no encontrado'; end if;
  select run_id into rid from public.payroll_items where id=p_id;
  perform 1 from public.payroll_runs where id=rid and status='draft' for update;
  if not found then raise exception 'La planilla ya está cerrada'; end if;
  if coalesce(p_ot_hours,0) < 0 or coalesce(p_double_hours,0) < 0 then raise exception 'Las horas no pueden ser negativas'; end if;
  v_ot := round(coalesce(p_ot_hours,0) * it.hourly_rate_cents * 1.5)::bigint;
  v_dbl := round(coalesce(p_double_hours,0) * coalesce(nullif(it.double_rate_cents,0), it.hourly_rate_cents*2))::bigint;
  v_add := v_ot + v_dbl + coalesce(p_other_pay,0);
  v_ccss := case when it.exempt_from_ccss then 0 else round(it.base_cents * 0.1083)::bigint end;
  v_ded := v_ccss + coalesce(p_shortage,0) + coalesce(p_receipt,0) + coalesce(p_other_deduction,0);
  if v_ded > it.base_cents + v_add then raise exception 'Las deducciones superan el salario bruto'; end if;

  if coalesce(p_ot_hours,0) > 0 or it.ot_status in ('pending','approved','rejected') then
   v_ot_status := 'approved';
  else
   v_ot_status := it.ot_status;
  end if;

  update public.payroll_items set
   ot_hours=coalesce(p_ot_hours,0),
   ot_amount_cents=v_ot,
   double_hours=coalesce(p_double_hours,0),
   double_amount_cents=v_dbl,
   other_pay_cents=coalesce(p_other_pay,0),
   addition_cents=v_add,
   ccss_cents=v_ccss,
   shortage_cents=coalesce(p_shortage,0),
   receipt_cents=coalesce(p_receipt,0),
   other_deduction_cents=coalesce(p_other_deduction,0),
   deduction_cents=v_ded,
   note=coalesce(p_note,''),
   reviewed=coalesce(p_reviewed,false),
   ot_status=v_ot_status
  where id=p_id;
 end;
$$;

-- Tras crear quincena, sincronizar OT automáticamente
create or replace function public.create_payroll_fortnight(p_month date, p_half int, p_company text)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid; v_start date; v_end date; v_last int; n int;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_company not in ('Gasolinera','Supermercado','Transporte') then
   raise exception 'La planilla debe ser de Gasolinera, Supermercado o Transporte';
  end if;
  if p_half not in (1,2) then raise exception 'La quincena debe ser 1 (1–15) o 2 (16–fin)'; end if;
  if p_month <> date_trunc('month',p_month)::date then raise exception 'Indica el primer día del mes'; end if;
  v_last := extract(day from (p_month + interval '1 month' - interval '1 day'))::int;
  if p_half = 1 then
   v_start := p_month;
   v_end := p_month + 14;
  else
   v_start := p_month + 15;
   v_end := (p_month + (v_last - 1) * interval '1 day')::date;
  end if;
  insert into public.payroll_runs(period_start,period_end,kind,company)
  values(v_start,v_end,'fortnight',p_company) returning id into rid;
  insert into public.payroll_items(
   run_id,employee_id,employee_name,employee_code,employee_email,
   base_cents,hours_month,hourly_rate_cents,double_rate_cents,ccss_cents,exempt_from_ccss,
   addition_cents,deduction_cents
  )
  select
   rid,e.id,e.full_name,e.code,e.email,
   round(e.monthly_salary_cents::numeric/2)::bigint,
   e.hours_per_month,
   public._crc_hourly(e.monthly_salary_cents,e.hours_per_month),
   public._crc_hourly(e.monthly_salary_cents,e.hours_per_month)*2,
   case when e.exempt_from_ccss then 0
        else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint end,
   e.exempt_from_ccss,
   0,
   case when e.exempt_from_ccss then 0
        else round(round(e.monthly_salary_cents::numeric/2) * 0.1083)::bigint end
  from public.employees e where e.active and e.department=p_company;
  get diagnostics n = row_count;
  if n = 0 then
   delete from public.payroll_runs where id=rid;
   raise exception 'No hay empleados activos en %', p_company;
  end if;
  perform public.sync_payroll_ot_from_attendance(rid);
  return rid;
 end;
$$;

revoke execute on function public.sync_payroll_ot_from_attendance(uuid) from public,anon;
revoke execute on function public.approve_payroll_ot(uuid,numeric) from public,anon;
revoke execute on function public.reject_payroll_ot(uuid) from public,anon;
revoke execute on function public.count_pending_payroll_ot() from public,anon;
grant execute on function public.sync_payroll_ot_from_attendance(uuid) to authenticated;
grant execute on function public.approve_payroll_ot(uuid,numeric) to authenticated;
grant execute on function public.reject_payroll_ot(uuid) to authenticated;
grant execute on function public.count_pending_payroll_ot() to authenticated;

commit;
