-- T11 follow-up: members (not only admins) attach receipts to payments.
-- payments UPDATE is admin-only, so a narrow RPC sets receipt_path: any member while the payment is pending or
-- has no receipt yet; admins always. The path must live under '<school_id>/<payment_id>/'.
create or replace function public.attach_payment_receipt(p_payment_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.payments%rowtype;
begin
  select * into v from public.payments where id = p_payment_id;
  if v.id is null or not public.is_school_member(v.school_id) then
    raise exception 'payment not found';
  end if;
  if p_path is null or p_path not like (v.school_id::text || '/' || v.id::text || '/%') then
    raise exception 'invalid receipt path';
  end if;
  if not public.has_school_role(v.school_id, array['admin']::public.school_role[])
     and not (v.status = 'pendiente' or v.receipt_path is null) then
    raise exception 'only admins can replace this receipt';
  end if;
  update public.payments set receipt_path = p_path where id = p_payment_id;
end;
$$;

revoke execute on function public.attach_payment_receipt(uuid, text) from public, anon;
grant execute on function public.attach_payment_receipt(uuid, text) to authenticated;
