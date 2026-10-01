begin;
revoke insert on public.attendance_adjustments from authenticated;
drop policy admin_adjustment_insert on public.attendance_adjustments;
create function public.correct_session(p_session uuid,p_start timestamptz,p_end timestamptz,p_break integer,p_reason text)
 returns void language plpgsql security definer set search_path='' as $$
 declare s public.attendance_sessions;
 begin
 if not public.is_admin() then raise exception 'No autorizado';end if;
 select * into s from public.attendance_sessions where id=p_session for update;
 if s.id is null then raise exception 'Jornada no encontrada';end if;
 if exists(select 1 from public.payroll_runs where status='closed' and
 ((s.started_at at time zone 'America/Costa_Rica')::date between period_start and period_end
 or (p_start at time zone 'America/Costa_Rica')::date between period_start and period_end)) then
 raise exception 'La jornada pertenece a una planilla cerrada';end if;
 insert into public.attendance_adjustments(session_id,started_at,ended_at,break_minutes,reason)
 values(p_session,p_start,p_end,p_break,p_reason);
 -- Derived session may be closed by an adjustment; original attendance_events never change.
 if s.ended_at is null then
 update public.attendance_sessions set ended_at=p_end,break_started_at=null where id=s.id;
 end if;
 end;
$$;
revoke execute on function public.correct_session(uuid,timestamptz,timestamptz,integer,text) from public,anon;
grant execute on function public.correct_session(uuid,timestamptz,timestamptz,integer,text) to authenticated;
create trigger audit after update on public.attendance_sessions for each row execute function public.audit_change();
commit;
