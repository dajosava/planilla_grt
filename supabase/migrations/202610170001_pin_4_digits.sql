begin;
-- PIN length changes from 6–8 digits to exactly 4. Existing hashes keep working
-- only if the employee was already using a 4-digit PIN; otherwise reset via admin.

create or replace function public.register_punch(p_code text,p_pin text,p_kind public.punch_kind,p_request_id uuid)
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
 if e.id is null or coalesce(p_pin,'') !~ '^\d{4}$' or h is null or extensions.crypt(p_pin,h)<>h then
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

create or replace function public.set_employee_pin(p_employee uuid,p_pin text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{4}$' then raise exception 'PIN debe tener 4 dígitos';end if;
 update public.employee_secrets set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',10)) where employee_id=p_employee;
 insert into public.audit_log(table_name,record_id,operation) values('employee_secrets',p_employee::text,'PIN_RESET');
 end;
$$;

drop function if exists public.create_employee(text,text,text,text,bigint,text,numeric,date,text);
create function public.create_employee(p_code text,p_name text,p_department text,p_position text,p_salary bigint,p_pin text,p_vacation numeric,p_hired_on date,p_cedula text)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare eid uuid; v_cedula text:=regexp_replace(coalesce(p_cedula,''),'[^0-9]','','g');
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 if coalesce(p_pin,'') !~ '^\d{4}$' then raise exception 'PIN debe tener 4 dígitos';end if;
 if p_hired_on is null then raise exception 'Indica la fecha de ingreso';end if;
 if p_hired_on<'1950-01-01' or p_hired_on>(timezone('America/Costa_Rica',now()))::date then
  raise exception 'La fecha de ingreso no es válida';
 end if;
 if v_cedula !~ '^\d{9,12}$' then raise exception 'La cédula debe tener de 9 a 12 dígitos';end if;
 insert into public.employees(code,full_name,department,position,monthly_salary_cents,vacation_balance,hired_on,cedula)
 values(p_code,p_name,p_department,p_position,p_salary,p_vacation,p_hired_on,v_cedula) returning id into eid;
 insert into public.employee_secrets values(eid,extensions.crypt(p_pin,extensions.gen_salt('bf',10)));
 if p_vacation>0 then insert into public.vacation_movements(employee_id,days,reason) values(eid,p_vacation,'Saldo inicial validado por administrador');end if;
 return eid;
 end;
$$;
revoke execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text) from public,anon;
grant execute on function public.create_employee(text,text,text,text,bigint,text,numeric,date,text) to authenticated;
commit;
