begin;
-- A monthly payroll cannot be finalized before its period has ended.
create function public.guard_payroll_close() returns trigger language plpgsql set search_path='' as $$
 begin
 if NEW.status='closed' and OLD.status<>'closed' and
 clock_timestamp()<((NEW.period_end+1)::timestamp at time zone 'America/Costa_Rica') then
 raise exception 'El período mensual todavía no ha terminado';end if;
 return NEW;
 end;
$$;
create trigger prevent_early_close before update on public.payroll_runs for each row execute function public.guard_payroll_close();
create function public.guard_shift_overlap() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 perform 1 from public.employees where id=NEW.employee_id for update;
 if exists(select 1 from public.shifts where employee_id=NEW.employee_id and id<>NEW.id and starts_at<NEW.ends_at and ends_at>NEW.starts_at) then
 raise exception 'El empleado tiene otro turno que se superpone';end if;
 return NEW;
 end;
$$;
create trigger prevent_shift_overlap before insert on public.shifts for each row execute function public.guard_shift_overlap();
revoke execute on function public.guard_payroll_close(),public.guard_shift_overlap() from public,anon,authenticated;
commit;
