-- Admin: eliminar una tarea asignada por error.
begin;

create function public.ops_delete_task(p_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  t public.tasks;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Indica un motivo de al menos 5 caracteres.';
  end if;

  select * into t from public.tasks where id=p_id for update;
  if t.id is null then
    raise exception 'Tarea no encontrada';
  end if;

  insert into public.audit_log(table_name,record_id,operation,before_data,after_data)
  values(
    'tasks',
    t.id::text,
    'DELETE_TASK',
    to_jsonb(t)||jsonb_build_object('reason',trim(p_reason)),
    null
  );

  -- checklist + evidencia caen por ON DELETE CASCADE
  delete from public.tasks where id=t.id;
end;
$$;

revoke all on function public.ops_delete_task(uuid,text) from public,anon;
grant execute on function public.ops_delete_task(uuid,text) to authenticated;

commit;
