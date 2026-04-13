-- Search Star v3 — institutions schema
-- Phase 9: institutional portal

-- ─────────────────────────────────────────────
-- institutions
-- ─────────────────────────────────────────────
create table if not exists institutions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  type                text not null
    check (type in ('employer','university','trade_program','foundation','civic','brand')),
  contact_name        text,
  contact_email       text not null unique,
  budget_total        numeric not null default 0,
  budget_spent        numeric not null default 0,
  skill_category_id   uuid references skill_categories on delete set null,
  created_at          timestamptz not null default now()
);

alter table institutions enable row level security;

create policy "institutions: public insert"
  on institutions for insert
  with check (true);

create policy "institutions: owner can read"
  on institutions for select
  using (
    contact_email = (select email from auth.users where id = auth.uid())
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  );

create policy "institutions: owner can update"
  on institutions for update
  using (
    contact_email = (select email from auth.users where id = auth.uid())
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  )
  with check (
    contact_email = (select email from auth.users where id = auth.uid())
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  );

-- ─────────────────────────────────────────────
-- institution_memberships
-- ─────────────────────────────────────────────
create table if not exists institution_memberships (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions on delete cascade,
  user_id         uuid not null references profiles on delete cascade,
  enrolled_at     timestamptz not null default now(),
  unique (institution_id, user_id)
);

alter table institution_memberships enable row level security;

create policy "institution_memberships: institution owner can read"
  on institution_memberships for select
  using (
    exists (
      select 1 from institutions i
      where i.id = institution_memberships.institution_id
        and i.contact_email = (select email from auth.users where id = auth.uid())
    )
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  );

create policy "institution_memberships: institution owner can insert"
  on institution_memberships for insert
  with check (
    exists (
      select 1 from institutions i
      where i.id = institution_memberships.institution_id
        and i.contact_email = (select email from auth.users where id = auth.uid())
    )
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.mentor_role = 'practice_leader'
    )
  );

create policy "institution_memberships: user can read own"
  on institution_memberships for select
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- Add institution_id to profiles
-- ─────────────────────────────────────────────
alter table profiles
  add column if not exists institution_id uuid references institutions on delete set null;
