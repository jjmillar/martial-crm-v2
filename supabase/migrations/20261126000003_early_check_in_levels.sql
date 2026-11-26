-- 1. Students can mark their attendance from 1 hour before the class starts (same as the QR), not only once it started.
-- 2. Levels get harder: going from level n to n+1 takes 100 + 10·(n−1) XP (1→2: 100, 2→3: 110, 3→4: 120…).
--    XP is still 10 per approved class. Level, progress and the "Nivel N" milestones follow the new curve.

-- XP needed to reach a level from zero (level 1 = 0): sum of 100 + 10·(k−1) for k = 1..n−1.
create or replace function public.xp_to_reach(p_level integer)
returns integer language sql immutable set search_path = ''
as $$ select (100 * (greatest(p_level, 1) - 1) + 5 * (greatest(p_level, 1) - 1) * (greatest(p_level, 1) - 2))::integer $$;

-- Level for an XP total: {level, level_xp (XP inside the current level), next_level_xp (XP the level needs)}.
create or replace function public.xp_level(p_xp integer)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare
  lvl integer := 1;
  need integer := 100;
  rest integer := greatest(coalesce(p_xp, 0), 0);
begin
  while rest >= need loop
    rest := rest - need;
    lvl := lvl + 1;
    need := need + 10;
  end loop;
  return jsonb_build_object('level', lvl, 'level_xp', rest, 'next_level_xp', need);
end;
$$;
revoke execute on function public.xp_to_reach(integer), public.xp_level(integer) from public, anon;
grant execute on function public.xp_to_reach(integer), public.xp_level(integer) to authenticated;

