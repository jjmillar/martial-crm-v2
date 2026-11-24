-- Términos y condiciones + Política de privacidad (Ley 21.719): every new account accepts the current version when it
-- is created, and the acceptance is kept as evidence (who, which version, when, and — for children under 14 — that a
-- parent or legal guardian gave the consent). Minimal data: no IP, no user agent.
--
-- Writes: the account-signup Edge Function (service role) records the acceptance of public sign-ups; a signed-in user
-- (invited staff setting their password) records their own through accept_terms(). Nobody edits or deletes a row
-- from the app; rows go away only with the auth user (cascade), as the law's deletion right requires.

create or replace function public.current_terms_version()
returns text language sql immutable set search_path = ''
as $$ select '2026-11-24'::text $$;
revoke execute on function public.current_terms_version() from public, anon;
grant execute on function public.current_terms_version() to authenticated, service_role;

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null check (length(version) between 1 and 20),
  context text not null check (context in ('ceo', 'alumno', 'claim', 'invitacion')),
  guardian_consent boolean not null default false,
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;

-- Each person sees only their own acceptances.
create policy terms_acceptances_own on public.terms_acceptances
  for select to authenticated using (user_id = auth.uid());

-- A signed-in user accepts the current version (idempotent). Only the current version is accepted.
create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  if p_version is distinct from public.current_terms_version() then raise exception 'outdated terms version'; end if;
  insert into public.terms_acceptances (user_id, version, context)
  values (auth.uid(), p_version, 'invitacion')
  on conflict (user_id, version) do nothing;
end;
$$;
revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
