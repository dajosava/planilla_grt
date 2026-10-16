begin;
create table public.punch_photos (
 event_id uuid primary key references public.attendance_events(id) on delete cascade,
 status text not null check(status in ('captured','missing','expired')),
 image bytea, created_at timestamptz not null default now(),
 check((status='captured')=(image is not null)),
 check(image is null or octet_length(image)<=200000)
);
create index punch_photos_created on public.punch_photos(created_at) where image is not null;
alter table public.punch_photos enable row level security;
revoke all on public.punch_photos from anon,authenticated;
grant select on public.punch_photos to authenticated;
create policy admin_read on public.punch_photos for select to authenticated using(public.is_admin());

create function public.register_punch_with_photo(p_code text,p_pin text,p_kind public.punch_kind,p_request_id uuid,p_photo text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare r jsonb; img bytea;
 begin
 r:=public.register_punch(p_code,p_pin,p_kind,p_request_id);
 if not coalesce((r->>'ok')::boolean,false) then return r;end if;
 -- A photo that cannot be decoded or is not a JPEG must never block a valid punch.
 begin
 if p_photo is not null and length(p_photo)<=270000 then img:=decode(p_photo,'base64');end if;
 exception when others then img:=null;
 end;
 if img is not null and (octet_length(img)>200000 or substring(img from 1 for 3)<>'\xffd8ff'::bytea) then img:=null;end if;
 insert into public.punch_photos(event_id,status,image)
 values(p_request_id,case when img is null then 'missing' else 'captured' end,img)
 on conflict (event_id) do nothing;
 -- Retention: photos are kept for 30 days.
 update public.punch_photos set status='expired',image=null where image is not null and created_at<now()-interval '30 days';
 return r||jsonb_build_object('photo',img is not null);
 end;
$$;
revoke execute on function public.register_punch_with_photo(text,text,public.punch_kind,uuid,text) from public,anon;
grant execute on function public.register_punch_with_photo(text,text,public.punch_kind,uuid,text) to authenticated;
commit;
