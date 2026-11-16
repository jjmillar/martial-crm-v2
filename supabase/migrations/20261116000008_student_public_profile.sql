-- Each student's own public page (/e/<school slug>/a/<handle>): a personal profile where achievements, skills and
-- more will be shown. The student configures it in Ajustes; nothing is public until they publish it.

create table public.student_profiles (
  student_id uuid primary key references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9-]{3,40}$'),
  published boolean not null default false,
  headline text check (headline is null or length(headline) <= 80),
  bio text check (bio is null or length(bio) <= 500),
  show_belt boolean not null default true,
  show_skills boolean not null default true,
  show_stats boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, handle)
);

alter table public.student_profiles enable row level security;
-- The student sees their own; the school's staff see their students'. Writes only through save_my_public_profile.
create policy student_profiles_select on public.student_profiles for select to authenticated
  using (student_id in (select public.my_student_ids()) or public.is_school_member(school_id));

create or replace function public.save_my_public_profile(
  p_student_id uuid, p_handle text, p_published boolean, p_headline text, p_bio text,
  p_show_belt boolean, p_show_skills boolean, p_show_stats boolean
)
returns public.student_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.students;
  h text := lower(btrim(p_handle));
  r public.student_profiles;
begin
  select * into st from public.students where id = p_student_id;
  if not found or st.user_id is distinct from auth.uid() or not st.active then raise exception 'not allowed'; end if;
  if exists (select 1 from public.student_profiles where school_id = st.school_id and handle = h and student_id <> st.id) then
    raise exception 'handle taken';
  end if;
  insert into public.student_profiles as sp (student_id, school_id, handle, published, headline, bio, show_belt, show_skills, show_stats)
  values (st.id, st.school_id, h, coalesce(p_published, false), nullif(btrim(p_headline), ''), nullif(btrim(p_bio), ''),
          coalesce(p_show_belt, true), coalesce(p_show_skills, true), coalesce(p_show_stats, true))
  on conflict (student_id) do update set
    handle = excluded.handle, published = excluded.published, headline = excluded.headline, bio = excluded.bio,
    show_belt = excluded.show_belt, show_skills = excluded.show_skills, show_stats = excluded.show_stats, updated_at = now()
  returning * into r;
  return r;
end;
$$;
revoke execute on function public.save_my_public_profile(uuid, text, boolean, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_my_public_profile(uuid, text, boolean, text, text, boolean, boolean, boolean) to authenticated;

-- Public read (anon): only published profiles of active students, only the fields the student chose to show.
-- Name is first name + paternal surname; no RUT, contact, birth date or address ever leaves here.
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
