-- Search Star v3 schema
-- April 2026 — clean rebuild against spec v3.0

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table if not exists profiles (
  user_id     uuid primary key references auth.users on delete cascade,
  display_name text,
  location    text,
  bio         text,
  trust_stage text not null default 'seedling'
    check (trust_stage in ('seedling','rooting','growing','established','mature')),
  mentor_role text
    check (mentor_role in ('mentor','coach','community_builder','practice_leader') or mentor_role is null),
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: owner full access"
  on profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles: public read"
  on profiles for select
  using (true);

-- ─────────────────────────────────────────────
-- skill_categories
-- ─────────────────────────────────────────────
create table if not exists skill_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  slug  text not null unique
);

alter table skill_categories enable row level security;

create policy "skill_categories: public read"
  on skill_categories for select
  using (true);

-- Seed canonical categories
insert into skill_categories (name, slug) values
  ('Craft & Making',      'craft-making'),
  ('Culinary',            'culinary'),
  ('Physical Practice',   'physical-practice'),
  ('Creative Arts',       'creative-arts'),
  ('Intellectual',        'intellectual'),
  ('Community & Service', 'community-service'),
  ('Nature & Land',       'nature-land'),
  ('Technical Skills',    'technical-skills')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- practices
-- ─────────────────────────────────────────────
create table if not exists practices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  name        text not null,
  label       text not null default 'skill'
    check (label in ('skill','craft','pursuit')),
  category_id uuid not null references skill_categories,
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

alter table practices enable row level security;

create policy "practices: owner full access"
  on practices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "practices: public read"
  on practices for select
  using (true);

-- ─────────────────────────────────────────────
-- commitments
-- ─────────────────────────────────────────────
create table if not exists commitments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles on delete cascade,
  practice_id          uuid not null references practices,
  status               text not null default 'launch'
    check (status in ('launch','active','completed','abandoned')),
  launch_starts_at     timestamptz,
  launch_ends_at       timestamptz,
  streak_starts_at     timestamptz,
  streak_ends_at       timestamptz,
  completed_at         timestamptz,
  target_payout_amount numeric not null default 2500,
  sessions_logged      int not null default 0,
  created_at           timestamptz not null default now()
);

alter table commitments enable row level security;

create policy "commitments: owner full access"
  on commitments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "commitments: validators can read"
  on commitments for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from validators v
      where v.commitment_id = commitments.id
        and v.validator_user_id = auth.uid()
        and v.status = 'active'
    )
  );

-- ─────────────────────────────────────────────
-- commitment_posts
-- ─────────────────────────────────────────────
create table if not exists commitment_posts (
  id             uuid primary key default gen_random_uuid(),
  commitment_id  uuid not null references commitments on delete cascade,
  user_id        uuid not null references profiles on delete cascade,
  body           text,
  media_urls     text[] not null default '{}',
  session_number int,
  posted_at      timestamptz not null default now()
);

alter table commitment_posts enable row level security;

create policy "posts: owner full access"
  on commitment_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts: validators can read"
  on commitment_posts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from validators v
      where v.commitment_id = commitment_posts.commitment_id
        and v.validator_user_id = auth.uid()
        and v.status = 'active'
    )
  );

-- ─────────────────────────────────────────────
-- validators
-- ─────────────────────────────────────────────
create table if not exists validators (
  id                 uuid primary key default gen_random_uuid(),
  commitment_id      uuid not null references commitments on delete cascade,
  validator_user_id  uuid references profiles on delete set null,
  validator_email    text,
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  status             text not null default 'invited'
    check (status in ('invited','active','declined'))
);

alter table validators enable row level security;

create policy "validators: commitment owner full access"
  on validators for all
  using (
    exists (
      select 1 from commitments c
      where c.id = validators.commitment_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from commitments c
      where c.id = validators.commitment_id
        and c.user_id = auth.uid()
    )
  );

create policy "validators: validator can read and update own row"
  on validators for all
  using (validator_user_id = auth.uid())
  with check (validator_user_id = auth.uid());

-- ─────────────────────────────────────────────
-- post_confirmations
-- ─────────────────────────────────────────────
create table if not exists post_confirmations (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references commitment_posts on delete cascade,
  validator_id uuid not null references validators on delete cascade,
  quality_note text,
  confirmed_at timestamptz not null default now(),
  unique (post_id, validator_id)
);

alter table post_confirmations enable row level security;

