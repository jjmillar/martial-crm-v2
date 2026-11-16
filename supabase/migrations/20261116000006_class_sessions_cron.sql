-- Every night (00:10 Chile ≈ 03:10 UTC) the day's sessions are created and numbered.
select cron.schedule('class-sessions-daily', '10 3 * * *', $$select public.sync_all_class_sessions()$$);
