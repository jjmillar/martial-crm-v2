-- Martial arts and belts (2026-11-24).
-- 1. The platform keeps an original catalog of arts with their belt systems (adults and kids): art_templates +
--    belt_templates. Read-only for everyone; only migrations change it.
-- 2. A school teaches one or more arts. Adding an art from the catalog COPIES it (and its belts) into the school's
--    own tables (school_arts + school_belts), where the school edits it freely. A school can also create its own art.
-- 3. A student practices one or more of the school's arts, each with its own belt and degree (student_arts).
-- students.belt / belt_degree (free text) stay for old data but the app no longer writes them.

-- 1. Original catalog ----------------------------------------------------------------------------------------------
create table public.art_templates (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (length(btrim(name)) between 1 and 60),
  position smallint not null default 0
);

create table public.belt_templates (
  id serial primary key,
  art_key text not null references public.art_templates (key) on delete cascade,
  track text not null check (track in ('adultos', 'kids')),
  position smallint not null,
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  stripe text check (stripe is null or stripe ~ '^#[0-9a-f]{6}$'),
  max_degree smallint not null default 0 check (max_degree between 0 and 12),
  degree_name text not null default 'grado' check (degree_name in ('franja', 'grado', 'dan', 'poom')),
  rank_label text check (rank_label is null or length(rank_label) <= 30),
  unique (art_key, track, position)
);

alter table public.art_templates enable row level security;
alter table public.belt_templates enable row level security;
create policy art_templates_select on public.art_templates for select to authenticated using (true);
create policy belt_templates_select on public.belt_templates for select to authenticated using (true);
revoke insert, update, delete, truncate on public.art_templates, public.belt_templates from anon, authenticated;
revoke select on public.art_templates, public.belt_templates from anon;

insert into public.art_templates (key, name, position) values
  ('bjj', 'Jiu-jitsu brasileño', 1),
  ('judo', 'Judo', 2),
  ('taekwondo_wt', 'Taekwondo WT (WTF)', 3),
  ('taekwondo_itf', 'Taekwondo ITF', 4),
  ('karate_kyokushin', 'Karate Kyokushin', 5),
  ('aikido', 'Aikido', 6);