create policy "confirmations: validator can insert and read own"
  on post_confirmations for all
  using (
    exists (
      select 1 from validators v
      where v.id = post_confirmations.validator_id
        and v.validator_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from validators v
      where v.id = post_confirmations.validator_id
        and v.validator_user_id = auth.uid()
    )
  );

create policy "confirmations: post owner can read"
  on post_confirmations for select
  using (
    exists (
      select 1 from commitment_posts cp
      where cp.id = post_confirmations.post_id
        and cp.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- sponsorships
-- ─────────────────────────────────────────────
create table if not exists sponsorships (
  id               uuid primary key default gen_random_uuid(),
  commitment_id    uuid not null references commitments on delete cascade,
  sponsor_user_id  uuid references profiles on delete set null,
  sponsor_email    text,
  sponsor_name     text,
  sponsor_type     text not null default 'personal'
    check (sponsor_type in ('personal','institutional','brand')),
  pledge_amount    numeric not null,
  status           text not null default 'pledged'
    check (status in ('pledged','paid','refunded')),
  pledged_at       timestamptz not null default now(),
  paid_at          timestamptz
);

alter table sponsorships enable row level security;

create policy "sponsorships: commitment owner can read"
  on sponsorships for select
  using (
    exists (
      select 1 from commitments c
      where c.id = sponsorships.commitment_id
        and c.user_id = auth.uid()
    )
  );

create policy "sponsorships: sponsor can read own"
  on sponsorships for select
  using (sponsor_user_id = auth.uid());

create policy "sponsorships: anyone can insert during launch"
  on sponsorships for insert
  with check (
    exists (
      select 1 from commitments c
      where c.id = sponsorships.commitment_id
        and c.status = 'launch'
        and c.launch_ends_at > now()
    )
  );

-- ─────────────────────────────────────────────
-- contributions
-- ─────────────────────────────────────────────
create table if not exists contributions (
  id                uuid primary key default gen_random_uuid(),
  commitment_id     uuid not null references commitments on delete cascade,
  sponsor_id        uuid references sponsorships on delete set null,
  gross_amount      numeric not null,
  ss_share          numeric not null,  -- 5%
  mentor_share      numeric not null,  -- 23.75%
  coach_share       numeric not null,  -- 23.75%
  cb_share          numeric not null,  -- 23.75%
  pl_share          numeric not null,  -- 23.75%
  contribution_rate numeric not null default 0.50,
  created_at        timestamptz not null default now()
);

alter table contributions enable row level security;

create policy "contributions: commitment owner can read"
  on contributions for select
  using (
    exists (
      select 1 from commitments c
      where c.id = contributions.commitment_id
        and c.user_id = auth.uid()
    )
  );

create policy "contributions: admin full access"
  on contributions for all
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  );

-- ─────────────────────────────────────────────
-- mentor_relationships
-- ─────────────────────────────────────────────
create table if not exists mentor_relationships (
  id              uuid primary key default gen_random_uuid(),
  mentor_user_id  uuid not null references profiles on delete cascade,
  mentee_user_id  uuid not null references profiles on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  status          text not null default 'active'
    check (status in ('active','ended')),
  unique (mentor_user_id, mentee_user_id)
);

alter table mentor_relationships enable row level security;

create policy "mentor_relationships: both parties can read"
  on mentor_relationships for select
  using (
    auth.uid() = mentor_user_id
    or auth.uid() = mentee_user_id
  );

create policy "mentor_relationships: mentor can insert"
  on mentor_relationships for insert
  with check (auth.uid() = mentor_user_id);

create policy "mentor_relationships: both parties can update"
  on mentor_relationships for update
  using (
    auth.uid() = mentor_user_id
    or auth.uid() = mentee_user_id
  );

-- ─────────────────────────────────────────────
-- trust_records
-- ─────────────────────────────────────────────
create table if not exists trust_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references profiles on delete cascade,
  stage              text not null default 'seedling'
    check (stage in ('seedling','rooting','growing','established','mature')),
  depth_score        numeric not null default 0,
  breadth_score      numeric not null default 0,
  durability_score   numeric not null default 0,
  completed_streaks  int not null default 0,
  active_validators  int not null default 0,
  mentees_formed     int not null default 0,
  updated_at         timestamptz not null default now()
);

alter table trust_records enable row level security;

create policy "trust_records: owner full access"
  on trust_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trust_records: public read"
  on trust_records for select
  using (true);

-- ─────────────────────────────────────────────
-- Function: auto-create profile on signup
-- ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;

  insert into public.trust_records (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
