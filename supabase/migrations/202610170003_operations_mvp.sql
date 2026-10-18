begin;
-- Admin approves tasks in MVP; employee ops use kiosk + code/PIN (no new Auth role yet).

create table public.stations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 120),
 timezone text not null default 'America/Costa_Rica',
 active boolean not null default true,
 created_at timestamptz not null default now()
);

insert into public.stations(name) values('Gasolinera Río Tempisque');

create type public.ops_area as enum ('Pista','Baños','Tienda','Caja','Seguridad','Mantenimiento','General');
create type public.task_status as enum ('pending','in_progress','completed','approved','rejected');
create type public.incident_severity as enum ('low','medium','high','critical');
create type public.incident_status as enum ('open','assigned','resolved','closed');
create type public.evidence_kind as enum ('photo','comment');

create table public.task_templates (
 id uuid primary key default gen_random_uuid(),
 station_id uuid not null references public.stations(id) on delete cascade,
 title text not null check(length(title) between 3 and 120),
 area public.ops_area not null default 'General',
 recurrence text not null default 'daily' check(recurrence in ('daily','weekdays','once')),
 due_offset_minutes integer not null default 60 check(due_offset_minutes between 5 and 1440),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table public.task_template_items (
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.task_templates(id) on delete cascade,
 label text not null check(length(label) between 2 and 200),
 sort_order integer not null default 0,
 requires_photo boolean not null default false
);

create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 station_id uuid not null references public.stations(id) on delete cascade,
 template_id uuid references public.task_templates(id) on delete set null,
 title text not null,
 area public.ops_area not null default 'General',
 status public.task_status not null default 'pending',
 due_at timestamptz not null,
 run_date date not null,
 assigned_employee_id uuid references public.employees(id) on delete set null,
 completed_at timestamptz,
 completed_by uuid references public.employees(id) on delete set null,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 review_note text not null default '',
 created_at timestamptz not null default now(),
 unique(template_id, run_date)
);

create index tasks_station_due on public.tasks(station_id, due_at desc);
create index tasks_status on public.tasks(status);

create table public.task_checklist_items (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 label text not null,
 sort_order integer not null default 0,
 requires_photo boolean not null default false,
 done boolean not null default false,
 done_at timestamptz,
 done_by_employee_id uuid references public.employees(id) on delete set null
);

create table public.task_evidence (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 employee_id uuid not null references public.employees(id) on delete cascade,
 kind public.evidence_kind not null,
 comment_text text,
 image bytea,
 created_at timestamptz not null default now(),
 check((kind='comment' and comment_text is not null and length(trim(comment_text))>=3) or (kind='photo' and image is not null)),
 check(image is null or octet_length(image)<=200000)
);

create table public.incidents (
 id uuid primary key default gen_random_uuid(),
 station_id uuid not null references public.stations(id) on delete cascade,
 category text not null check(category in ('Dispensador','Derrame','Seguridad','Caja','Tienda','Mantenimiento','Otro')),
 severity public.incident_severity not null default 'medium',
 status public.incident_status not null default 'open',
 title text not null check(length(title) between 3 and 160),
 description text not null default '',
 reported_by_employee_id uuid not null references public.employees(id) on delete cascade,
 assigned_to uuid references public.profiles(id) on delete set null,
 resolved_note text not null default '',
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 closed_at timestamptz
);

create table public.incident_evidence (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references public.incidents(id) on delete cascade,
 employee_id uuid references public.employees(id) on delete set null,
 kind public.evidence_kind not null,
 comment_text text,
 image bytea,
 created_at timestamptz not null default now(),
 check((kind='comment' and comment_text is not null) or (kind='photo' and image is not null)),
 check(image is null or octet_length(image)<=200000)
);

