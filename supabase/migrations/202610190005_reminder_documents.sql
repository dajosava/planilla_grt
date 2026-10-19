begin;
-- Documentos adjuntos a recordatorios de trámites (PDF / imágenes / Word).

create table public.business_reminder_documents (
 id uuid primary key default gen_random_uuid(),
 reminder_id uuid not null references public.business_reminders(id) on delete cascade,
 file_name text not null check (length(trim(file_name)) between 1 and 180),
 mime_type text not null check (mime_type in (
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 )),
 file_size integer not null check (file_size > 0 and file_size <= 5242880),
 content bytea not null check (octet_length(content) <= 5242880),
 created_by uuid default auth.uid(),
 created_at timestamptz not null default now()
);

create index reminder_docs_reminder on public.business_reminder_documents(reminder_id);

alter table public.business_reminder_documents enable row level security;
revoke all on public.business_reminder_documents from anon, authenticated;
grant select on public.business_reminder_documents to authenticated;

create policy admin_reminder_docs_read on public.business_reminder_documents
 for select to authenticated using (public.is_admin());

create or replace function public.upload_reminder_document(
 p_reminder_id uuid,
 p_file_name text,
 p_mime text,
 p_content_b64 text
) returns uuid language plpgsql security definer set search_path='' as $$
 declare
  did uuid;
  raw bytea;
  fname text:=trim(coalesce(p_file_name,''));
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if not exists(select 1 from public.business_reminders where id=p_reminder_id) then
   raise exception 'Recordatorio no encontrado';
  end if;
  if length(fname) < 1 or length(fname) > 180 then raise exception 'Nombre de archivo inválido'; end if;
  if p_mime not in (
   'application/pdf','image/jpeg','image/png','image/webp',
   'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then raise exception 'Tipo de archivo no permitido. Usá PDF, JPG, PNG, WEBP o Word.'; end if;
  if p_content_b64 is null or length(p_content_b64) < 8 or length(p_content_b64) > 7000000 then
   raise exception 'El archivo es inválido o demasiado grande (máx. 5 MB)';
  end if;
  begin
   raw:=decode(p_content_b64,'base64');
  exception when others then
   raise exception 'No se pudo leer el archivo';
  end;
  if raw is null or octet_length(raw) < 1 or octet_length(raw) > 5242880 then
   raise exception 'El archivo es inválido o demasiado grande (máx. 5 MB)';
  end if;
  -- Magic bytes básicos
  if p_mime='application/pdf' and substring(raw from 1 for 4) <> '%PDF'::bytea then
   raise exception 'El PDF no es válido';
  end if;
  if p_mime='image/jpeg' and substring(raw from 1 for 3) <> '\xffd8ff'::bytea then
   raise exception 'La imagen JPEG no es válida';
  end if;
  if p_mime='image/png' and substring(raw from 1 for 8) <> '\x89504e470d0a1a0a'::bytea then
   raise exception 'La imagen PNG no es válida';
  end if;

  insert into public.business_reminder_documents(reminder_id,file_name,mime_type,file_size,content,created_by)
  values(p_reminder_id,fname,p_mime,octet_length(raw),raw,auth.uid())
  returning id into did;
  return did;
 end;
$$;

create or replace function public.delete_reminder_document(p_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  delete from public.business_reminder_documents where id=p_id;
  if not found then raise exception 'Documento no encontrado'; end if;
 end;
$$;

revoke execute on function public.upload_reminder_document(uuid,text,text,text) from public,anon;
revoke execute on function public.delete_reminder_document(uuid) from public,anon;
grant execute on function public.upload_reminder_document(uuid,text,text,text) to authenticated;
grant execute on function public.delete_reminder_document(uuid) to authenticated;

commit;
