begin;
-- Assign tasks to employees so each person sees only their daily work on the kiosk.

alter table public.task_templates
 add column if not exists default_assignee_id uuid references public.employees(id) on delete set null;

create index if not exists tasks_assigned_employee on public.tasks(assigned_employee_id, run_date);

create or replace function public.ops_assign_task(p_task_id uuid, p_employee_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_employee_id is not null and not exists(
   select 1 from public.employees where id=p_employee_id and active
  ) then raise exception 'Empleado no encontrado o inactivo'; end if;
  update public.tasks
   set assigned_employee_id=p_employee_id
  where id=p_task_id and status in ('pending','in_progress','rejected');
  if not found then raise exception 'La tarea no existe o ya está cerrada'; end if;
 end;
$$;

drop function if exists public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb);
create function public.ops_upsert_template(
 p_id uuid, p_title text, p_area public.ops_area, p_recurrence text,
 p_due_offset integer, p_active boolean, p_items jsonb, p_assignee uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
 declare tid uuid; sid uuid; item jsonb; i int:=0;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_assignee is not null and not exists(
   select 1 from public.employees where id=p_assignee and active
  ) then raise exception 'Empleado asignado no válido'; end if;
  select id into sid from public.stations where active order by created_at limit 1;
  if sid is null then raise exception 'No hay estación configurada'; end if;
  if p_id is null then
   insert into public.task_templates(station_id,title,area,recurrence,due_offset_minutes,active,default_assignee_id)
   values(sid,p_title,p_area,p_recurrence,p_due_offset,coalesce(p_active,true),p_assignee) returning id into tid;
  else
   update public.task_templates
    set title=p_title,area=p_area,recurrence=p_recurrence,due_offset_minutes=p_due_offset,
        active=coalesce(p_active,true),default_assignee_id=p_assignee
   where id=p_id returning id into tid;
   if tid is null then raise exception 'Plantilla no encontrada'; end if;
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

create or replace function public.ops_generate_tasks_for_date(p_date date default null)
 returns integer language plpgsql security definer set search_path='' as $$
 declare run date:=coalesce(p_date,(timezone('America/Costa_Rica',now()))::date);
  t public.task_templates; tid uuid; n int:=0; dow int;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  dow:=extract(isodow from run)::int;
  for t in select * from public.task_templates where active
    and (recurrence='daily' or (recurrence='weekdays' and dow between 1 and 5) or recurrence='once')
  loop
   if t.recurrence='once' and exists(select 1 from public.tasks where template_id=t.id) then continue; end if;
   insert into public.tasks(station_id,template_id,title,area,due_at,run_date,assigned_employee_id)
   values(
    t.station_id,t.id,t.title,t.area,
    (run::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>t.due_offset_minutes),
    run,t.default_assignee_id
   )
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

create or replace function public.ops_list_my_tasks(p_token text)
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
     (select coalesce(jsonb_agg(jsonb_build_object(
       'id',c.id,'label',c.label,'done',c.done,'requires_photo',c.requires_photo
      ) order by c.sort_order),'[]'::jsonb)
      from public.task_checklist_items c where c.task_id=t.id) as checklist
    from public.tasks t
    where t.run_date=today
      and t.assigned_employee_id=eid
      and t.status in ('pending','in_progress','completed','rejected')
    order by t.due_at
   ) x),'[]'::jsonb)
  );
 end;
$$;

create or replace function public.ops_toggle_checklist(p_token text, p_item_id uuid, p_done boolean)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; item public.task_checklist_items; task public.tasks;
 begin
  eid:=public.ops_current_employee(p_token);
  if eid is null then return jsonb_build_object('error','Sesión inválida.'); end if;
  select * into item from public.task_checklist_items where id=p_item_id;
  if item.id is null then return jsonb_build_object('error','Ítem no encontrado.'); end if;
  select * into task from public.tasks where id=item.task_id for update;
  if task.assigned_employee_id is distinct from eid then
   return jsonb_build_object('error','Esta tarea no está asignada a ti.');
  end if;
  if task.status in ('approved') then return jsonb_build_object('error','La tarea ya fue aprobada.'); end if;
  update public.task_checklist_items
   set done=p_done,
       done_at=case when p_done then now() else null end,
       done_by_employee_id=case when p_done then eid else null end
  where id=p_item_id;
  update public.tasks set status='in_progress' where id=task.id and status='pending';
  return jsonb_build_object('ok',true);
 end;
$$;

create or replace function public.ops_complete_task(p_token text, p_task_id uuid, p_comment text, p_photo text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare eid uuid; task public.tasks; need_photo boolean; img bytea;
 begin
  eid:=public.ops_current_employee(p_token);
  if eid is null then return jsonb_build_object('error','Sesión inválida.'); end if;
  select * into task from public.tasks where id=p_task_id for update;
  if task.id is null then return jsonb_build_object('error','Tarea no encontrada.'); end if;
  if task.assigned_employee_id is distinct from eid then
   return jsonb_build_object('error','Esta tarea no está asignada a ti.');
  end if;
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
  update public.tasks set status='completed',completed_at=now(),completed_by=eid where id=task.id;
  return jsonb_build_object('ok',true);
 end;
$$;

revoke execute on function public.ops_assign_task(uuid,uuid) from public,anon;
revoke execute on function public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb,uuid) from public,anon;
grant execute on function public.ops_assign_task(uuid,uuid),
 public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb,uuid) to authenticated;

commit;
