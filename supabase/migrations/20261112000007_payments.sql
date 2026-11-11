-- T11: payments (S2, S3, S6, S7). CLP integer pesos.
-- Users register payments as 'pendiente'; only admins confirm (S3). Confirmation stamps paid_at/confirmed_by
-- in the DB. Students with payments can't be deleted (history is kept; deactivate them instead).

create type public.payment_method as enum ('transferencia', 'efectivo', 'tarjeta', 'otro');
create type public.payment_status as enum ('pendiente', 'pagado', 'fallido', 'reembolsado');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  enrollment_id uuid,
  concept text not null check (length(btrim(concept)) between 1 and 120),
  amount integer not null check (amount > 0 and amount <= 100000000),
  method public.payment_method not null default 'transferencia',
  status public.payment_status not null default 'pendiente',
  due_date date,
  paid_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  receipt_path text check (receipt_path is null or length(receipt_path) <= 300),
  notes text check (notes is null or length(notes) <= 400),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete restrict,
  foreign key (enrollment_id, school_id) references public.enrollments (id, school_id) on delete set null (enrollment_id)
);

create index payments_school_status_idx on public.payments (school_id, status, created_at desc);
create index payments_school_paid_idx on public.payments (school_id, paid_at) where status = 'pagado';
create index payments_student_idx on public.payments (student_id, created_at desc);

create trigger payments_created_by before insert on public.payments
  for each row execute function public.set_created_by();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger payments_school_fixed before update on public.payments
  for each row execute function public.prevent_school_change();

-- Becoming 'pagado' stamps when and by whom; going back to pendiente/fallido clears it.
create or replace function public.payments_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'pagado' and (tg_op = 'INSERT' or old.status is distinct from 'pagado') then
    new.paid_at := coalesce(new.paid_at, now());
    new.confirmed_by := coalesce(auth.uid(), new.confirmed_by);
  elsif new.status in ('pendiente', 'fallido') then
    new.paid_at := null;
    new.confirmed_by := null;
  end if;
  return new;
end;
$$;

create trigger payments_confirmation before insert or update of status on public.payments
  for each row execute function public.payments_confirmation();

alter table public.payments enable row level security;

create policy payments_select on public.payments for select to authenticated
  using (public.is_school_member(school_id));
-- Members register payments; only admins may create them already confirmed.
create policy payments_insert on public.payments for insert to authenticated
  with check (
    public.is_school_member(school_id)
    and (status = 'pendiente' or public.has_school_role(school_id, array['admin']::public.school_role[]))
  );
create policy payments_update on public.payments for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy payments_delete on public.payments for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
