begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create type public.app_role as enum ('admin','kiosk');
create type public.punch_kind as enum ('entry','exit','break_start','break_end');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null, role public.app_role not null
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create table public.devices (
 id uuid primary key default gen_random_uuid(), user_id uuid unique not null references public.profiles(id),
 name text not null, active boolean not null default true,
 failed_attempts integer not null default 0, window_started_at timestamptz not null default now()
);
create table public.employees (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^[A-Z0-9-]{2,12}$'),
 full_name text not null check(length(full_name) between 3 and 120),
 department text not null check(department in ('Pista','Supermercado','Tienda','Transporte','Administración')),
 position text not null, monthly_salary_cents bigint not null check(monthly_salary_cents between 0 and 10000000000),
 vacation_balance numeric(6,2) not null default 0 check(vacation_balance>=0),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.employee_secrets (
 employee_id uuid primary key references public.employees(id), pin_hash text not null
);
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
 started_at timestamptz not null, ended_at timestamptz,
 break_started_at timestamptz, break_seconds integer not null default 0 check(break_seconds>=0),
 check(ended_at is null or ended_at>=started_at)
);
create unique index one_open_session on public.attendance_sessions(employee_id) where ended_at is null;
create index sessions_employee_time on public.attendance_sessions(employee_id,started_at);
create table public.attendance_events (
 id uuid primary key, employee_id uuid not null references public.employees(id),
 device_id uuid not null references public.devices(id), session_id uuid not null references public.attendance_sessions(id),
 kind public.punch_kind not null, occurred_at timestamptz not null default now()
);
create index events_time on public.attendance_events(occurred_at desc);
create table public.attendance_adjustments (
 id uuid primary key default gen_random_uuid(), session_id uuid unique not null references public.attendance_sessions(id),
 started_at timestamptz not null, ended_at timestamptz not null,
 break_minutes integer not null check(break_minutes>=0), reason text not null check(length(reason)>=5),
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(),
 check(ended_at>started_at), check(extract(epoch from ended_at-started_at)>=break_minutes*60)
);
create view public.effective_sessions with (security_invoker=true) as
 select s.id,s.employee_id,coalesce(a.started_at,s.started_at) started_at,
 coalesce(a.ended_at,s.ended_at) ended_at,
 case when a.id is not null then a.break_minutes*60 else s.break_seconds end break_seconds,
 a.id is not null adjusted,
 case when coalesce(a.ended_at,s.ended_at) is not null then
 greatest(0,extract(epoch from coalesce(a.ended_at,s.ended_at)-coalesce(a.started_at,s.started_at))-
 case when a.id is not null then a.break_minutes*60 else s.break_seconds end)/3600 end worked_hours
 from public.attendance_sessions s left join public.attendance_adjustments a on a.session_id=s.id;
create table public.shifts (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
 starts_at timestamptz not null, ends_at timestamptz not null, note text not null default '',
 check(ends_at>starts_at), check(ends_at<=starts_at+interval '24 hours')
);
create index shifts_time on public.shifts(starts_at);
create table public.absences (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
 kind text not null check(kind in ('vacation','sick','permission')),
 starts_on date not null, ends_on date not null, vacation_days numeric(6,2) not null default 0 check(vacation_days>=0),
 note text not null default '', status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 check(ends_on>=starts_on), check(kind='vacation' or vacation_days=0),
 check(kind<>'vacation' or vacation_days>0)
);
create table public.vacation_movements (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
 days numeric(6,2) not null check(days<>0), reason text not null check(length(reason)>=5),
 absence_id uuid unique references public.absences(id), created_by uuid default auth.uid(), created_at timestamptz default now()
);
create table public.payroll_runs (
 id uuid primary key default gen_random_uuid(), period_start date not null unique,
 period_end date not null, status text not null default 'draft' check(status in ('draft','closed')),
 created_at timestamptz not null default now(), created_by uuid default auth.uid(), closed_at timestamptz,
 check(period_start=date_trunc('month',period_start)::date),
 check(period_end=(period_start+interval '1 month'-interval '1 day')::date)
);
create table public.payroll_items (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.payroll_runs(id),
 employee_id uuid not null references public.employees(id), employee_name text not null, employee_code text not null,
 base_cents bigint not null check(base_cents between 0 and 10000000000),
 addition_cents bigint not null default 0 check(addition_cents between 0 and 10000000000),
 deduction_cents bigint not null default 0 check(deduction_cents between 0 and 10000000000),
 gross_cents bigint generated always as (base_cents+addition_cents) stored,
 net_cents bigint generated always as (base_cents+addition_cents-deduction_cents) stored,
 note text not null default '', reviewed boolean not null default false,
 unique(run_id,employee_id), check(deduction_cents<=base_cents+addition_cents)
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor uuid default auth.uid(),
 table_name text not null, record_id text not null, operation text not null,
 before_data jsonb, after_data jsonb, occurred_at timestamptz not null default now()
);
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.audit_log(table_name,record_id,operation,before_data,after_data)
 values(TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'),TG_OP,
 case when TG_OP<>'INSERT' then to_jsonb(OLD) end,case when TG_OP<>'DELETE' then to_jsonb(NEW) end);
 return coalesce(NEW,OLD);
 end;
