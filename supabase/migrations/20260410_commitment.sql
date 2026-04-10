-- ═══════════════════════════════════════════════════
-- Practice Layer — Commitment tables (v2.0)
-- Section 3.10 of the Search Star spec
-- ═══════════════════════════════════════════════════

-- commitments: the atomic unit of the Search Star profile
create table if not exists commitments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users not null,
  habit             text not null,
  started_at        timestamptz not null default now(),
  status            text not null default 'active'
                    check (status in ('active','ongoing','restart_eligible','completed')),
  logged_days       int not null default 0,
  current_streak    int not null default 0,
  longest_streak    int not null default 0,
  visibility        text not null default 'community'
                    check (visibility in ('public','community','private')),
  prior_attempt_id  uuid references commitments(id),
  created_at        timestamptz not null default now()
);

create index if not exists commitments_user_id_idx on commitments(user_id);
create index if not exists commitments_status_idx on commitments(status);

-- commitment_posts: freeform posts during a commitment
create table if not exists commitment_posts (
  id              uuid primary key default gen_random_uuid(),
  commitment_id   uuid references commitments not null,
  user_id         uuid references auth.users not null,
  body            text,
  media_urls      text[] default '{}',
  day_number      int not null,
  is_milestone    boolean not null default false,
  posted_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists commitment_posts_commitment_id_idx on commitment_posts(commitment_id);
create index if not exists commitment_posts_user_id_idx on commitment_posts(user_id);

-- commitment_supporters: witness / co-practitioner / stakeholder
create table if not exists commitment_supporters (
  id                      uuid primary key default gen_random_uuid(),
  commitment_id           uuid references commitments not null,
  supporter_id            uuid references auth.users not null,
  role                    text not null
                          check (role in ('witness','co_practitioner','stakeholder')),
  stake_amount            numeric,
  stake_status            text check (stake_status in ('held','returned','forfeited')),
  linked_commitment_id    uuid references commitments(id),
  joined_at               timestamptz not null default now(),
  unique (commitment_id, supporter_id)
);

create index if not exists commitment_supporters_commitment_id_idx on commitment_supporters(commitment_id);
create index if not exists commitment_supporters_supporter_id_idx on commitment_supporters(supporter_id);

-- post_interactions: echo / fork / confirmation
create table if not exists post_interactions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references commitment_posts not null,
  user_id       uuid references auth.users not null,
  type          text not null check (type in ('echo','fork','confirmation')),
  note          text,
  created_at    timestamptz not null default now(),
  unique (post_id, user_id, type)
);

create index if not exists post_interactions_post_id_idx on post_interactions(post_id);

-- RLS
alter table commitments enable row level security;
alter table commitment_posts enable row level security;
alter table commitment_supporters enable row level security;
alter table post_interactions enable row level security;

-- commitments: owner full access; others read public/community
create policy "commitments_owner" on commitments
  for all using (auth.uid() = user_id);
create policy "commitments_public_read" on commitments
  for select using (visibility = 'public');
create policy "commitments_community_read" on commitments
  for select using (
    visibility = 'community'
    and auth.uid() is not null
  );

-- commitment_posts: owner full access; others read if commitment is visible
create policy "posts_owner" on commitment_posts
  for all using (auth.uid() = user_id);
create policy "posts_public_read" on commitment_posts
  for select using (
    exists (
      select 1 from commitments c
      where c.id = commitment_id
      and (c.visibility = 'public' or (c.visibility = 'community' and auth.uid() is not null))
    )
  );

-- supporters: authenticated users can add themselves; owner can read all
create policy "supporters_owner_read" on commitment_supporters
  for select using (
    exists (select 1 from commitments c where c.id = commitment_id and c.user_id = auth.uid())
    or supporter_id = auth.uid()
  );
create policy "supporters_insert" on commitment_supporters
  for insert with check (supporter_id = auth.uid());

-- interactions: authenticated users
create policy "interactions_all" on post_interactions
  for all using (auth.uid() is not null);