-- Short-lived ops sessions for kiosk employees (code+PIN), not Auth users.
create table public.ops_sessions (
 id uuid primary key default gen_random_uuid(),
 token text unique not null,
 employee_id uuid not null references public.employees(id) on delete cascade,
 device_id uuid not null references public.devices(id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index ops_sessions_token on public.ops_sessions(token);
create index ops_sessions_expires on public.ops_sessions(expires_at);

do $$ declare t text; begin
 foreach t in array array['stations','task_templates','task_template_items','tasks','task_checklist_items','task_evidence','incidents','incident_evidence'] loop
  execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
 foreach t in array array['stations','task_templates','task_template_items','tasks','task_checklist_items','task_evidence','incidents','incident_evidence','ops_sessions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  if t<>'ops_sessions' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
  end if;
 end loop;
end $$;

grant insert,update,delete on public.task_templates,public.task_template_items,public.tasks,public.task_checklist_items,public.incidents to authenticated;
create policy admin_write_templates on public.task_templates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_write_template_items on public.task_template_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_write_tasks on public.tasks for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_write_checklist on public.task_checklist_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_write_incidents on public.incidents for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Kiosk can read stations/tasks via RPCs (security definer); no direct table writes for secrets.
create policy kiosk_read_stations on public.stations for select to authenticated using(true);

create function public.ops_device() returns public.devices language plpgsql stable security definer set search_path='' as $$
 declare d public.devices;
 begin
 select * into d from public.devices where user_id=auth.uid() and active;
 return d;
 end;
$$;

create function public.ops_current_employee(p_token text) returns uuid language plpgsql stable security definer set search_path='' as $$
 declare eid uuid;
 begin
 select employee_id into eid from public.ops_sessions
  where token=p_token and expires_at>now()
    and device_id=(select id from public.devices where user_id=auth.uid() and active);
 return eid;
 end;
$$;

create function public.ops_start_session(p_code text, p_pin text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare d public.devices; e public.employees; h text; tok text; exp timestamptz:=now()+interval '8 hours';
 begin
 d:=public.ops_device();
 if d.id is null or not exists(select 1 from public.profiles where id=auth.uid() and role='kiosk') then
  return jsonb_build_object('error','Terminal no autorizada.');
 end if;
 select * into e from public.employees where code=upper(trim(p_code)) and active;
 select pin_hash into h from public.employee_secrets where employee_id=e.id;
 if e.id is null or coalesce(p_pin,'') !~ '^\d{4}$' or h is null or extensions.crypt(p_pin,h)<>h then
  return jsonb_build_object('error','Código o PIN incorrecto.');
 end if;
 tok:=encode(extensions.gen_random_bytes(24),'hex');
 delete from public.ops_sessions where device_id=d.id or expires_at<now();
 insert into public.ops_sessions(token,employee_id,device_id,expires_at) values(tok,e.id,d.id,exp);
 return jsonb_build_object('ok',true,'token',tok,'employee_id',e.id,'full_name',e.full_name,'code',e.code,'expires_at',exp);
 end;
$$;

create function public.ops_end_session(p_token text)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 delete from public.ops_sessions where token=p_token
  and device_id=(select id from public.devices where user_id=auth.uid() and active);
 end;
$$;

create function public.ops_upsert_template(p_id uuid, p_title text, p_area public.ops_area, p_recurrence text, p_due_offset integer, p_active boolean, p_items jsonb)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare tid uuid; sid uuid; item jsonb; i int:=0;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select id into sid from public.stations where active order by created_at limit 1;
 if sid is null then raise exception 'No hay estación configurada';end if;
 if p_id is null then
  insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes,active)
  values(sid,p_title,p_area,p_recurrence,p_due_offset,coalesce(p_active,true)) returning id into tid;
 else
  update public.task_templates set title=p_title,area=p_area,recurrence=p_recurrence,due_offset_minutes=p_due_offset,active=coalesce(p_active,true)
  where id=p_id returning id into tid;
  if tid is null then raise exception 'Plantilla no encontrada';end if;
  delete from public.task_template_items where template_id=tid;
 end if;
 for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
  insert into public.task_template_items(template_id,label,sort_order,requires_photo)
  values(tid,item->>'label',i,coalesce((item->>'requires_photo')::boolean,false));
  i:=i+1;
 end loop;
 return tid;
 end;
$$;

create function public.ops_generate_tasks_for_date(p_date date default null)
 returns integer language plpgsql security definer set search_path='' as $$
 declare run date:=coalesce(p_date,(timezone('America/Costa_Rica',now()))::date);
  t public.task_templates; tid uuid; n int:=0; dow int;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 dow:=extract(isodow from run)::int;
 for t in select * from public.task_templates where active
   and (recurrence='daily' or (recurrence='weekdays' and dow between 1 and 5) or recurrence='once')
 loop
  if t.recurrence='once' and exists(select 1 from public.tasks where template_id=t.id) then continue; end if;
  insert into public.tasks(station_id,template_id,title,area,due_at,run_date)
  values(t.station_id,t.id,t.title,t.area,(run::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>t.due_offset_minutes),run)
  on conflict (template_id, run_date) do nothing
  returning id into tid;
  if tid is not null then
   insert into public.task_checklist_items(task_id,label,sort_order,requires_photo)
   select tid,label,sort_order,requires_photo from public.task_template_items where template_id=t.id order by sort_order;
   n:=n+1;
  end if;
 end loop;
 return n;
 end;
$$;

create function public.ops_list_my_tasks(p_token text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; ename text; ecode text; today date:=(timezone('America/Costa_Rica',now()))::date;
 begin
 eid:=public.ops_current_employee(p_token);
 if eid is null then return jsonb_build_object('error','Sesión de operaciones inválida o expirada.'); end if;
 select full_name,code into ename,ecode from public.employees where id=eid;
 return jsonb_build_object(
  'employee',jsonb_build_object('id',eid,'full_name',ename,'code',ecode),
  'tasks',coalesce((select jsonb_agg(row_to_json(x)) from (
   select t.id,t.title,t.area,t.status,t.due_at,t.run_date,
    (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'done',c.done,'requires_photo',c.requires_photo) order by c.sort_order),'[]'::jsonb)
     from public.task_checklist_items c where c.task_id=t.id) as checklist
   from public.tasks t
   where t.run_date=today and t.status in ('pending','in_progress','completed','rejected')
   order by t.due_at
  ) x),'[]'::jsonb)
 );
 end;
$$;

create function public.ops_toggle_checklist(p_token text, p_item_id uuid, p_done boolean)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; item public.task_checklist_items; task public.tasks;
 begin
 eid:=public.ops_current_employee(p_token);
 if eid is null then return jsonb_build_object('error','Sesión inválida.'); end if;
 select * into item from public.task_checklist_items where id=p_item_id;
 if item.id is null then return jsonb_build_object('error','Ítem no encontrado.'); end if;
 select * into task from public.tasks where id=item.task_id for update;
 if task.status in ('approved') then return jsonb_build_object('error','La tarea ya fue aprobada.'); end if;
 update public.task_checklist_items set done=p_done,done_at=case when p_done then now() else null end,done_by_employee_id=case when p_done then eid else null end where id=p_item_id;
 update public.tasks set status='in_progress', assigned_employee_id=coalesce(assigned_employee_id,eid)
  where id=task.id and status='pending';
 return jsonb_build_object('ok',true);
 end;
$$;

create function public.ops_complete_task(p_token text, p_task_id uuid, p_comment text, p_photo text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; task public.tasks; need_photo boolean; img bytea;
 begin
 eid:=public.ops_current_employee(p_token);
 if eid is null then return jsonb_build_object('error','Sesión inválida.'); end if;
 select * into task from public.tasks where id=p_task_id for update;
 if task.id is null then return jsonb_build_object('error','Tarea no encontrada.'); end if;
 if task.status in ('approved','completed') then return jsonb_build_object('error','La tarea ya está completa.'); end if;
 if exists(select 1 from public.task_checklist_items where task_id=task.id and not done) then
  return jsonb_build_object('error','Completa todos los ítems del checklist.');
 end if;
 select coalesce(bool_or(requires_photo),false) into need_photo from public.task_checklist_items where task_id=task.id;
 begin
  if p_photo is not null and length(p_photo)<=270000 then img:=decode(p_photo,'base64'); end if;
 exception when others then img:=null;
 end;
 if img is not null and (octet_length(img)>200000 or substring(img from 1 for 3)<>'\xffd8ff'::bytea) then img:=null; end if;
 if need_photo and img is null then return jsonb_build_object('error','Esta tarea requiere una foto de evidencia.'); end if;
 if img is not null then
  insert into public.task_evidence(task_id,employee_id,kind,image) values(task.id,eid,'photo',img);
 end if;
 if coalesce(trim(p_comment),'')<>'' then
  insert into public.task_evidence(task_id,employee_id,kind,comment_text) values(task.id,eid,'comment',trim(p_comment));
 end if;
 update public.tasks set status='completed',completed_at=now(),completed_by=eid,assigned_employee_id=coalesce(assigned_employee_id,eid) where id=task.id;
 return jsonb_build_object('ok',true);
 end;
$$;

create function public.ops_review_task(p_task_id uuid, p_approve boolean, p_note text)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 update public.tasks set
  status=case when p_approve then 'approved'::public.task_status else 'rejected'::public.task_status end,
  reviewed_by=auth.uid(), reviewed_at=now(), review_note=coalesce(p_note,'')
 where id=p_task_id and status='completed';
 if not found then raise exception 'Solo se pueden revisar tareas completadas';end if;
 end;
$$;

create function public.ops_report_incident(p_token text, p_category text, p_severity public.incident_severity, p_title text, p_description text, p_photo text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; sid uuid; iid uuid; img bytea;
 begin
 eid:=public.ops_current_employee(p_token);
 if eid is null then return jsonb_build_object('error','Sesión inválida.'); end if;
 select id into sid from public.stations where active order by created_at limit 1;
 begin
  if p_photo is not null and length(p_photo)<=270000 then img:=decode(p_photo,'base64'); end if;
 exception when others then img:=null;
 end;
 if img is not null and (octet_length(img)>200000 or substring(img from 1 for 3)<>'\xffd8ff'::bytea) then img:=null; end if;
 insert into public.incidents(station_id,category,severity,title,description,reported_by_employee_id)
 values(sid,p_category,p_severity,trim(p_title),coalesce(trim(p_description),''),eid) returning id into iid;
 if img is not null then
  insert into public.incident_evidence(incident_id,employee_id,kind,image) values(iid,eid,'photo',img);
 end if;
 return jsonb_build_object('ok',true,'id',iid);
 end;
$$;

create function public.ops_update_incident(p_id uuid, p_status public.incident_status, p_note text)
 returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 update public.incidents set
  status=p_status,
  assigned_to=case when p_status='assigned' then auth.uid() else assigned_to end,
  resolved_note=coalesce(p_note,resolved_note),
  resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else resolved_at end,
  closed_at=case when p_status='closed' then now() else closed_at end
 where id=p_id;
 if not found then raise exception 'Incidente no encontrado';end if;
 end;
$$;

create function public.ops_dashboard_today()
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare today date:=(timezone('America/Costa_Rica',now()))::date;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 return jsonb_build_object(
  'date',today,
  'tasks', (select jsonb_build_object(
    'total',count(*),
    'completed',count(*) filter (where status in ('completed','approved')),
    'pending',count(*) filter (where status in ('pending','in_progress')),
    'late',count(*) filter (where status in ('pending','in_progress') and due_at<now()),
    'approved',count(*) filter (where status='approved'),
    'rejected',count(*) filter (where status='rejected')
   ) from public.tasks where run_date=today),
  'by_area', coalesce((select jsonb_agg(row_to_json(a)) from (
    select area::text, count(*) total,
     count(*) filter (where status in ('completed','approved')) done
    from public.tasks where run_date=today group by area order by area
  ) a),'[]'::jsonb),
  'incidents', (select jsonb_build_object(
    'open',count(*) filter (where status in ('open','assigned')),
    'critical',count(*) filter (where severity='critical' and status in ('open','assigned')),
    'resolved_today',count(*) filter (where status in ('resolved','closed') and resolved_at::date=today)
   ) from public.incidents)
 );
 end;
$$;

revoke execute on function public.ops_device(),public.ops_current_employee(text) from public,anon,authenticated;
revoke execute on function public.ops_start_session(text,text),public.ops_end_session(text),public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb),public.ops_generate_tasks_for_date(date),public.ops_list_my_tasks(text),public.ops_toggle_checklist(text,uuid,boolean),public.ops_complete_task(text,uuid,text,text),public.ops_review_task(uuid,boolean,text),public.ops_report_incident(text,text,public.incident_severity,text,text,text),public.ops_update_incident(uuid,public.incident_status,text),public.ops_dashboard_today() from public,anon;
grant execute on function public.ops_start_session(text,text),public.ops_end_session(text),public.ops_list_my_tasks(text),public.ops_toggle_checklist(text,uuid,boolean),public.ops_complete_task(text,uuid,text,text),public.ops_report_incident(text,text,public.incident_severity,text,text,text) to authenticated;
grant execute on function public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb),public.ops_generate_tasks_for_date(date),public.ops_review_task(uuid,boolean,text),public.ops_update_incident(uuid,public.incident_status,text),public.ops_dashboard_today() to authenticated;

-- Seed templates for Río Tempisque
do $$
 declare sid uuid; tid uuid;
 begin
 select id into sid from public.stations limit 1;
 insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes) values
  (sid,'Apertura de estación','General','daily',90) returning id into tid;
 insert into public.task_template_items(template_id,label,sort_order,requires_photo) values
  (tid,'Revisar dispensadores',0,true),(tid,'Revisar iluminación',1,false),(tid,'Revisar baños',2,true),
  (tid,'Revisar precios visibles',3,false),(tid,'Revisar tienda',4,false),(tid,'Revisar extintores',5,true),(tid,'Limpieza de pista',6,true);

 insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes) values
  (sid,'Cierre de estación','General','daily',1200) returning id into tid;
 insert into public.task_template_items(template_id,label,sort_order,requires_photo) values
  (tid,'Arqueo de caja',0,false),(tid,'Apagar luces no esenciales',1,false),(tid,'Seguridad de accesos',2,true),(tid,'Limpieza final de pista',3,true);

 insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes) values
  (sid,'Limpieza de baños','Baños','daily',360) returning id into tid;
 insert into public.task_template_items(template_id,label,sort_order,requires_photo) values
  (tid,'Limpiar sanitarios',0,true),(tid,'Reponer insumos',1,false),(tid,'Verificar olores y piso',2,true);

 insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes) values
  (sid,'Inspección de seguridad','Seguridad','daily',480) returning id into tid;
 insert into public.task_template_items(template_id,label,sort_order,requires_photo) values
  (tid,'Extintores en su lugar',0,true),(tid,'Señalización visible',1,false),(tid,'Sin derrames en pista',2,true);
 end $$;

commit;