$$;
do $$ declare t text; begin
 foreach t in array array['employees','shifts','absences','attendance_adjustments','vacation_movements','payroll_runs','payroll_items','devices','profiles'] loop
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;
-- No API user can edit identities, PIN hashes, device counters, original events or derived sessions.
do $$ declare t text; begin
 foreach t in array array['profiles','devices','employees','employee_secrets','attendance_sessions','attendance_events','attendance_adjustments','shifts','absences','vacation_movements','payroll_runs','payroll_items','audit_log'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 if t<>'employee_secrets' then
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
 end if;
 end loop;
end $$;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
grant select on public.effective_sessions to authenticated;
grant insert on public.shifts,public.absences,public.attendance_adjustments to authenticated;
create policy admin_shift_insert on public.shifts for insert to authenticated with check(public.is_admin());
create policy admin_absence_insert on public.absences for insert to authenticated with check(public.is_admin() and status='pending' and reviewed_by is null and reviewed_at is null);
create policy admin_adjustment_insert on public.attendance_adjustments for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
-- Server-side identity, transaction lock, state machine, idempotency and persistent device rate limiting.
create function public.register_punch(p_code text,p_pin text,p_kind public.punch_kind,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare d public.devices; e public.employees; s public.attendance_sessions; ev public.attendance_events; h text; ts timestamptz:=clock_timestamp();
 begin
 select * into d from public.devices where user_id=auth.uid() and active for update;
 if d.id is null or not exists(select 1 from public.profiles where id=auth.uid() and role='kiosk') then
 return jsonb_build_object('error','Terminal no autorizada.'); end if;
 if d.window_started_at<ts-interval '15 minutes' then
 update public.devices set failed_attempts=0,window_started_at=ts where id=d.id;d.failed_attempts:=0;end if;
 if d.failed_attempts>=10 then return jsonb_build_object('error','Terminal bloqueada temporalmente por intentos fallidos. Espera 15 minutos.');end if;
 select * into e from public.employees where code=p_code and active for update;
 select pin_hash into h from public.employee_secrets where employee_id=e.id;
 if e.id is null or coalesce(p_pin,'') !~ '^\d{6,8}$' or h is null or extensions.crypt(p_pin,h)<>h then
 update public.devices set failed_attempts=failed_attempts+1 where id=d.id;
 return jsonb_build_object('error','Código o PIN incorrecto.');end if;
 select * into ev from public.attendance_events where id=p_request_id;
 if ev.id is not null then
 if ev.employee_id<>e.id or ev.device_id<>d.id or ev.kind<>p_kind then return jsonb_build_object('error','Identificador de marcación inválido.');end if;
 return jsonb_build_object('ok',true,'at',ev.occurred_at);end if;
 select * into s from public.attendance_sessions where employee_id=e.id and ended_at is null for update;
 if p_kind='entry' then
 if s.id is not null then return jsonb_build_object('error','Ya tienes una entrada abierta.');end if;
 insert into public.attendance_sessions(employee_id,started_at) values(e.id,ts) returning * into s;
 else
 if s.id is null then return jsonb_build_object('error','Debes registrar una entrada primero.');end if;
 if p_kind='break_start' then
 if s.break_started_at is not null then return jsonb_build_object('error','Ya tienes un descanso abierto.');end if;
 update public.attendance_sessions set break_started_at=ts where id=s.id;
 elsif p_kind='break_end' then
 if s.break_started_at is null then return jsonb_build_object('error','No tienes un descanso abierto.');end if;
 update public.attendance_sessions set break_seconds=break_seconds+floor(extract(epoch from ts-break_started_at))::integer,break_started_at=null where id=s.id;
 elsif p_kind='exit' then
 if s.break_started_at is not null then return jsonb_build_object('error','Registra el fin del descanso antes de salir.');end if;
 update public.attendance_sessions set ended_at=ts where id=s.id;
 end if;
 end if;
 insert into public.attendance_events(id,employee_id,device_id,session_id,kind,occurred_at) values(p_request_id,e.id,d.id,s.id,p_kind,ts);
 return jsonb_build_object('ok',true,'at',ts);
 end;
$$;
create function public.create_employee(p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{6,8}$' then raise exception 'PIN debe tener de 6 a 8 dígitos';end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation) returning id into eid;
 insert into public.employee_secrets values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 if p_vacation>0 then insert into public.vacation_movements(employee_id,days,reason) values(eid,p_vacation,'Saldo inicial validado por administrador');end if;
 return eid;
 end;
$$;
create function public.set_employee_pin(p_employee uuid,p_pin text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{6,8}$' then raise exception 'PIN inválido';end if;
 update public.employee_secrets set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',10)) where employee_id=p_employee;
 insert into public.audit_log(table_name,record_id,operation) values('employee_secrets',p_employee::text,'PIN_RESET');
 end;
$$;
create function public.set_employee_active(p_employee uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if not p_active and exists(select 1 from public.attendance_sessions where employee_id=p_employee and ended_at is null) then raise exception 'Cierra la jornada antes de desactivar';end if;
 update public.employees set active=p_active where id=p_employee;
 end;
$$;
create function public.add_vacation_balance(p_employee uuid,p_days numeric,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if p_days=0 or length(p_reason)<5 then raise exception 'Días o motivo inválidos';end if;
 update public.employees set vacation_balance=vacation_balance+p_days where id=p_employee;
 if not found then raise exception 'Empleado no encontrado';end if;
 insert into public.vacation_movements(employee_id,days,reason) values(p_employee,p_days,p_reason);
 end;
$$;
create function public.review_absence(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
 declare a public.absences;
 begin
 if not public.is_admin() or p_status not in ('approved','rejected') then raise exception 'No autorizado o estado inválido';end if;
 select * into a from public.absences where id=p_id for update;
 if a.id is null or a.status<>'pending' then raise exception 'La ausencia ya fue revisada o no existe';end if;
 perform 1 from public.employees where id=a.employee_id for update;
 if p_status='approved' and exists(select 1 from public.absences where employee_id=a.employee_id and status='approved' and starts_on<=a.ends_on and ends_on>=a.starts_on) then raise exception 'Hay una ausencia aprobada que se superpone';end if;
 if p_status='approved' and a.kind='vacation' then
 update public.employees set vacation_balance=vacation_balance-a.vacation_days where id=a.employee_id;
 insert into public.vacation_movements(employee_id,days,reason,absence_id) values(a.employee_id,-a.vacation_days,'Vacaciones aprobadas',a.id);
 end if;
 update public.absences set status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=a.id;
 end;
$$;
create function public.create_payroll(p_month date) returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 insert into public.payroll_runs(period_start,period_end) values(p_month,(p_month+interval '1 month'-interval '1 day')::date) returning id into rid;
 insert into public.payroll_items(run_id,employee_id,employee_name,employee_code,base_cents)
 select rid,id,full_name,code,monthly_salary_cents from public.employees where active;
 return rid;
 end;
$$;
create function public.update_payroll_item(p_id uuid,p_base bigint,p_additions bigint,p_deductions bigint,p_note text,p_reviewed boolean)
 returns void language plpgsql security definer set search_path='' as $$
 declare rid uuid;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select run_id into rid from public.payroll_items where id=p_id;
 perform 1 from public.payroll_runs where id=rid and status='draft' for update;
 if not found then raise exception 'La planilla está cerrada o no existe';end if;
 if p_reviewed and length(trim(p_note))<5 then raise exception 'Documenta los conceptos y la revisión';end if;
 update public.payroll_items set base_cents=p_base,addition_cents=p_additions,deduction_cents=p_deductions,note=p_note,reviewed=p_reviewed where id=p_id;
 end;
$$;
create function public.close_payroll(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r public.payroll_runs;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select * into r from public.payroll_runs where id=p_id for update;
 if r.id is null or r.status<>'draft' then raise exception 'Planilla no disponible';end if;
 if not exists(select 1 from public.payroll_items where run_id=p_id) or exists(select 1 from public.payroll_items where run_id=p_id and not reviewed) then raise exception 'Revisa todos los empleados antes del cierre';end if;
 if exists(select 1 from public.effective_sessions where ended_at is null and started_at<((r.period_end+1)::timestamp at time zone 'America/Costa_Rica')) then raise exception 'Hay jornadas abiertas anteriores al cierre';end if;
 if exists(select 1 from public.absences where status='pending' and starts_on<=r.period_end and ends_on>=r.period_start) then raise exception 'Hay ausencias pendientes en el período';end if;
 update public.payroll_runs set status='closed',closed_at=now() where id=p_id;
 end;
$$;
-- Deny default public execution, including future functions in this schema.
alter default privileges in schema public revoke execute on functions from public;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.register_punch(text,text,public.punch_kind,uuid),public.create_employee(text,text,text,text,bigint,text,numeric),public.set_employee_pin(uuid,text),public.set_employee_active(uuid,boolean),public.add_vacation_balance(uuid,numeric,text),public.review_absence(uuid,text),public.create_payroll(date),public.update_payroll_item(uuid,bigint,bigint,bigint,text,boolean),public.close_payroll(uuid) to authenticated;
commit;
