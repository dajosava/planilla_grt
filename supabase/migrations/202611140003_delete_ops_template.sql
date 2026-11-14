-- Admin: eliminar plantilla de operaciones (confirma con el título).
begin;

create function public.ops_delete_template(p_id uuid, p_confirm_title text)
 returns void
 language plpgsql
 security definer
 set search_path=''
as $$
declare
  t public.task_templates;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into t from public.task_templates where id=p_id for update;
  if t.id is null then
    raise exception 'Plantilla no encontrada';
  end if;
  if trim(coalesce(p_confirm_title,'')) <> t.title then
    raise exception 'El título de confirmación no coincide.';
  end if;

  -- Quita tareas abiertas de esta plantilla; el historial aprobado queda (template_id → null).
  delete from public.tasks
  where template_id=t.id
    and status in ('pending','in_progress','rejected');

  delete from public.task_templates where id=t.id;
end;
$$;

revoke all on function public.ops_delete_template(uuid,text) from public,anon;
grant execute on function public.ops_delete_template(uuid,text) to authenticated;

commit;