-- A class is open for attendance from 1 hour before it starts (Chile time); earlier days are always open.
create or replace function public.class_open(p_class_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with now_cl as (select (now() at time zone 'America/Santiago') as ts)
  select case
    when p_date < (select ts from now_cl)::date then true
    when p_date > (select ts from now_cl)::date + 1 then false
    else exists (
      select 1 from public.class_schedules cs
      where cs.class_id = p_class_id and cs.weekday = extract(isodow from p_date)
        and p_date + cs.start_time - interval '1 hour' <= (select ts from now_cl)
    ) or exists (
      select 1 from public.class_sessions s
      where s.class_id = p_class_id and s.date = p_date and p_date + s.start_time - interval '1 hour' <= (select ts from now_cl)
    )
  end;
$$;
revoke execute on function public.class_open(uuid, date) from public, anon;
grant execute on function public.class_open(uuid, date) to authenticated;

create or replace function public.attendance_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.class_open(new.class_id, new.date)
     and coalesce(current_setting('mcrm.qr_check_in', true), '') <> 'on' then
    raise exception 'class not started';
  end if;
  return new;
end;
$$;
revoke execute on function public.attendance_window() from public, anon, authenticated;

create or replace function public.student_progress(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  st record;
  xp integer;
  skills jsonb;
begin
  select id, school_id, user_id into st from public.students where id = p_student_id;
  if not found then return null; end if;
  if not (public.is_school_member(st.school_id) or coalesce(st.user_id = auth.uid(), false) or st.id in (select public.my_ward_ids())) then
    raise exception 'not allowed';
  end if;
  select 10 * count(*) into xp from public.attendance where student_id = st.id and confirmed_at is not null;
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', t.id, 'label', t.label, 'icon', t.icon, 'xp', s.xp) order by s.xp desc, t.label), '[]'::jsonb)
    into skills
    from (
      select x.tag_id, 10 * count(*) as xp
      from (
        select a.id, unnest(coalesce(
                 (select se.skill_ids from public.class_sessions se where se.class_id = a.class_id and se.date = a.date order by se.start_time limit 1),
                 public.class_snapshot_skills(a.class_id))) as tag_id
        from public.attendance a
        where a.student_id = st.id and a.confirmed_at is not null
      ) x
      group by x.tag_id
    ) s join public.tags t on t.id = s.tag_id;
  return public.xp_level(xp) || jsonb_build_object(
    'xp', xp,
    'attended', xp / 10,
    'pending', (select count(*) from public.attendance where student_id = st.id and confirmed_at is null),
    'skills', skills
  );
end;
$$;

create or replace function public.student_public_profile(p_slug text, p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'handle', sp.handle,
    'name', btrim(st.first_name || ' ' || st.first_last_name),
    'initials', upper(left(st.first_name, 1) || left(st.first_last_name, 1)),
    'headline', sp.headline,
    'bio', sp.bio,
    'since', st.enrollment_date,
    'belt', case when sp.show_belt then st.belt end,
    'belt_degree', case when sp.show_belt then st.belt_degree end,
    'arts', case when sp.show_belt then coalesce((
        select jsonb_agg(jsonb_build_object('art', a.name, 'belt', b.name, 'color', b.color, 'stripe', b.stripe, 'bar', b.bar, 'pattern', b.pattern,
                                            'degree', sa.degree, 'degree_text', public.degree_text(sa.degree, b.degree_name),
                                            'rank', b.rank_label, 'track', b.track)
                         order by a.position, a.name)
        from public.student_arts sa join public.school_arts a on a.id = sa.art_id
        left join public.school_belts b on b.id = sa.belt_id
        where sa.student_id = st.id), '[]'::jsonb) end,
    'stats', case when sp.show_stats then public.xp_level(x.xp) || jsonb_build_object('xp', x.xp, 'attended', x.xp / 10) end,
    'skills', case when sp.show_skills then coalesce((
        select jsonb_agg(jsonb_build_object('label', t.label, 'icon', t.icon, 'xp', k.xp) order by k.xp desc, t.label)
        from (
          select y.tag_id, 10 * count(*) as xp
          from (
            select unnest(coalesce(
                     (select se.skill_ids from public.class_sessions se where se.class_id = a.class_id and se.date = a.date order by se.start_time limit 1),
                     public.class_snapshot_skills(a.class_id))) as tag_id
            from public.attendance a
            where a.student_id = st.id and a.confirmed_at is not null
          ) y group by y.tag_id
        ) k join public.tags t on t.id = k.tag_id), '[]'::jsonb) end,
    'achievements', case when sp.show_achievements then coalesce((
        select jsonb_agg(jsonb_build_object('kind', ac.kind, 'title', ac.title, 'detail', ac.detail, 'date', ac.date,
                                            'medal', ac.medal, 'category', ac.category, 'art', a.name,
                                            'color', b.color, 'stripe', b.stripe, 'bar', b.bar, 'pattern', b.pattern, 'icon', bd.icon)
                         order by ac.date desc, ac.created_at desc)
        from public.achievements ac
        left join public.school_arts a on a.id = ac.art_id
        left join public.school_belts b on b.id = ac.belt_id
        left join public.school_badges bd on bd.id = ac.badge_id
        where ac.student_id = st.id and ac.status = 'aprobado'), '[]'::jsonb) end,
    'milestones', case when sp.show_achievements then public.student_milestones(st.id) end,
    'school', jsonb_build_object('slug', s.slug, 'name', s.name, 'logo_url', s.logo_url, 'city', s.city,
                                 'theme', s.landing_theme, 'primary', s.landing_primary, 'accent', s.landing_accent,
                                 'landing', s.landing_enabled)
  )
  from public.schools s
  join public.student_profiles sp on sp.school_id = s.id and sp.handle = lower(p_handle) and sp.published
  join public.students st on st.id = sp.student_id and st.active
  cross join lateral (select 10 * count(*)::int as xp from public.attendance where student_id = st.id and confirmed_at is not null) x
  where s.slug = p_slug;
$$;

create or replace function public.student_milestones(p_student_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with att as (
    select a.date, row_number() over (order by a.date, a.created_at) as n
    from public.attendance a where a.student_id = p_student_id and a.confirmed_at is not null
  ),
  weeks as (select distinct date_trunc('week', date)::date as wk from att),
  islands as (select wk, wk - (row_number() over (order by wk) * 7)::int as grp from weeks),
  streaks as (select wk, row_number() over (partition by grp order by wk) as k from islands),
  m as (
    select 'clases-' || c.n as key, 'asistencia' as kind,
           case when c.n = 1 then 'Primera clase' else c.n || ' clases' end as title,
           case when c.n = 1 then '🥋' else '🏅' end as icon, att.date
    from unnest(array[1, 10, 25, 50, 100, 250, 500, 1000]) as c(n) join att on att.n = c.n
    union all
    select 'nivel-' || l.lv, 'nivel', 'Nivel ' || l.lv, '⭐', att.date
    from unnest(array[5, 10, 20, 30, 50]) as l(lv) join att on att.n = ceil(public.xp_to_reach(l.lv) / 10.0)::int
    union all
    select 'racha-' || r.w, 'racha', r.w || ' semanas seguidas', '🔥', min(s.wk)
    from unnest(array[4, 12, 26, 52]) as r(w) join streaks s on s.k = r.w
    group by r.w
    union all
    select 'antiguedad-' || y.n, 'antiguedad', case when y.n = 1 then '1 año en la escuela' else y.n || ' años en la escuela' end,
           '📅', (st.enrollment_date + make_interval(years => y.n))::date
    from public.students st cross join unnest(array[1, 2, 3, 5, 10]) as y(n)
    where st.id = p_student_id and (st.enrollment_date + make_interval(years => y.n))::date <= current_date
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'kind', kind, 'title', title, 'icon', icon, 'date', date)
                            order by date desc, key), '[]'::jsonb)
  from m;
$$;
revoke execute on function public.student_milestones(uuid) from public, anon, authenticated;
