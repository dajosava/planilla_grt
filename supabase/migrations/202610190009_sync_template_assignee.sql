-- Al asignar una plantilla a un empleado, las tareas abiertas de hoy
-- deben reflejar esa asignación (antes solo aplicaba a tareas nuevas).

begin;

create or replace function public.ops_upsert_template(
 p_id uuid, p_title text, p_area public.ops_area, p_recurrence text,
 p_due_offset integer, p_active boolean, p_items jsonb, p_assignee uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
 declare tid uuid; sid uuid; item jsonb; i int:=0;
  today date:=(timezone('America/Costa_Rica',now()))::date;
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

  -- Propagar asignación a tareas abiertas de hoy de esta plantilla
  update public.tasks
   set assigned_employee_id=p_assignee,
       title=p_title,
       area=p_area,
       due_at=(today::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>p_due_offset)
   where template_id=tid
     and run_date=today
     and status in ('pending','in_progress');

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
   else
    -- Ya existía: sincronizar asignado/título/vencimiento en tareas abiertas
    update public.tasks
     set assigned_employee_id=t.default_assignee_id,
         title=t.title,
         area=t.area,
         due_at=(run::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>t.due_offset_minutes)
     where template_id=t.id
       and run_date=run
       and status in ('pending','in_progress');
   end if;
  end loop;
  return n;
 end;
$$;

revoke execute on function public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb,uuid) from public,anon;
grant execute on function public.ops_upsert_template(uuid,text,public.ops_area,text,integer,boolean,jsonb,uuid) to authenticated;
revoke execute on function public.ops_generate_tasks_for_date(date) from public,anon;
grant execute on function public.ops_generate_tasks_for_date(date) to authenticated;

commit;
