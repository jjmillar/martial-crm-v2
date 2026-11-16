-- Trial classes come from the school's classes (20261116000002); the old manual slots go away.
drop index if exists public.trial_bookings_slot_idx;
alter table public.trial_bookings drop column if exists slot_id;
drop table if exists public.trial_slots;
