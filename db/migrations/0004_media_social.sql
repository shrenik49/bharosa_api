-- Migration 4: photos, likes, lists, reports, notifications, badges, similarity.

-- Photos of a place. Every photo hangs off a VERIFIED visit, so every picture
-- is from someone who was there. No type column on purpose: users just add photos.
-- Files live in object storage (provider decided later); we keep paths + a tiny blurhash.
create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  place_id     uuid not null references public.places(id) on delete cascade,
  visit_id     uuid not null references public.visits(id) on delete cascade,
  storage_path text not null,                  -- photos/{user_id}/{id}.webp
  thumb_path   text,
  width        smallint,
  height       smallint,
  bytes        int,
  blurhash     text,
  status       text not null default 'approved' check (status in ('pending','approved','hidden')),
  like_count   int not null default 0,
  created_at   timestamptz not null default now()
);
create index photos_place_idx on public.photos(place_id, created_at desc) where status = 'approved';
create index photos_place_top_idx on public.photos(place_id, like_count desc) where status = 'approved';
create index photos_user_idx  on public.photos(user_id, created_at desc);
create index photos_visit_idx on public.photos(visit_id);

-- One generic reactions table for every likeable thing. Today: photos and
-- reviews. Tomorrow: lists, comments, creator posts. Add the type to the check.
-- (Trade-off: no FK on subject_id; a cleanup trigger on each target removes orphans.)
create table public.reactions (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('photo','review','list')),
  subject_id   uuid not null,
  kind         text not null default 'like' check (kind in ('like')),
  created_at   timestamptz not null default now(),
  primary key (user_id, subject_type, subject_id, kind)
);
create index reactions_subject_idx on public.reactions(subject_type, subject_id);

-- Saved places. "Want to try" is a list; "Been there" is derived from visits.
create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  kind       text not null default 'custom' check (kind in ('want','favorites','custom')),
  is_public  boolean not null default false,
  like_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index lists_one_want_uq on public.lists(user_id) where kind = 'want';
create index lists_user_idx on public.lists(user_id);

create table public.list_items (
  list_id  uuid not null references public.lists(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  note     text,
  added_at timestamptz not null default now(),
  primary key (list_id, place_id)
);
create index list_items_place_idx on public.list_items(place_id);

-- Reports on anything reportable. An upheld report hides the content and
-- counts as a flag on the author's trust record.
create table public.reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('review','photo','user','place')),
  subject_id   uuid not null,
  reason       text not null check (reason in ('paid','fake','copy','abuse','other')),
  details      text,
  status       text not null default 'open' check (status in ('open','upheld','dismissed')),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (reporter_id, subject_type, subject_id)
);
create index reports_open_idx   on public.reports(created_at) where status = 'open';
create index reports_subject_idx on public.reports(subject_type, subject_id);

-- Activity screen. `data` jsonb carries whatever a given type needs (no new columns per feature).
create table public.notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null,                   -- friend_visit | new_twin | photo_liked | revisit_nudge | ...
  actor_id     uuid references public.profiles(id) on delete set null,
  subject_type text,
  subject_id   uuid,
  data         jsonb not null default '{}',
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx   on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;

-- Badges are data: add a badge by inserting a row and awarding it from a function.
create table public.badges (
  code        text primary key,
  name        text not null,
  description text not null,
  rule        jsonb not null default '{}'
);
create table public.user_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- Taste twins. Only the top matches per user are stored (bounded size).
create table public.taste_similarity (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  other_id    uuid not null references public.profiles(id) on delete cascade,
  score       real not null check (score between 0 and 1),
  overlap     smallint not null,               -- how many places both ranked
  computed_at timestamptz not null default now(),
  primary key (user_id, other_id),
  check (user_id <> other_id)
);
create index taste_similarity_top_idx on public.taste_similarity(user_id, score desc);
