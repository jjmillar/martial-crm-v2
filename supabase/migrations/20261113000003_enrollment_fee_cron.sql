-- Card item 4: daily run of the enrollment-fee generator (04:15 Chile ≈ 07:15 UTC). Runs as postgres, so
-- generate_enrollment_fees() covers every school. Skipped by the PGlite harness (no pg_cron there).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('enrollment-fees-daily', '15 7 * * *', $$select public.generate_enrollment_fees()$$);
