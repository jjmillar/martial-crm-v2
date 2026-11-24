-- Achievements ("Logros", 2026-11-24). Four kinds on the student's profile:
-- * graduacion: automatic when the team promotes a student (higher belt or degree in student_arts). The team can also
--   add older ones by hand.
-- * torneo: tournament result (medal, category). The team adds it, or the student/guardian submits it and the team
--   approves it in Tareas → Aprobaciones.
-- * escuela: a badge the school created (school_badges) and awarded by hand.
-- * milestones: computed on read from approved attendance (1st class, 10/25/50/100… classes, levels, weekly streaks,
--   years in the school). Nothing is stored, so they never go out of sync.

-- 1. School badges ------------------------------------------------------------------------------------------------------
create table public.school_badges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  icon text check (icon is null or length(icon) <= 8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);
create trigger school_badges_school_fixed before update on public.school_badges
  for each row execute function public.prevent_school_change();
alter table public.school_badges enable row level security;
create policy school_badges_select on public.school_badges for select to authenticated
  using (public.is_school_member(school_id) or public.is_student_user(school_id));
create policy school_badges_insert on public.school_badges for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_badges_update on public.school_badges for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_badges_delete on public.school_badges for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
revoke all on public.school_badges from anon;

-- 2. Achievements --------------------------------------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  kind text not null check (kind in ('graduacion', 'torneo', 'escuela')),
  title text not null check (length(btrim(title)) between 1 and 100),
  detail text check (detail is null or length(detail) <= 300),
  date date not null default current_date check (date <= current_date + 1 and date >= '1950-01-01'),
  art_id uuid,
  belt_id uuid,
  degree smallint check (degree is null or degree between 0 and 12),
  medal text check (medal is null or medal in ('oro', 'plata', 'bronce', 'participacion')),
  category text check (category is null or length(category) <= 60),
  badge_id uuid,
  status text not null default 'aprobado' check (status in ('pendiente', 'aprobado', 'rechazado')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  created_by uuid default auth.uid(),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (medal is null or kind = 'torneo'),
  check (badge_id is null or kind = 'escuela'),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete set null (art_id),
  foreign key (badge_id, school_id) references public.school_badges (id, school_id) on delete set null (badge_id),
  foreign key (belt_id, art_id) references public.school_belts (id, art_id) on delete set null (belt_id)
);
create index achievements_student_idx on public.achievements (student_id, date desc);
create index achievements_pending_idx on public.achievements (school_id, created_at) where status = 'pendiente';

create trigger achievements_school_fixed before update on public.achievements
  for each row execute function public.prevent_school_change();

-- Who decided and when; the student can't be changed afterwards.
create or replace function public.achievements_stamp()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.student_id <> old.student_id then raise exception 'student cannot change'; end if;
    if new.status is distinct from old.status then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
    if new.status <> 'rechazado' then new.reject_reason := null; end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.achievements_stamp() from public, anon, authenticated;
create trigger achievements_stamp before update on public.achievements
  for each row execute function public.achievements_stamp();

alter table public.achievements enable row level security;
-- The team reads and manages them; the student and their guardian read their own (writes through the functions).
create policy achievements_select on public.achievements for select to authenticated
  using (public.is_school_member(school_id) or student_id in (select public.my_student_ids()));
create policy achievements_insert on public.achievements for insert to authenticated
  with check (public.is_school_member(school_id));
create policy achievements_update on public.achievements for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy achievements_delete on public.achievements for delete to authenticated
  using (public.is_school_member(school_id));
revoke all on public.achievements from anon;

-- "2 franjas", "3º dan"...
create or replace function public.degree_text(p_degree smallint, p_name text)
returns text language sql immutable set search_path = ''
as $$
  select case when coalesce(p_degree, 0) = 0 then null
              when p_name = 'franja' then p_degree || case when p_degree = 1 then ' franja' else ' franjas' end
              else p_degree || 'º ' || p_name end;
$$;
grant execute on function public.degree_text(smallint, text) to authenticated;

-- 3. Automatic graduations -------------------------------------------------------------------------------------------------
-- A higher belt (same track, or kids → adults) or a higher degree on the same belt is a graduation. The first belt
-- given to a student is their starting rank, not a graduation.
create or replace function public.student_arts_graduation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  b public.school_belts;
  ob public.school_belts;
begin
  if new.belt_id is null or old.belt_id is null then return new; end if;
  select * into b from public.school_belts where id = new.belt_id;
  if new.belt_id = old.belt_id then
    if new.degree <= old.degree then return new; end if;
  else
    select * into ob from public.school_belts where id = old.belt_id;
    if not ((b.track = ob.track and b.position > ob.position) or (ob.track = 'kids' and b.track = 'adultos')) then
      return new;
    end if;
  end if;
  insert into public.achievements (school_id, student_id, kind, title, date, art_id, belt_id, degree, status)
  values (new.school_id, new.student_id, 'graduacion',
          'Cinturón ' || lower(b.name) || coalesce(' · ' || public.degree_text(new.degree, b.degree_name), ''),
          least(coalesce(new.since, current_date), current_date), new.art_id, new.belt_id, new.degree, 'aprobado');
  return new;