-- Colors: blanco #f4f4f7, gris #8a8a92, amarillo #e8c547, naranja #e8873a, verde #3fb27f, azul #3d7be0,
-- morado #8a5cd6, café #7a5134, negro #0b0b0d, rojo #e0492c, dorado #c9a227. stripe = band across the belt.
insert into public.belt_templates (art_key, track, position, name, color, stripe, max_degree, degree_name, rank_label) values
  -- BJJ (IBJJF). Adults: 4 stripes per colored belt, black up to 6th degree, then coral and red.
  ('bjj', 'adultos', 1, 'Blanco', '#f4f4f7', null, 4, 'franja', null),
  ('bjj', 'adultos', 2, 'Azul', '#3d7be0', null, 4, 'franja', null),
  ('bjj', 'adultos', 3, 'Morado', '#8a5cd6', null, 4, 'franja', null),
  ('bjj', 'adultos', 4, 'Café', '#7a5134', null, 4, 'franja', null),
  ('bjj', 'adultos', 5, 'Negro', '#0b0b0d', '#e0492c', 6, 'grado', '1º–6º grado'),
  ('bjj', 'adultos', 6, 'Coral rojo y negro', '#e0492c', '#0b0b0d', 0, 'grado', '7º grado'),
  ('bjj', 'adultos', 7, 'Coral rojo y blanco', '#e0492c', '#f4f4f7', 0, 'grado', '8º grado'),
  ('bjj', 'adultos', 8, 'Rojo', '#e0492c', null, 0, 'grado', '9º–10º grado'),
  -- BJJ kids (4–15 years).
  ('bjj', 'kids', 1, 'Blanco', '#f4f4f7', null, 4, 'franja', null),
  ('bjj', 'kids', 2, 'Gris y blanco', '#8a8a92', '#f4f4f7', 4, 'franja', null),
  ('bjj', 'kids', 3, 'Gris', '#8a8a92', null, 4, 'franja', null),
  ('bjj', 'kids', 4, 'Gris y negro', '#8a8a92', '#0b0b0d', 4, 'franja', null),
  ('bjj', 'kids', 5, 'Amarillo y blanco', '#e8c547', '#f4f4f7', 4, 'franja', null),
  ('bjj', 'kids', 6, 'Amarillo', '#e8c547', null, 4, 'franja', null),
  ('bjj', 'kids', 7, 'Amarillo y negro', '#e8c547', '#0b0b0d', 4, 'franja', null),
  ('bjj', 'kids', 8, 'Naranja y blanco', '#e8873a', '#f4f4f7', 4, 'franja', null),
  ('bjj', 'kids', 9, 'Naranja', '#e8873a', null, 4, 'franja', null),
  ('bjj', 'kids', 10, 'Naranja y negro', '#e8873a', '#0b0b0d', 4, 'franja', null),
  ('bjj', 'kids', 11, 'Verde y blanco', '#3fb27f', '#f4f4f7', 4, 'franja', null),
  ('bjj', 'kids', 12, 'Verde', '#3fb27f', null, 4, 'franja', null),
  ('bjj', 'kids', 13, 'Verde y negro', '#3fb27f', '#0b0b0d', 4, 'franja', null),
  -- Judo (Kodokan kyu/dan).
  ('judo', 'adultos', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', '6º kyu'),
  ('judo', 'adultos', 2, 'Amarillo', '#e8c547', null, 0, 'dan', '5º kyu'),
  ('judo', 'adultos', 3, 'Naranja', '#e8873a', null, 0, 'dan', '4º kyu'),
  ('judo', 'adultos', 4, 'Verde', '#3fb27f', null, 0, 'dan', '3º kyu'),
  ('judo', 'adultos', 5, 'Azul', '#3d7be0', null, 0, 'dan', '2º kyu'),
  ('judo', 'adultos', 6, 'Café', '#7a5134', null, 0, 'dan', '1º kyu'),
  ('judo', 'adultos', 7, 'Negro', '#0b0b0d', null, 5, 'dan', '1º–5º dan'),
  ('judo', 'adultos', 8, 'Rojo y blanco', '#e0492c', '#f4f4f7', 0, 'dan', '6º–8º dan'),
  ('judo', 'adultos', 9, 'Rojo', '#e0492c', null, 0, 'dan', '9º–10º dan'),
  -- Judo kids: intermediate two-color belts.
  ('judo', 'kids', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', null),
  ('judo', 'kids', 2, 'Blanco y amarillo', '#f4f4f7', '#e8c547', 0, 'dan', null),
  ('judo', 'kids', 3, 'Amarillo', '#e8c547', null, 0, 'dan', null),
  ('judo', 'kids', 4, 'Amarillo y naranja', '#e8c547', '#e8873a', 0, 'dan', null),
  ('judo', 'kids', 5, 'Naranja', '#e8873a', null, 0, 'dan', null),
  ('judo', 'kids', 6, 'Naranja y verde', '#e8873a', '#3fb27f', 0, 'dan', null),
  ('judo', 'kids', 7, 'Verde', '#3fb27f', null, 0, 'dan', null),
  ('judo', 'kids', 8, 'Verde y azul', '#3fb27f', '#3d7be0', 0, 'dan', null),
  ('judo', 'kids', 9, 'Azul', '#3d7be0', null, 0, 'dan', null),
  ('judo', 'kids', 10, 'Azul y café', '#3d7be0', '#7a5134', 0, 'dan', null),
  ('judo', 'kids', 11, 'Café', '#7a5134', null, 0, 'dan', null),
  -- Taekwondo WT (kup/dan). Under 15 the black belt is the Poom (red and black).
  ('taekwondo_wt', 'adultos', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', '10º kup'),
  ('taekwondo_wt', 'adultos', 2, 'Blanco punta amarilla', '#f4f4f7', '#e8c547', 0, 'dan', '9º kup'),
  ('taekwondo_wt', 'adultos', 3, 'Amarillo', '#e8c547', null, 0, 'dan', '8º kup'),
  ('taekwondo_wt', 'adultos', 4, 'Amarillo punta verde', '#e8c547', '#3fb27f', 0, 'dan', '7º kup'),
  ('taekwondo_wt', 'adultos', 5, 'Verde', '#3fb27f', null, 0, 'dan', '6º kup'),
  ('taekwondo_wt', 'adultos', 6, 'Verde punta azul', '#3fb27f', '#3d7be0', 0, 'dan', '5º kup'),
  ('taekwondo_wt', 'adultos', 7, 'Azul', '#3d7be0', null, 0, 'dan', '4º kup'),
  ('taekwondo_wt', 'adultos', 8, 'Azul punta roja', '#3d7be0', '#e0492c', 0, 'dan', '3º kup'),
  ('taekwondo_wt', 'adultos', 9, 'Rojo', '#e0492c', null, 0, 'dan', '2º kup'),
  ('taekwondo_wt', 'adultos', 10, 'Rojo punta negra', '#e0492c', '#0b0b0d', 0, 'dan', '1º kup'),
  ('taekwondo_wt', 'adultos', 11, 'Negro', '#0b0b0d', null, 9, 'dan', '1º–9º dan'),
  ('taekwondo_wt', 'kids', 1, 'Blanco', '#f4f4f7', null, 0, 'poom', '10º kup'),
  ('taekwondo_wt', 'kids', 2, 'Blanco punta amarilla', '#f4f4f7', '#e8c547', 0, 'poom', '9º kup'),
  ('taekwondo_wt', 'kids', 3, 'Amarillo', '#e8c547', null, 0, 'poom', '8º kup'),
  ('taekwondo_wt', 'kids', 4, 'Amarillo punta verde', '#e8c547', '#3fb27f', 0, 'poom', '7º kup'),
  ('taekwondo_wt', 'kids', 5, 'Verde', '#3fb27f', null, 0, 'poom', '6º kup'),
  ('taekwondo_wt', 'kids', 6, 'Verde punta azul', '#3fb27f', '#3d7be0', 0, 'poom', '5º kup'),
  ('taekwondo_wt', 'kids', 7, 'Azul', '#3d7be0', null, 0, 'poom', '4º kup'),
  ('taekwondo_wt', 'kids', 8, 'Azul punta roja', '#3d7be0', '#e0492c', 0, 'poom', '3º kup'),
  ('taekwondo_wt', 'kids', 9, 'Rojo', '#e0492c', null, 0, 'poom', '2º kup'),
  ('taekwondo_wt', 'kids', 10, 'Rojo punta negra', '#e0492c', '#0b0b0d', 0, 'poom', '1º kup'),
  ('taekwondo_wt', 'kids', 11, 'Poom (rojo y negro)', '#e0492c', '#0b0b0d', 4, 'poom', '1º–4º poom'),
  -- Taekwondo ITF (gup/dan). Juniors get the junior black belt (Boo Dan) before the black belt.
  ('taekwondo_itf', 'adultos', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', '10º gup'),
  ('taekwondo_itf', 'adultos', 2, 'Blanco franja amarilla', '#f4f4f7', '#e8c547', 0, 'dan', '9º gup'),
  ('taekwondo_itf', 'adultos', 3, 'Amarillo', '#e8c547', null, 0, 'dan', '8º gup'),
  ('taekwondo_itf', 'adultos', 4, 'Amarillo franja verde', '#e8c547', '#3fb27f', 0, 'dan', '7º gup'),
  ('taekwondo_itf', 'adultos', 5, 'Verde', '#3fb27f', null, 0, 'dan', '6º gup'),
  ('taekwondo_itf', 'adultos', 6, 'Verde franja azul', '#3fb27f', '#3d7be0', 0, 'dan', '5º gup'),
  ('taekwondo_itf', 'adultos', 7, 'Azul', '#3d7be0', null, 0, 'dan', '4º gup'),
  ('taekwondo_itf', 'adultos', 8, 'Azul franja roja', '#3d7be0', '#e0492c', 0, 'dan', '3º gup'),
  ('taekwondo_itf', 'adultos', 9, 'Rojo', '#e0492c', null, 0, 'dan', '2º gup'),
  ('taekwondo_itf', 'adultos', 10, 'Rojo franja negra', '#e0492c', '#0b0b0d', 0, 'dan', '1º gup'),
  ('taekwondo_itf', 'adultos', 11, 'Negro', '#0b0b0d', null, 9, 'dan', '1º–9º dan'),
  ('taekwondo_itf', 'kids', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', '10º gup'),
  ('taekwondo_itf', 'kids', 2, 'Blanco franja amarilla', '#f4f4f7', '#e8c547', 0, 'dan', '9º gup'),
  ('taekwondo_itf', 'kids', 3, 'Amarillo', '#e8c547', null, 0, 'dan', '8º gup'),
  ('taekwondo_itf', 'kids', 4, 'Amarillo franja verde', '#e8c547', '#3fb27f', 0, 'dan', '7º gup'),
  ('taekwondo_itf', 'kids', 5, 'Verde', '#3fb27f', null, 0, 'dan', '6º gup'),
  ('taekwondo_itf', 'kids', 6, 'Verde franja azul', '#3fb27f', '#3d7be0', 0, 'dan', '5º gup'),
  ('taekwondo_itf', 'kids', 7, 'Azul', '#3d7be0', null, 0, 'dan', '4º gup'),
  ('taekwondo_itf', 'kids', 8, 'Azul franja roja', '#3d7be0', '#e0492c', 0, 'dan', '3º gup'),
  ('taekwondo_itf', 'kids', 9, 'Rojo', '#e0492c', null, 0, 'dan', '2º gup'),
  ('taekwondo_itf', 'kids', 10, 'Rojo franja negra', '#e0492c', '#0b0b0d', 0, 'dan', '1º gup'),
  ('taekwondo_itf', 'kids', 11, 'Negro junior (Boo Dan)', '#0b0b0d', '#e0492c', 0, 'dan', 'Boo Dan'),
  -- Karate Kyokushin (kyu/dan). The stripe announces the next belt.
  ('karate_kyokushin', 'adultos', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', 'Mukyu'),
  ('karate_kyokushin', 'adultos', 2, 'Naranja', '#e8873a', null, 0, 'dan', '10º kyu'),
  ('karate_kyokushin', 'adultos', 3, 'Naranja franja azul', '#e8873a', '#3d7be0', 0, 'dan', '9º kyu'),
  ('karate_kyokushin', 'adultos', 4, 'Azul', '#3d7be0', null, 0, 'dan', '8º kyu'),
  ('karate_kyokushin', 'adultos', 5, 'Azul franja amarilla', '#3d7be0', '#e8c547', 0, 'dan', '7º kyu'),
  ('karate_kyokushin', 'adultos', 6, 'Amarillo', '#e8c547', null, 0, 'dan', '6º kyu'),
  ('karate_kyokushin', 'adultos', 7, 'Amarillo franja verde', '#e8c547', '#3fb27f', 0, 'dan', '5º kyu'),
  ('karate_kyokushin', 'adultos', 8, 'Verde', '#3fb27f', null, 0, 'dan', '4º kyu'),
  ('karate_kyokushin', 'adultos', 9, 'Verde franja café', '#3fb27f', '#7a5134', 0, 'dan', '3º kyu'),
  ('karate_kyokushin', 'adultos', 10, 'Café', '#7a5134', null, 0, 'dan', '2º kyu'),
  ('karate_kyokushin', 'adultos', 11, 'Café franja dorada', '#7a5134', '#c9a227', 0, 'dan', '1º kyu'),
  ('karate_kyokushin', 'adultos', 12, 'Negro', '#0b0b0d', '#c9a227', 10, 'dan', '1º–10º dan'),
  ('karate_kyokushin', 'kids', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', null),
  ('karate_kyokushin', 'kids', 2, 'Blanco franja naranja', '#f4f4f7', '#e8873a', 0, 'dan', null),
  ('karate_kyokushin', 'kids', 3, 'Naranja', '#e8873a', null, 0, 'dan', null),
  ('karate_kyokushin', 'kids', 4, 'Naranja franja azul', '#e8873a', '#3d7be0', 0, 'dan', null),
  ('karate_kyokushin', 'kids', 5, 'Azul', '#3d7be0', null, 0, 'dan', null),
  ('karate_kyokushin', 'kids', 6, 'Azul franja amarilla', '#3d7be0', '#e8c547', 0, 'dan', null),
  ('karate_kyokushin', 'kids', 7, 'Amarillo', '#e8c547', null, 0, 'dan', null),
  ('karate_kyokushin', 'kids', 8, 'Amarillo franja verde', '#e8c547', '#3fb27f', 0, 'dan', null),
  ('karate_kyokushin', 'kids', 9, 'Verde', '#3fb27f', null, 0, 'dan', null),
  ('karate_kyokushin', 'kids', 10, 'Verde franja café', '#3fb27f', '#7a5134', 0, 'dan', null),
  ('karate_kyokushin', 'kids', 11, 'Café', '#7a5134', null, 0, 'dan', null),
  -- Aikido (colored kyu, used by many dojos; others use white for every kyu: edit as needed).
  ('aikido', 'adultos', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', '6º kyu'),
  ('aikido', 'adultos', 2, 'Amarillo', '#e8c547', null, 0, 'dan', '5º kyu'),
  ('aikido', 'adultos', 3, 'Naranja', '#e8873a', null, 0, 'dan', '4º kyu'),
  ('aikido', 'adultos', 4, 'Verde', '#3fb27f', null, 0, 'dan', '3º kyu'),
  ('aikido', 'adultos', 5, 'Azul', '#3d7be0', null, 0, 'dan', '2º kyu'),
  ('aikido', 'adultos', 6, 'Café', '#7a5134', null, 0, 'dan', '1º kyu'),
  ('aikido', 'adultos', 7, 'Negro', '#0b0b0d', null, 8, 'dan', '1º–8º dan'),
  ('aikido', 'kids', 1, 'Blanco', '#f4f4f7', null, 0, 'dan', null),
  ('aikido', 'kids', 2, 'Blanco y amarillo', '#f4f4f7', '#e8c547', 0, 'dan', null),
  ('aikido', 'kids', 3, 'Amarillo', '#e8c547', null, 0, 'dan', null),
  ('aikido', 'kids', 4, 'Amarillo y naranja', '#e8c547', '#e8873a', 0, 'dan', null),
  ('aikido', 'kids', 5, 'Naranja', '#e8873a', null, 0, 'dan', null),
  ('aikido', 'kids', 6, 'Naranja y verde', '#e8873a', '#3fb27f', 0, 'dan', null),
  ('aikido', 'kids', 7, 'Verde', '#3fb27f', null, 0, 'dan', null),
  ('aikido', 'kids', 8, 'Verde y azul', '#3fb27f', '#3d7be0', 0, 'dan', null),
  ('aikido', 'kids', 9, 'Azul', '#3d7be0', null, 0, 'dan', null),
  ('aikido', 'kids', 10, 'Azul y café', '#3d7be0', '#7a5134', 0, 'dan', null),
  ('aikido', 'kids', 11, 'Café', '#7a5134', null, 0, 'dan', null);

-- 2. The school's own copy -------------------------------------------------------------------------------------------
create table public.school_arts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  template_key text references public.art_templates (key) on delete set null,
  position smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);
create index school_arts_school_idx on public.school_arts (school_id, position);

create table public.school_belts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  art_id uuid not null,
  track text not null check (track in ('adultos', 'kids')),
  position smallint not null default 0,
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  stripe text check (stripe is null or stripe ~ '^#[0-9a-f]{6}$'),
  max_degree smallint not null default 0 check (max_degree between 0 and 12),
  degree_name text not null default 'grado' check (degree_name in ('franja', 'grado', 'dan', 'poom')),
  rank_label text check (rank_label is null or length(rank_label) <= 30),
  created_at timestamptz not null default now(),
  foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete cascade,
  unique (art_id, track, name),
  unique (id, art_id)
);
create index school_belts_art_idx on public.school_belts (art_id, track, position);

create trigger school_arts_school_fixed before update on public.school_arts
  for each row execute function public.prevent_school_change();
create trigger school_belts_school_fixed before update on public.school_belts
  for each row execute function public.prevent_school_change();

alter table public.school_arts enable row level security;
alter table public.school_belts enable row level security;
-- Everyone in the school (team and students) reads them; only admins/owner change them.
create policy school_arts_select on public.school_arts for select to authenticated
  using (public.is_school_member(school_id) or public.is_student_user(school_id));
create policy school_arts_insert on public.school_arts for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_arts_update on public.school_arts for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_arts_delete on public.school_arts for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_belts_select on public.school_belts for select to authenticated
  using (public.is_school_member(school_id) or public.is_student_user(school_id));
create policy school_belts_insert on public.school_belts for insert to authenticated
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_belts_update on public.school_belts for update to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]))
  with check (public.has_school_role(school_id, array['admin']::public.school_role[]));
create policy school_belts_delete on public.school_belts for delete to authenticated
  using (public.has_school_role(school_id, array['admin']::public.school_role[]));
revoke all on public.school_arts, public.school_belts from anon;

-- Copies an art of the original catalog (and its belts) into the school. Returns the new school art.
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
  insert into public.school_belts (school_id, art_id, track, position, name, color, stripe, max_degree, degree_name, rank_label)
  select p_school_id, new_id, b.track, b.position, b.name, b.color, b.stripe, b.max_degree, b.degree_name, b.rank_label
  from public.belt_templates b where b.art_key = t.key;
  return new_id;
end;
$$;
revoke execute on function public.add_school_art(uuid, text) from public, anon;
grant execute on function public.add_school_art(uuid, text) to authenticated;

-- 3. Each student's arts -----------------------------------------------------------------------------------------------
create table public.student_arts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  art_id uuid not null,
  belt_id uuid,
  degree smallint not null default 0 check (degree between 0 and 12),
  since date check (since is null or since <= current_date + 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, art_id),
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  -- an art or belt in use can't be deleted (the app suggests editing it instead)
  foreign key (art_id, school_id) references public.school_arts (id, school_id) on delete restrict,
  foreign key (belt_id, art_id) references public.school_belts (id, art_id) on delete restrict
);
create index student_arts_school_idx on public.student_arts (school_id);

create trigger student_arts_set_updated_at before update on public.student_arts
  for each row execute function public.set_updated_at();
create trigger student_arts_school_fixed before update on public.student_arts
  for each row execute function public.prevent_school_change();

-- The degree can't go beyond what the belt allows.
create or replace function public.student_arts_check_degree()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  mx smallint;
begin
  if new.belt_id is null then
    new.degree := 0;
    return new;
  end if;
  select max_degree into mx from public.school_belts where id = new.belt_id;
  if new.degree > coalesce(mx, 0) then raise exception 'degree out of range'; end if;
  return new;
end;
$$;
revoke execute on function public.student_arts_check_degree() from public, anon, authenticated;
create trigger student_arts_degree before insert or update on public.student_arts
  for each row execute function public.student_arts_check_degree();

alter table public.student_arts enable row level security;
-- The team reads and writes (teachers promote); the student and their guardian read their own.
create policy student_arts_select on public.student_arts for select to authenticated
  using (public.is_school_member(school_id) or student_id in (select public.my_student_ids()));
create policy student_arts_insert on public.student_arts for insert to authenticated
  with check (public.is_school_member(school_id));
create policy student_arts_update on public.student_arts for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));
create policy student_arts_delete on public.student_arts for delete to authenticated
  using (public.is_school_member(school_id));
revoke all on public.student_arts from anon;

-- 4. Existing schools: those that already teach BJJ (by their specialties) get it from the catalog. -----------------
insert into public.school_arts (school_id, name, template_key, position)
select distinct s.id, 'Jiu-jitsu brasileño', 'bjj', 0
from public.schools s join public.specialties sp on sp.school_id = s.id
where translate(lower(sp.name), 'áéíóú', 'aeiou') like '%jiu%jitsu%';
insert into public.school_belts (school_id, art_id, track, position, name, color, stripe, max_degree, degree_name, rank_label)
select a.school_id, a.id, b.track, b.position, b.name, b.color, b.stripe, b.max_degree, b.degree_name, b.rank_label
from public.school_arts a join public.belt_templates b on b.art_key = a.template_key;
