-- Every night (00:20 Chile ≈ 03:20 UTC, after the sessions) the expenses of the active rules are created / updated.
select cron.schedule('expenses-daily', '20 3 * * *', $$select public.sync_all_expenses()$$);
