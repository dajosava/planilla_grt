-- Aguinaldo por sociedad: acumulación (dic N-1 → nov N) / 12
-- Bruto = base + extras (1.5× y doble) + otros pagos salariales.

begin;

create table if not exists public.aguinaldo_runs (
 id uuid primary key default gen_random_uuid(),
 company text not null check (company in ('Gasolinera','Supermercado','Transporte')),
 year int not null check (year between 2000 and 2100),
 period_start date not null,
 period_end date not null,
 status text not null default 'draft' check (status in ('draft','closed')),
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 unique (company, year),
 check (period_end > period_start),
 check (period_start = make_date(year - 1, 12, 1)),
 check (period_end = make_date(year, 11, 30))
);

create table if not exists public.aguinaldo_items (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.aguinaldo_runs(id) on delete cascade,
 employee_id uuid not null references public.employees(id),
 employee_name text not null,
 employee_code text not null,
 ordinary_cents bigint not null default 0 check (ordinary_cents >= 0),
 extras_cents bigint not null default 0 check (extras_cents >= 0),
 other_pay_cents bigint not null default 0 check (other_pay_cents >= 0),
 gross_accum_cents bigint not null default 0 check (gross_accum_cents >= 0),
 aguinaldo_cents bigint not null default 0 check (aguinaldo_cents >= 0),
 adjustment_cents bigint not null default 0
  check (adjustment_cents between -10000000000 and 10000000000),
 payable_cents bigint not null default 0 check (payable_cents >= 0),
 note text not null default '' check (length(note) <= 2000),
 reviewed boolean not null default false,
 unique (run_id, employee_id)
);

create index if not exists aguinaldo_items_run_id_idx on public.aguinaldo_items (run_id);
create index if not exists aguinaldo_runs_company_year_idx on public.aguinaldo_runs (company, year desc);

alter table public.aguinaldo_runs enable row level security;
alter table public.aguinaldo_items enable row level security;
revoke all on public.aguinaldo_runs from anon, authenticated;
revoke all on public.aguinaldo_items from anon, authenticated;
grant select on public.aguinaldo_runs to authenticated;
grant select on public.aguinaldo_items to authenticated;

drop policy if exists admin_aguinaldo_runs_read on public.aguinaldo_runs;
create policy admin_aguinaldo_runs_read on public.aguinaldo_runs
 for select to authenticated using (public.is_admin());

drop policy if exists admin_aguinaldo_items_read on public.aguinaldo_items;
create policy admin_aguinaldo_items_read on public.aguinaldo_items
 for select to authenticated using (public.is_admin());

