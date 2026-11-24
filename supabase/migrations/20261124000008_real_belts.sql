-- Real belts (2026-11-24). A belt is now drawn like the real thing:
-- * pattern: 'banda' (a lengthwise band in `stripe`, kids two-color belts), 'punta' (the end of the belt in `stripe`,
--   TKD "punta" belts) or 'paneles' (alternating blocks, BJJ coral and judo red-white).
-- * bar: the rank bar near the end where stripes/degrees go (BJJ: black bar, red bar on the black belt; ITF and
--   Kyokushin: the tag of the next color). Black belts without a bar show their dans as gold marks.
-- Schools' copies are updated too, unless the school already edited that belt's colors.
-- Arts a school creates itself start with generic belts (white → black, black up to 10th dan).
-- Teachers pick their belt from the school's arts (teachers.belt_id); the free-text belt stays for old data.

alter table public.belt_templates
  add column bar text check (bar is null or bar ~ '^#[0-9a-f]{6}$'),
  add column pattern text not null default 'banda' check (pattern in ('banda', 'punta', 'paneles'));
alter table public.school_belts
  add column bar text check (bar is null or bar ~ '^#[0-9a-f]{6}$'),
  add column pattern text not null default 'banda' check (pattern in ('banda', 'punta', 'paneles'));

-- 1. Catalog ---------------------------------------------------------------------------------------------------------
create temporary table belt_templates_before as select id, color, stripe from public.belt_templates;

-- BJJ: every colored belt has the black bar; the black belt has the red bar; coral belts are panels.
update public.belt_templates set bar = '#0b0b0d' where art_key = 'bjj' and name <> 'Negro' and name not like 'Coral%' and name <> 'Rojo';
update public.belt_templates set bar = '#e0492c', stripe = null where art_key = 'bjj' and name = 'Negro';
update public.belt_templates set pattern = 'paneles' where art_key = 'bjj' and name like 'Coral%';
-- Judo 6º–8º dan: red and white panels.
update public.belt_templates set pattern = 'paneles' where art_key = 'judo' and name = 'Rojo y blanco';
-- TKD WT "punta": the end of the belt has the next color.
update public.belt_templates set pattern = 'punta' where art_key = 'taekwondo_wt' and name like '% punta %';
-- ITF and Kyokushin "franja": a tag of the next color near the end.
update public.belt_templates set bar = stripe, stripe = null where art_key in ('taekwondo_itf', 'karate_kyokushin') and name like '% franja %';
-- Kyokushin black: plain black, dans as gold marks.
update public.belt_templates set stripe = null where art_key = 'karate_kyokushin' and name = 'Negro';

-- 2. Schools' copies (only belts still equal to the original) ------------------------------------------------------
update public.school_belts b
set bar = t.bar, pattern = t.pattern, stripe = t.stripe
from public.school_arts a, public.belt_templates t, belt_templates_before o
where a.id = b.art_id and t.art_key = a.template_key and t.track = b.track and t.name = b.name and o.id = t.id
  and b.color = o.color and b.stripe is not distinct from o.stripe;
drop table belt_templates_before;

-- 3. Copying an art brings the new columns ---------------------------------------------------------------------------
create or replace function public.add_school_art(p_school_id uuid, p_template_key text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  t public.art_templates;
  new_id uuid;
begin
  if not public.has_school_role(p_school_id, array['admin']::public.school_role[]) then raise exception 'not allowed'; end if;
  select * into t from public.art_templates where key = p_template_key;
  if not found then raise exception 'unknown art'; end if;
  if exists (select 1 from public.school_arts where school_id = p_school_id and (template_key = t.key or lower(name) = lower(t.name))) then
    raise exception 'art exists';
  end if;
  insert into public.school_arts (school_id, name, template_key, position)
  values (p_school_id, t.name, t.key, coalesce((select max(position) + 1 from public.school_arts where school_id = p_school_id), 0))
  returning id into new_id;
  insert into public.school_belts (school_id, art_id, track, position, name, color, stripe, bar, pattern, max_degree, degree_name, rank_label)
  select p_school_id, new_id, b.track, b.position, b.name, b.color, b.stripe, b.bar, b.pattern, b.max_degree, b.degree_name, b.rank_label
  from public.belt_templates b where b.art_key = t.key;
  return new_id;
end;
$$;

-- 4. Arts a school creates itself start with generic belts ----------------------------------------------------------
create or replace function public.school_belts_generic(p_school_id uuid, p_art_id uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.school_belts (school_id, art_id, track, position, name, color, max_degree, degree_name, rank_label)
  select p_school_id, p_art_id, tr.track, g.pos, g.name, g.color,
         case when g.name = 'Negro' then 10 else 0 end, 'dan', case when g.name = 'Negro' then '1º–10º dan' end
  from (values ('adultos'), ('kids')) tr(track)
  cross join (values (1, 'Blanco', '#f4f4f7'), (2, 'Amarillo', '#e8c547'), (3, 'Naranja', '#e8873a'), (4, 'Verde', '#3fb27f'),
                     (5, 'Azul', '#3d7be0'), (6, 'Café', '#7a5134'), (7, 'Negro', '#0b0b0d')) g(pos, name, color)
  where tr.track = 'adultos' or g.name <> 'Negro';
$$;
revoke execute on function public.school_belts_generic(uuid, uuid) from public, anon, authenticated;

create or replace function public.school_arts_generic_belts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.template_key is null then perform public.school_belts_generic(new.school_id, new.id); end if;
  return null;
end;
$$;
revoke execute on function public.school_arts_generic_belts() from public, anon, authenticated;
create trigger school_arts_generic_belts after insert on public.school_arts
  for each row execute function public.school_arts_generic_belts();

-- Custom arts created before this, still without belts.
select public.school_belts_generic(a.school_id, a.id)
from public.school_arts a
where a.template_key is null and not exists (select 1 from public.school_belts b where b.art_id = a.id);

-- 5. Teachers pick their belt from the school's arts -----------------------------------------------------------------
alter table public.school_belts add constraint school_belts_id_school_key unique (id, school_id);
alter table public.teachers add column belt_id uuid,
  add constraint teachers_belt_fk foreign key (belt_id, school_id) references public.school_belts (id, school_id) on delete set null (belt_id);
create index teachers_belt_idx on public.teachers (belt_id) where belt_id is not null;

-- Existing teachers: match their free-text belt ("Negro", "Negro 3er grado") to an adult belt of the school's first art.
update public.teachers t
set belt_id = (
  select b.id from public.school_belts b join public.school_arts a on a.id = b.art_id
  where b.school_id = t.school_id and b.track = 'adultos'
    and lower(b.name) = lower(split_part(btrim(t.belt), ' ', 1))
  order by a.position, a.name limit 1
)
where t.belt is not null and t.belt_id is null;

-- 6. The public profile also carries the bar and pattern of each belt. -------------------------------------------
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
