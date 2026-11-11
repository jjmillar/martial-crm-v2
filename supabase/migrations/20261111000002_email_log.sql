-- T15: outgoing email log (S12).
-- Every app email (tests, payment receipts, announcements...) is sent by an Edge Function through Resend
-- and recorded here. Rows are written only with the service role; school admins and the CEO can read them.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  template text not null check (template ~ '^[a-z0-9_]{2,48}$'),
  to_email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed')),
  provider_id text,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index email_log_school_created_idx on public.email_log (school_id, created_at desc);

alter table public.email_log enable row level security;

create policy email_log_select on public.email_log
  for select to authenticated
  using (
    public.is_ceo()
    or (school_id is not null and public.has_school_role(school_id, array['admin']::public.school_role[]))
  );

-- No insert/update/delete policies: only the service role (Edge Functions) writes.
revoke insert, update, delete on public.email_log from anon, authenticated;
