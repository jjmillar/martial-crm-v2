-- Escuelas cards (card item 2): per-school counters in one round trip.
-- security invoker: RLS decides which schools the caller sees (CEO: all; staff: their own).
create or replace function public.school_stats()
returns table (school_id uuid, students_active int, teachers_active int, classes_active int, members int, attendance_30d int)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id,
    (select count(*)::int from public.students st where st.school_id = s.id and st.active),
    (select count(*)::int from public.teachers t where t.school_id = s.id and t.active),
    (select count(*)::int from public.classes c where c.school_id = s.id and c.active),
    (select count(*)::int from public.school_members m where m.school_id = s.id),
    (select count(*)::int from public.attendance a where a.school_id = s.id and a.date > current_date - 30)
  from public.schools s;
$$;

grant execute on function public.school_stats() to authenticated;
