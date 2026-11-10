-- Estado de envío de colillas por correo (después de cerrar la quincena).
begin;

alter table public.payroll_items
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending','sent','failed','skipped')),
  add column if not exists email_error text not null default '';

comment on column public.payroll_items.email_status is
  'pending=sin enviar; sent=enviado; failed=error; skipped=sin correo válido';
comment on column public.payroll_items.email_sent_at is 'Último envío exitoso';
comment on column public.payroll_items.email_error is 'Último error de envío';

create or replace function public.mark_payroll_item_email(
  p_id uuid,
  p_status text,
  p_error text default ''
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_status not in ('pending','sent','failed','skipped') then
    raise exception 'Estado de correo inválido';
  end if;

  update public.payroll_items set
    email_status=p_status,
    email_error=coalesce(p_error,''),
    email_sent_at=case when p_status='sent' then now() else email_sent_at end
  where id=p_id;

  if not found then
    raise exception 'Ítem de planilla no encontrado';
  end if;
end;
$$;

revoke all on function public.mark_payroll_item_email(uuid,text,text) from public,anon;
grant execute on function public.mark_payroll_item_email(uuid,text,text) to authenticated;

commit;
