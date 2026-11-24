-- Tareas lists the classes that already ended (last 7 days) without a single confirmed attendance. A class that did
-- not take place (holiday, suspended) is marked "no se realizó" so it leaves that list; it can be undone.

alter table public.class_sessions add column not_held boolean not null default false;

-- The team (any member: teachers too) marks or unmarks a past or current session as not held.
create or replace function public.set_session_not_held(p_session_id uuid, p_not_held boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  se public.class_sessions;
begin
  select * into se from public.class_sessions where id = p_session_id;
  if not found or not public.is_school_member(se.school_id) then raise exception 'not allowed'; end if;
  if se.date > (now() at time zone 'America/Santiago')::date then raise exception 'future session'; end if;
  update public.class_sessions set not_held = coalesce(p_not_held, false) where id = se.id;
  perform public.audit(se.school_id, case when p_not_held then 'session_not_held' else 'session_held' end, 'class_sessions', se.id,
                       jsonb_build_object('date', se.date, 'name', se.name));
end;
$$;
revoke execute on function public.set_session_not_held(uuid, boolean) from public, anon;
grant execute on function public.set_session_not_held(uuid, boolean) to authenticated;
