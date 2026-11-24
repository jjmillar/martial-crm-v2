-- Students contract a plan themselves (2026-11-24): the enrollment waits "pendiente" (por pagar) until its first
-- payment is confirmed. The new value is added on its own because Postgres can't use it in the same transaction.
alter type public.enrollment_status add value if not exists 'pendiente';
