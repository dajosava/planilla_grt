begin;
alter table public.employees drop constraint if exists employees_code_check;
alter table public.employees add constraint employees_code_check
 check(code ~ '^[A-Z0-9-]{1,12}$');
commit;
