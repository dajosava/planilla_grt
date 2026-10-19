begin;
-- Tareas ocasionales (sin plantilla): una sola vez, para el día indicado.

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
   sid,
   null,
   trim(p_title),
   p_area,
   (run::timestamp at time zone 'America/Costa_Rica')+make_interval(mins=>p_due_offset),
   run,
   p_assignee
  )
  returning id into tid;

  for item in select * from jsonb_array_elements(p_items) loop
   if length(trim(coalesce(item->>'label',''))) < 2 then
    raise exception 'Cada ítem debe tener al menos 2 caracteres';
   end if;
   insert into public.task_checklist_items(task_id,label,sort_order,requires_photo)
   values(
    tid,
    trim(item->>'label'),
    i,
    coalesce((item->>'requires_photo')::boolean,false)
   );
   i:=i+1;
  end loop;

  return tid;
 end;
$$;

revoke execute on function public.ops_create_ad_hoc_task(text,public.ops_area,date,integer,uuid,jsonb) from public,anon;
grant execute on function public.ops_create_ad_hoc_task(text,public.ops_area,date,integer,uuid,jsonb) to authenticated;

commit;
