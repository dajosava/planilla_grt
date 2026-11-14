-- Marcación offline: permite registrar con hora capturada en la tablet (ventana acotada).
begin;

drop function if exists public.register_punch_with_photo(text,text,public.punch_kind,uuid,text);
drop function if exists public.register_punch(text,text,public.punch_kind,uuid);

create function public.register_punch(
  p_code text,
  p_pin text,
  p_kind public.punch_kind,
  p_request_id uuid,
  p_occurred_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.devices;
  e public.employees;
  s public.attendance_sessions;
  ev public.attendance_events;
  h text;
  now_ts timestamptz:=clock_timestamp();
  ts timestamptz;
begin
  select * into d from public.devices where user_id=auth.uid() and active for update;
  if d.id is null or not exists(select 1 from public.profiles where id=auth.uid() and role='kiosk') then
    return jsonb_build_object('error','Terminal no autorizada.');
  end if;

  if d.window_started_at<now_ts-interval '15 minutes' then
    update public.devices set failed_attempts=0,window_started_at=now_ts where id=d.id;
    d.failed_attempts:=0;
  end if;
  if d.failed_attempts>=10 then
    return jsonb_build_object('error','Terminal bloqueada temporalmente por intentos fallidos. Espera 15 minutos.');
  end if;

  -- Hora de la marca: servidor por defecto; offline usa la hora de la tablet con límites.
  ts:=coalesce(p_occurred_at,now_ts);
  if p_occurred_at is not null then
    if p_occurred_at > now_ts + interval '2 minutes' then
      return jsonb_build_object('error','Hora de marcación inválida (parece del futuro). Revisá la fecha/hora de la tablet.');
    end if;
    if p_occurred_at < now_ts - interval '72 hours' then
      return jsonb_build_object('error','Marcación offline demasiado antigua (máximo 72 horas).');
    end if;
  end if;

  select * into e from public.employees where code=p_code and active for update;
  select pin_hash into h from public.employee_secrets where employee_id=e.id;
  if e.id is null or coalesce(p_pin,'') !~ '^\d{4}$' or h is null or extensions.crypt(p_pin,h)<>h then
    update public.devices set failed_attempts=failed_attempts+1 where id=d.id;
    return jsonb_build_object('error','Código o PIN incorrecto.');
  end if;

  select * into ev from public.attendance_events where id=p_request_id;
  if ev.id is not null then
    if ev.employee_id<>e.id or ev.device_id<>d.id or ev.kind<>p_kind then
      return jsonb_build_object('error','Identificador de marcación inválido.');
    end if;
    return jsonb_build_object('ok',true,'at',ev.occurred_at,'replay',true);
  end if;

  select * into s from public.attendance_sessions where employee_id=e.id and ended_at is null for update;

  if p_kind='entry' then
    if s.id is not null then
      return jsonb_build_object('error','Ya tienes una entrada abierta.');
    end if;
    insert into public.attendance_sessions(employee_id,started_at) values(e.id,ts) returning * into s;
  else
    if s.id is null then
      return jsonb_build_object('error','Debes registrar una entrada primero.');
    end if;
    -- Evita desorden temporal al sincronizar cola offline.
    if ts < s.started_at then
      return jsonb_build_object('error','La hora de esta marca es anterior a la entrada abierta. Revisá la cola offline.');
    end if;
    if p_kind='break_start' then
      if s.break_started_at is not null then
        return jsonb_build_object('error','Ya tienes un descanso abierto.');
      end if;
      update public.attendance_sessions set break_started_at=ts where id=s.id;
    elsif p_kind='break_end' then
      if s.break_started_at is null then
        return jsonb_build_object('error','No tienes un descanso abierto.');
      end if;
      if ts < s.break_started_at then
        return jsonb_build_object('error','La hora de fin de descanso es inválida.');
      end if;
      update public.attendance_sessions
        set break_seconds=break_seconds+floor(extract(epoch from ts-break_started_at))::integer,
            break_started_at=null
      where id=s.id;
    elsif p_kind='exit' then
      if s.break_started_at is not null then
        return jsonb_build_object('error','Registra el fin del descanso antes de salir.');
      end if;
      update public.attendance_sessions set ended_at=ts where id=s.id;
    end if;
  end if;

  insert into public.attendance_events(id,employee_id,device_id,session_id,kind,occurred_at)
  values(p_request_id,e.id,d.id,s.id,p_kind,ts);

  return jsonb_build_object('ok',true,'at',ts,'offline_sourced',p_occurred_at is not null);
end;
$$;

create function public.register_punch_with_photo(
  p_code text,
  p_pin text,
  p_kind public.punch_kind,
  p_request_id uuid,
  p_photo text,
  p_occurred_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r jsonb;
  img bytea;
begin
  r:=public.register_punch(p_code,p_pin,p_kind,p_request_id,p_occurred_at);
  if not coalesce((r->>'ok')::boolean,false) then
    return r;
  end if;
  begin
    if p_photo is not null and length(p_photo)<=270000 then
      img:=decode(p_photo,'base64');
    end if;
  exception when others then
    img:=null;
  end;
  if img is not null and (octet_length(img)>200000 or substring(img from 1 for 3)<>'\xffd8ff'::bytea) then
    img:=null;
  end if;
  insert into public.punch_photos(event_id,status,image)
  values(p_request_id,case when img is null then 'missing' else 'captured' end,img)
  on conflict (event_id) do nothing;
  update public.punch_photos
    set status='expired',image=null
  where image is not null and created_at<now()-interval '30 days';
  return r||jsonb_build_object('photo',img is not null);
end;
$$;

revoke all on function public.register_punch(text,text,public.punch_kind,uuid,timestamptz) from public,anon;
revoke all on function public.register_punch_with_photo(text,text,public.punch_kind,uuid,text,timestamptz) from public,anon;
grant execute on function public.register_punch(text,text,public.punch_kind,uuid,timestamptz) to authenticated;
grant execute on function public.register_punch_with_photo(text,text,public.punch_kind,uuid,text,timestamptz) to authenticated;

commit;
