begin;
-- Recordatorios de trámites, permisos, renovaciones y documentación.

create table public.business_reminders (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 3 and 160),
 description text not null default '' check (length(description) <= 2000),
 category text not null default 'tramite'
  check (category in ('tramite','permiso','renovacion','documentacion','otro')),
 company text check (company is null or company in ('Gasolinera','Supermercado','Transporte')),
 due_on date not null,
 alert_days integer not null default 30 check (alert_days between 1 and 365),
 reference_code text not null default '' check (length(reference_code) <= 80),
 status text not null default 'open' check (status in ('open','done','cancelled')),
 completed_at timestamptz,
 completed_note text not null default '' check (length(completed_note) <= 1000),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index business_reminders_open_due on public.business_reminders(status, due_on)
 where status = 'open';

alter table public.business_reminders enable row level security;
revoke all on public.business_reminders from anon, authenticated;
grant select, insert, update, delete on public.business_reminders to authenticated;

create policy admin_reminders_all on public.business_reminders
 for all to authenticated
 using (public.is_admin())
 with check (public.is_admin());

create trigger audit_business_reminders
 after insert or update or delete on public.business_reminders
 for each row execute function public.audit_change();

create or replace function public.upsert_business_reminder(
 p_id uuid,
 p_title text,
 p_description text,
 p_category text,
 p_company text,
 p_due_on date,
 p_alert_days integer,
 p_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
 declare rid uuid;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_category not in ('tramite','permiso','renovacion','documentacion','otro') then
   raise exception 'Categoría no válida';
  end if;
  if p_company is not null and p_company not in ('Gasolinera','Supermercado','Transporte') then
   raise exception 'Sociedad no válida';
  end if;
  if p_due_on is null then raise exception 'Indicá la fecha límite'; end if;
  if p_alert_days is null or p_alert_days < 1 or p_alert_days > 365 then
   raise exception 'Los días de alerta deben estar entre 1 y 365';
  end if;
  if length(trim(coalesce(p_title,''))) < 3 then raise exception 'El título es muy corto'; end if;

  if p_id is null then
   insert into public.business_reminders(
    title,description,category,company,due_on,alert_days,reference_code,created_by
   ) values (
    trim(p_title),
    coalesce(trim(p_description),''),
    p_category,
    nullif(trim(coalesce(p_company,'')),''),
    p_due_on,
    p_alert_days,
    coalesce(trim(p_reference),''),
    auth.uid()
   ) returning id into rid;
  else
   update public.business_reminders set
    title=trim(p_title),
    description=coalesce(trim(p_description),''),
    category=p_category,
    company=nullif(trim(coalesce(p_company,'')),''),
    due_on=p_due_on,
    alert_days=p_alert_days,
    reference_code=coalesce(trim(p_reference),''),
    updated_at=now()
   where id=p_id and status='open'
   returning id into rid;
   if rid is null then raise exception 'Recordatorio no encontrado o ya cerrado'; end if;
  end if;
  return rid;
 end;
$$;

create or replace function public.complete_business_reminder(p_id uuid, p_note text default '')
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.business_reminders
   set status='done',
       completed_at=now(),
       completed_note=coalesce(trim(p_note),''),
       updated_at=now()
  where id=p_id and status='open';
  if not found then raise exception 'Recordatorio no encontrado o ya cerrado'; end if;
 end;
$$;

create or replace function public.cancel_business_reminder(p_id uuid, p_note text default '')
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.business_reminders
   set status='cancelled',
       completed_at=now(),
       completed_note=coalesce(trim(p_note),''),
       updated_at=now()
  where id=p_id and status='open';
  if not found then raise exception 'Recordatorio no encontrado o ya cerrado'; end if;
 end;
$$;

-- Conteo de alarmas abiertas (vencidas + dentro de alert_days)
create or replace function public.count_reminder_alerts()
 returns integer language plpgsql security definer set search_path='' as $$
 declare n int; today date:=(timezone('America/Costa_Rica',now()))::date;
 begin
  if not public.is_admin() then return 0; end if;
  select count(*)::int into n
  from public.business_reminders r
  where r.status='open'
    and r.due_on <= today + make_interval(days => r.alert_days);
  return coalesce(n,0);
 end;
$$;

revoke execute on function public.upsert_business_reminder(uuid,text,text,text,text,date,integer,text) from public,anon;
revoke execute on function public.complete_business_reminder(uuid,text) from public,anon;
revoke execute on function public.cancel_business_reminder(uuid,text) from public,anon;
revoke execute on function public.count_reminder_alerts() from public,anon;
grant execute on function public.upsert_business_reminder(uuid,text,text,text,text,date,integer,text) to authenticated;
grant execute on function public.complete_business_reminder(uuid,text) to authenticated;
grant execute on function public.cancel_business_reminder(uuid,text) to authenticated;
grant execute on function public.count_reminder_alerts() to authenticated;

commit;
