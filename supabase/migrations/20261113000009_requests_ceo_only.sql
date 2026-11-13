-- Only the CEO sees and decides account requests (school admins no longer do).
drop policy account_requests_select on public.account_requests;
create policy account_requests_select on public.account_requests for select to authenticated
  using (user_id = auth.uid() or public.is_ceo());

create or replace function public.decide_account_request(
  p_id uuid, p_approve boolean, p_student_id uuid default null, p_role public.school_role default 'user'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.account_requests;
  sid uuid;
begin
  if not public.is_ceo() then raise exception 'only the CEO can decide requests'; end if;
  select * into r from public.account_requests where id = p_id;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pendiente' then raise exception 'request already decided'; end if;

  if p_approve and r.kind = 'alumno' then
    if p_student_id is not null then
      update public.students set user_id = r.user_id
      where id = p_student_id and school_id = r.school_id and user_id is null
      returning id into sid;
      if sid is null then raise exception 'student not available'; end if;
    else
      insert into public.students (school_id, first_name, first_last_name, rut, email, phone, user_id)
      values (r.school_id, r.first_name, r.first_last_name, r.rut, r.email, r.phone, r.user_id)
      returning id into sid;
    end if;
  elsif p_approve and r.kind = 'miembro' then
    insert into public.school_members (school_id, user_id, role) values (r.school_id, r.user_id, p_role)
    on conflict (school_id, user_id) do nothing;
  end if;

  update public.account_requests
  set status = case when p_approve then 'aprobada'::public.request_status else 'rechazada' end,
      student_id = sid, decided_by = auth.uid(), decided_at = now()
  where id = r.id;
  return sid;
end;
$$;