end;
$$;
revoke execute on function public.student_arts_graduation() from public, anon, authenticated;
create trigger student_arts_graduation after update of belt_id, degree on public.student_arts
  for each row execute function public.student_arts_graduation();

-- 4. Students submit tournaments ---------------------------------------------------------------------------------------------
create or replace function public.submit_achievement(
  p_student_id uuid, p_title text, p_date date, p_medal text, p_category text, p_art_id uuid, p_detail text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  st public.students;
  new_id uuid;
begin
  if p_student_id is null or p_student_id not in (select public.my_student_ids()) then raise exception 'not allowed'; end if;
  select * into st from public.students where id = p_student_id;
  if not public.rate_limit_hit('achievement', auth.uid()::text, 10, 3600) then raise exception 'too many'; end if;
  if (select count(*) from public.achievements where student_id = st.id and status = 'pendiente') >= 5 then
    raise exception 'too many pending';
  end if;
  if p_art_id is not null and not exists (select 1 from public.school_arts where id = p_art_id and school_id = st.school_id) then
    raise exception 'unknown art';
  end if;
  insert into public.achievements (school_id, student_id, kind, title, date, medal, category, art_id, detail, status)
  values (st.school_id, st.id, 'torneo', btrim(p_title), p_date, p_medal, nullif(btrim(p_category), ''), p_art_id,
          nullif(btrim(p_detail), ''), 'pendiente')
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.submit_achievement(uuid, text, date, text, text, uuid, text) from public, anon;
grant execute on function public.submit_achievement(uuid, text, date, text, text, uuid, text) to authenticated;

-- The student withdraws one still waiting for approval.
create or replace function public.withdraw_achievement(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.achievements
  where id = p_id and status = 'pendiente' and student_id in (select public.my_student_ids());
  if not found then raise exception 'not allowed'; end if;
end;
$$;
revoke execute on function public.withdraw_achievement(uuid) from public, anon;
grant execute on function public.withdraw_achievement(uuid) to authenticated;

-- 5. Milestones (computed) ------------------------------------------------------------------------------------------------------
-- Internal: no access check here, callers check. [{key, kind, title, icon, date}] newest first.
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
    from unnest(array[5, 10, 20, 30, 50]) as l(lv) join att on att.n = (l.lv - 1) * 10
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

-- The team, the student and their guardian.
create or replace function public.student_achievements(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  sc uuid;
begin
  select school_id into sc from public.students where id = p_student_id;
  if not found then return null; end if;
  if not (public.is_school_member(sc) or p_student_id in (select public.my_student_ids())) then raise exception 'not allowed'; end if;
  return public.student_milestones(p_student_id);
end;
$$;
revoke execute on function public.student_achievements(uuid) from public, anon;
grant execute on function public.student_achievements(uuid) to authenticated;

-- 6. Public profile: belts per art and achievements ----------------------------------------------------------------------------
alter table public.student_profiles add column show_achievements boolean not null default true;

create or replace function public.save_my_public_profile(
  p_student_id uuid, p_handle text, p_published boolean, p_headline text, p_bio text,
  p_show_belt boolean, p_show_skills boolean, p_show_stats boolean, p_show_achievements boolean
)
returns public.student_profiles language plpgsql security definer set search_path = ''
as $$
declare
  r public.student_profiles;
begin
  r := public.save_my_public_profile(p_student_id, p_handle, p_published, p_headline, p_bio, p_show_belt, p_show_skills, p_show_stats);
  update public.student_profiles set show_achievements = coalesce(p_show_achievements, true)
  where student_id = r.student_id returning * into r;
  return r;
end;
$$;
revoke execute on function public.save_my_public_profile(uuid, text, boolean, text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_my_public_profile(uuid, text, boolean, text, text, boolean, boolean, boolean, boolean) to authenticated;

-- Same contract as before plus 'arts' (belt per art) and 'achievements' (approved ones + milestones). Still no RUT,
-- contact, address or birth date.
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
        select jsonb_agg(jsonb_build_object('art', a.name, 'belt', b.name, 'color', b.color, 'stripe', b.stripe,
                                            'degree', sa.degree, 'degree_text', public.degree_text(sa.degree, b.degree_name),
                                            'rank', b.rank_label, 'track', b.track)
                         order by a.position, a.name)
        from public.student_arts sa join public.school_arts a on a.id = sa.art_id
        left join public.school_belts b on b.id = sa.belt_id
        where sa.student_id = st.id), '[]'::jsonb) end,
    'stats', case when sp.show_stats then jsonb_build_object('xp', x.xp, 'level', x.xp / 100 + 1, 'level_xp', x.xp % 100, 'attended', x.xp / 10) end,
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
                                            'color', b.color, 'stripe', b.stripe, 'icon', bd.icon)
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
grant execute on function public.student_public_profile(text, text) to anon, authenticated;
