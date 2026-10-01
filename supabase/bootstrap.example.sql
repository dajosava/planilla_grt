-- Ejecutar SOLO en el SQL Editor con acceso de propietario del proyecto.
-- Antes: crea los dos usuarios en Supabase Authentication > Users:
--   admin@support-grt.com  (administrador)
--   registroasistencia@grt.com  (cuenta kiosk de la tablet)
begin;
do $$ begin
 if (select count(*) from auth.users where email in ('admin@support-grt.com','registroasistencia@grt.com'))<>2 then
 raise exception 'Crea las cuentas admin@support-grt.com y registroasistencia@grt.com antes de ejecutar';end if;
end $$;
insert into public.profiles(id,display_name,role)
select id,'Administrador Gasolinera Río Tempisque','admin'::public.app_role from auth.users where email='admin@support-grt.com'
on conflict (id) do update set display_name=excluded.display_name, role=excluded.role;
insert into public.profiles(id,display_name,role)
select id,'Tablet oficina','kiosk'::public.app_role from auth.users where email='registroasistencia@grt.com'
on conflict (id) do update set display_name=excluded.display_name, role=excluded.role;
insert into public.devices(user_id,name)
select id,'Tablet gasolinera' from auth.users where email='registroasistencia@grt.com'
on conflict (user_id) do update set name=excluded.name, active=true;
commit;
-- Para revocar la tablet: update public.devices set active=false where user_id='UUID_DE_LA_CUENTA';
-- Cada terminal física adicional necesita su propia cuenta kiosk y fila devices.
