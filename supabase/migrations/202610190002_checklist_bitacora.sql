begin;
-- Checklist: marcar ítems para bitácora imprimible + propagar en generación.

alter table public.task_template_items
 add column if not exists for_bitacora boolean not null default false;

alter table public.task_checklist_items
 add column if not exists for_bitacora boolean not null default false;

create or replace function public.ops_upsert_template(
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
   insert into public.task_template_items(template_id,label,sort_order,requires_photo,for_bitacora)
   values(
    tid,
    item->>'label',
    i,
    coalesce((item->>'requires_photo')::boolean,false),
    coalesce((item->>'for_bitacora')::boolean,false)
   );
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
    insert into public.task_checklist_items(task_id,label,sort_order,requires_photo,for_bitacora)
    select tid,label,sort_order,requires_photo,for_bitacora
    from public.task_template_items where template_id=t.id order by sort_order;
    n:=n+1;
   end if;
  end loop;
  return n;
 end;
$$;

create or replace function public.ops_create_ad_hoc_task(
 p_title text,
 p_area public.ops_area,
 p_run_date date,
 p_due_offset integer,
 p_assignee uuid,
 p_items jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
 declare
  tid uuid;
  sid uuid;
  run date:=coalesce(p_run_date,(timezone('America/Costa_Rica',now()))::date);
  item jsonb;
  i int:=0;
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if length(trim(coalesce(p_title,''))) < 3 or length(trim(p_title)) > 120 then
   raise exception 'El título debe tener entre 3 y 120 caracteres';
  end if;
  if p_due_offset is null or p_due_offset < 5 or p_due_offset > 1440 then
   raise exception 'La hora de vencimiento no es válida';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) < 1 then
   raise exception 'Agrega al menos un ítem del checklist';
  end if;
  if p_assignee is not null and not exists(
   select 1 from public.employees where id=p_assignee and active
  ) then raise exception 'Empleado asignado no válido'; end if;

  select id into sid from public.stations where active order by created_at limit 1;
  if sid is null then raise exception 'No hay estación configurada'; end if;

  insert into public.tasks(station_id,template_id,title,area,due_at,run_date,assigned_employee_id)
  values(
   sid,null,trim(p_title),p_area,
   (run::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>p_due_offset),
   run,p_assignee
  )
  returning id into tid;

  for item in select * from jsonb_array_elements(p_items) loop
   if length(trim(coalesce(item->>'label',''))) < 2 then
    raise exception 'Cada ítem debe tener al menos 2 caracteres';
   end if;
   insert into public.task_checklist_items(task_id,label,sort_order,requires_photo,for_bitacora)
   values(
    tid,
    trim(item->>'label'),
    i,
    coalesce((item->>'requires_photo')::boolean,false),
    coalesce((item->>'for_bitacora')::boolean,false)
   );
   i:=i+1;
  end loop;

  return tid;
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
       'id',c.id,'label',c.label,'done',c.done,'requires_photo',c.requires_photo,'for_bitacora',c.for_bitacora
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

commit;
