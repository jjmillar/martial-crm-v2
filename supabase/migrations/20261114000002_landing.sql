-- Public landing page per school (/e/<slug>): info the CEO chooses to show, a color theme, a photo carousel,
-- and the school's own student login / sign-up (so new accounts are tied to that school).

alter table public.schools
  add column landing_enabled boolean not null default true,
  add column landing_theme text not null default 'brasa'
    check (landing_theme in ('brasa', 'oceano', 'bosque', 'violeta', 'oro', 'grafito', 'custom')),
  add column landing_primary text check (landing_primary ~ '^#[0-9a-fA-F]{6}$'),
  add column landing_accent text check (landing_accent ~ '^#[0-9a-fA-F]{6}$'),
  add column landing_tagline text check (length(landing_tagline) <= 120),
  add column landing_about text check (length(landing_about) <= 1500),
  add column landing_show_schedule boolean not null default true,
  add column landing_show_plans boolean not null default true,
  add column landing_instagram text check (length(landing_instagram) <= 60),
  add column landing_whatsapp text check (length(landing_whatsapp) <= 30);

-- Carousel photos (files in the public "landing" bucket, path '<school_id>/<file>').
create table public.school_photos (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  path text not null check (length(path) <= 300),
  caption text check (caption is null or length(caption) <= 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index school_photos_school_idx on public.school_photos (school_id, position);
create trigger school_photos_school_fixed before update on public.school_photos
  for each row execute function public.prevent_school_change();

alter table public.school_photos enable row level security;
create policy school_photos_select on public.school_photos for select to authenticated using (public.is_school_member(school_id));
create policy school_photos_insert on public.school_photos for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_photos_update on public.school_photos for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_photos_delete on public.school_photos for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));

-- Everything the public page needs, in one call. Only public fields; null when the page is off.
create or replace function public.school_landing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'logo_url', s.logo_url, 'city', s.city, 'address', s.address,
    'phone', s.phone, 'email', s.email, 'description', s.description,
    'theme', s.landing_theme, 'primary', s.landing_primary, 'accent', s.landing_accent,
    'tagline', s.landing_tagline, 'about', s.landing_about,
    'instagram', s.landing_instagram, 'whatsapp', s.landing_whatsapp,
    'enrollment_fee', s.enrollment_fee,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'caption', p.caption) order by p.position, p.created_at)
                        from public.school_photos p where p.school_id = s.id), '[]'::jsonb),
    'schedule', case when s.landing_show_schedule then coalesce((
        select jsonb_agg(jsonb_build_object('weekday', cs.weekday, 'start', cs.start_time, 'end', cs.end_time,
                                            'name', c.name, 'color', c.color, 'level', c.level, 'discipline', sp.name)
                         order by cs.weekday, cs.start_time)
        from public.class_schedules cs
        join public.classes c on c.id = cs.class_id and c.active
        left join public.specialties sp on sp.id = c.specialty_id
        where cs.school_id = s.id), '[]'::jsonb) else null end,
    'plans', case when s.landing_show_plans then coalesce((
        select jsonb_agg(jsonb_build_object('name', pl.name, 'price', pl.price, 'cycle', pl.billing_cycle,
                                            'description', pl.description, 'trial', pl.is_trial)
                         order by pl.is_trial desc, pl.price)
        from public.plans pl where pl.school_id = s.id and pl.active), '[]'::jsonb) else null end
  )
  from public.schools s
  where s.slug = p_slug and s.landing_enabled;
$$;
grant execute on function public.school_landing(text) to anon, authenticated;
