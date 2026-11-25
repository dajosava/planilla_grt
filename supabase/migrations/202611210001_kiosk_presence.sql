-- Presencia / heartbeat del reloj de marcación (tablet kiosk).
-- El cliente hace ping local cada 15 s; solo escribe aquí ~cada 60 s si hay red.

create table public.kiosk_presence (
 device_id text primary key check (length(device_id) between 8 and 80),
 label text not null default 'Reloj marcación' check (length(label) between 2 and 80),
 last_seen_at timestamptz not null default now(),
 queue_pending integer not null default 0 check (queue_pending >= 0 and queue_pending < 10000),
 user_agent text not null default '' check (length(user_agent) <= 400),
 created_at timestamptz not null default now()
);

create index kiosk_presence_seen on public.kiosk_presence (last_seen_at desc);

alter table public.kiosk_presence enable row level security;
revoke all on public.kiosk_presence from public, anon, authenticated;
grant select on public.kiosk_presence to authenticated;

create policy admin_read_kiosk_presence on public.kiosk_presence
 for select to authenticated using (public.is_admin());

create or replace function public.report_kiosk_presence(
 p_device_id text,
 p_queue_pending integer default 0,
 p_label text default 'Reloj marcación',
 p_user_agent text default ''
) returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $$
 declare
  v_id text := left(trim(coalesce(p_device_id, '')), 80);
  v_label text := left(trim(coalesce(p_label, 'Reloj marcación')), 80);
  v_ua text := left(trim(coalesce(p_user_agent, '')), 400);
  v_q int := greatest(0, least(coalesce(p_queue_pending, 0), 9999));
 begin
  if not exists (
   select 1 from public.profiles where id = auth.uid() and role = 'kiosk'
  ) then
   return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;
  if length(v_id) < 8 then
   return jsonb_build_object('ok', false, 'error', 'device_id inválido');
  end if;
  if length(v_label) < 2 then
   v_label := 'Reloj marcación';
  end if;

  insert into public.kiosk_presence as kp (device_id, label, last_seen_at, queue_pending, user_agent)
  values (v_id, v_label, now(), v_q, v_ua)
  on conflict (device_id) do update set
   label = excluded.label,
   last_seen_at = now(),
   queue_pending = excluded.queue_pending,
   user_agent = excluded.user_agent;

  return jsonb_build_object('ok', true, 'at', now());
 end;
$$;

create or replace function public.list_kiosk_presence(p_stale_seconds integer default 90)
 returns jsonb
 language plpgsql
 security definer
 set search_path = ''
as $$
 declare
  stale int := greatest(30, least(coalesce(p_stale_seconds, 90), 3600));
  rows jsonb;
 begin
  if not public.is_admin() then
   return jsonb_build_object('ok', false, 'error', 'No autorizado', 'devices', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen_at desc), '[]'::jsonb)
  into rows
  from (
   select
    kp.device_id,
    kp.label,
    kp.last_seen_at,
    kp.queue_pending,
    (kp.last_seen_at >= now() - make_interval(secs => stale)) as online,
    round(extract(epoch from (now() - kp.last_seen_at)))::int as seconds_ago
   from public.kiosk_presence kp
  ) x;

  return jsonb_build_object(
   'ok', true,
   'stale_seconds', stale,
   'any_online', exists (
    select 1 from public.kiosk_presence
    where last_seen_at >= now() - make_interval(secs => stale)
   ),
   'devices', rows
  );
 end;
$$;

revoke execute on function public.report_kiosk_presence(text, integer, text, text) from public, anon;
revoke execute on function public.list_kiosk_presence(integer) from public, anon;
grant execute on function public.report_kiosk_presence(text, integer, text, text) to authenticated;
grant execute on function public.list_kiosk_presence(integer) to authenticated;
