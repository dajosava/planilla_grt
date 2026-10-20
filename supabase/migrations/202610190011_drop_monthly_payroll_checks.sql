-- Los checks mensuales originales usan '1 mon' (no '1 month'), por eso
-- seguían activos y bloqueaban la 2ª quincena (period_start = día 16).

begin;

do $$
declare r record;
begin
 for r in
  select c.conname, pg_get_constraintdef(c.oid) as def
  from pg_constraint c
  where c.conrelid = 'public.payroll_runs'::regclass
    and c.contype = 'c'
 loop
  -- Conservar checks explícitos de kind/company/status
  if r.conname in (
   'payroll_runs_kind_check',
   'payroll_runs_company_check',
   'payroll_runs_status_check'
  ) then
   continue;
  end if;
  -- Tirar cualquier check de período / mes / date_trunc (nombres auto o viejos)
  if r.def ilike '%period_%'
     or r.def ilike '%date_trunc%'
     or r.def ilike '%mon%'
     or r.conname ilike '%period%'
     or r.conname ~ '^payroll_runs_check'
  then
   execute format('alter table public.payroll_runs drop constraint %I', r.conname);
  end if;
 end loop;
end $$;

-- Reponer solo los checks válidos para quincenas
do $$ begin
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_order') then
  alter table public.payroll_runs
   add constraint payroll_runs_period_order check (period_end >= period_start);
 end if;
 if not exists(select 1 from pg_constraint where conname='payroll_runs_period_span') then
  alter table public.payroll_runs
   add constraint payroll_runs_period_span check (period_end <= period_start + 31);
 end if;
 if not exists(
  select 1 from pg_constraint
  where conrelid='public.payroll_runs'::regclass
    and contype='c'
    and pg_get_constraintdef(oid) ilike '%status%'
 ) then
  alter table public.payroll_runs
   add constraint payroll_runs_status_check check (status in ('draft','closed'));
 end if;
end $$;

commit;
