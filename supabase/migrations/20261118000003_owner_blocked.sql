-- A customer whose subscription is suspended or cancelled is no longer an owner for the app: they cannot create new
-- schools to get around the block, and the app shows them the "suscripción suspendida" screen.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.owners where user_id = auth.uid()) and public.mfa_ok()
     and not exists (select 1 from public.subscriptions where owner_id = auth.uid() and status in ('suspendida', 'cancelada'));
$$;