-- Recalcula ítems desde quincenas cerradas del período
create or replace function public.sync_aguinaldo_run(p_run_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare
  r public.aguinaldo_runs;
  n int := 0;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.aguinaldo_runs where id = p_run_id for update;
  if not found then raise exception 'Corrida de aguinaldo no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'Solo se puede sincronizar un borrador'; end if;

  with accum as (
   select
    i.employee_id,
    coalesce(max(nullif(trim(i.employee_name),'')), max(e.full_name), 'Sin nombre') as employee_name,
    coalesce(max(nullif(trim(i.employee_code),'')), max(e.code), '') as employee_code,
    coalesce(sum(i.base_cents), 0)::bigint as ordinary_cents,
    coalesce(sum(i.ot_amount_cents + i.double_amount_cents), 0)::bigint as extras_cents,
    coalesce(sum(i.other_pay_cents), 0)::bigint as other_pay_cents
   from public.payroll_items i
   join public.payroll_runs pr on pr.id = i.run_id
   left join public.employees e on e.id = i.employee_id
   where pr.status = 'closed'
     and pr.company = r.company
     and pr.period_start <= r.period_end
     and pr.period_end >= r.period_start
   group by i.employee_id
  ),
  upserted as (
   insert into public.aguinaldo_items (
    run_id, employee_id, employee_name, employee_code,
    ordinary_cents, extras_cents, other_pay_cents,
    gross_accum_cents, aguinaldo_cents, payable_cents
   )
   select
    r.id,
    a.employee_id,
    a.employee_name,
    a.employee_code,
    a.ordinary_cents,
    a.extras_cents,
    a.other_pay_cents,
    (a.ordinary_cents + a.extras_cents + a.other_pay_cents),
    round((a.ordinary_cents + a.extras_cents + a.other_pay_cents) / 12.0)::bigint,
    greatest(0, round((a.ordinary_cents + a.extras_cents + a.other_pay_cents) / 12.0)::bigint)
   from accum a
   on conflict (run_id, employee_id) do update set
    employee_name = excluded.employee_name,
    employee_code = excluded.employee_code,
    ordinary_cents = excluded.ordinary_cents,
    extras_cents = excluded.extras_cents,
    other_pay_cents = excluded.other_pay_cents,
    gross_accum_cents = excluded.gross_accum_cents,
    aguinaldo_cents = excluded.aguinaldo_cents,
    payable_cents = greatest(0, excluded.aguinaldo_cents + public.aguinaldo_items.adjustment_cents),
    reviewed = case
     when public.aguinaldo_items.gross_accum_cents is distinct from excluded.gross_accum_cents
      then false
     else public.aguinaldo_items.reviewed
    end
   returning 1
  )
  select count(*)::int into n from upserted;

  delete from public.aguinaldo_items ai
  where ai.run_id = r.id
    and not exists (
     select 1 from public.payroll_items i
     join public.payroll_runs pr on pr.id = i.run_id
     where i.employee_id = ai.employee_id
       and pr.status = 'closed'
       and pr.company = r.company
       and pr.period_start <= r.period_end
       and pr.period_end >= r.period_start
    );

  return jsonb_build_object('ok', true, 'employees', n);
 end;
$$;

create or replace function public.create_aguinaldo_run(p_year int, p_company text)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare
  rid uuid;
  d_start date;
  d_end date;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_company not in ('Gasolinera','Supermercado','Transporte') then
   raise exception 'Sociedad no válida';
  end if;
  if p_year < 2000 or p_year > 2100 then
   raise exception 'Año no válido';
  end if;

  d_start := make_date(p_year - 1, 12, 1);
  d_end := make_date(p_year, 11, 30);

  insert into public.aguinaldo_runs(company, year, period_start, period_end, status)
  values (p_company, p_year, d_start, d_end, 'draft')
  returning id into rid;

  perform public.sync_aguinaldo_run(rid);
  return rid;
 exception
  when unique_violation then
   raise exception 'Ya existe el aguinaldo % de %', p_year, p_company;
 end;
$$;

create or replace function public.update_aguinaldo_item(
 p_id uuid,
 p_adjustment_cents bigint,
 p_note text,
 p_reviewed boolean
) returns void language plpgsql security definer set search_path='' as $$
 declare
  it public.aguinaldo_items;
  rid uuid;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into it from public.aguinaldo_items where id = p_id for update;
  if not found then raise exception 'Ítem de aguinaldo no encontrado'; end if;
  select run_id into rid from public.aguinaldo_items where id = p_id;
  perform 1 from public.aguinaldo_runs where id = rid and status = 'draft' for update;
  if not found then raise exception 'Solo se edita un borrador'; end if;

  update public.aguinaldo_items set
   adjustment_cents = coalesce(p_adjustment_cents, 0),
   note = coalesce(left(trim(p_note), 2000), ''),
   reviewed = coalesce(p_reviewed, false),
   payable_cents = greatest(0, aguinaldo_cents + coalesce(p_adjustment_cents, 0))
  where id = p_id;
 end;
$$;

create or replace function public.close_aguinaldo_run(p_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
 declare
  r public.aguinaldo_runs;
  pending int;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.aguinaldo_runs where id = p_id for update;
  if not found then raise exception 'Corrida de aguinaldo no encontrada'; end if;
  if r.status <> 'draft' then raise exception 'La corrida ya está cerrada'; end if;
  if not exists(select 1 from public.aguinaldo_items where run_id = p_id) then
   raise exception 'No hay empleados en esta corrida. Sincronizá desde quincenas cerradas.';
  end if;
  select count(*)::int into pending
  from public.aguinaldo_items where run_id = p_id and not reviewed;
  if pending > 0 then
   raise exception 'Faltan % empleado(s) por revisar', pending;
  end if;
  update public.aguinaldo_runs set status = 'closed', closed_at = now() where id = p_id;
 end;
$$;

create or replace function public.delete_aguinaldo_run(p_id uuid, p_confirm text)
 returns void language plpgsql security definer set search_path='' as $$
 declare
  r public.aguinaldo_runs;
  expected text;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into r from public.aguinaldo_runs where id = p_id for update;
  if not found then raise exception 'Corrida de aguinaldo no encontrada'; end if;
  expected := upper(trim(coalesce(r.company, '')));
  if upper(trim(coalesce(p_confirm, ''))) is distinct from expected then
   raise exception 'Para confirmar, escribí exactamente: %', r.company;
  end if;
  delete from public.aguinaldo_items where run_id = p_id;
  delete from public.aguinaldo_runs where id = p_id;
 end;
$$;

revoke execute on function public.sync_aguinaldo_run(uuid) from public, anon;
grant execute on function public.sync_aguinaldo_run(uuid) to authenticated;
revoke execute on function public.create_aguinaldo_run(int, text) from public, anon;
grant execute on function public.create_aguinaldo_run(int, text) to authenticated;
revoke execute on function public.update_aguinaldo_item(uuid, bigint, text, boolean) from public, anon;
grant execute on function public.update_aguinaldo_item(uuid, bigint, text, boolean) to authenticated;
revoke execute on function public.close_aguinaldo_run(uuid) from public, anon;
grant execute on function public.close_aguinaldo_run(uuid) to authenticated;
revoke execute on function public.delete_aguinaldo_run(uuid, text) from public, anon;
grant execute on function public.delete_aguinaldo_run(uuid, text) to authenticated;

commit;
