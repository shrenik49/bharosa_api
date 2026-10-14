-- Migration 2: accounts, people, settings, circles, taste inputs.

-- Accounts. Owned by this API (replaces Supabase auth.users): email + password hash.
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Rotating refresh tokens. Only a SHA-256 hash of the token is stored.
create table public.refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_idx on public.refresh_tokens(user_id);


-- One row per auth user. Public-facing basics only; private knobs live in user_settings.
create table public.profiles (
  id           uuid primary key references public.users(id) on delete cascade,
  handle       citext not null unique
               check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path  text,
  bio          text check (char_length(bio) <= 200),
  city_id      smallint references public.cities(id),
  area_id      int references public.areas(id),
  is_creator   boolean not null default false,
  onboarded_at timestamptz,
  deleted_at   timestamptz,                       -- soft delete, purged by a job
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Settings screen. Typed columns for things the app logic depends on,
-- `extra` jsonb for experiments and future toggles (no migration needed).
create table public.user_settings (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  rating_audience      text not null default 'circle' check (rating_audience in ('everyone','circle','me')),
  circle_first         boolean not null default false,
  show_creator_picks   boolean not null default true,
  revisit_reminders    boolean not null default true,
  push_activity        boolean not null default false,
  extra                jsonb not null default '{}',
  updated_at           timestamptz not null default now()
);
create trigger user_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Extra data for creators (transparency screen). Stats are derived from visits.
create table public.creator_profiles (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  tagline           text,
  links             jsonb not null default '{}',
  disclosure_policy text,
  verified_at       timestamptz
);

-- Circles. Directed: "owner trusts member". Friends, creators and taste twins
-- are the same table with a different `relation`, so a new kind is a new value.
create table public.circle_members (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  relation   text not null default 'friend' check (relation in ('friend','creator','twin')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);
create index circle_members_member_idx on public.circle_members(member_id);

-- Invite links ("Copy your invite link"). Contacts are never uploaded.
create table public.invites (
  code       text primary key,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  max_uses   int not null default 25,
  uses       int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_inviter_idx on public.invites(inviter_id);

create table public.invite_redemptions (
  code        text not null references public.invites(code) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

-- What someone said they like (onboarding quiz). Seeds the taste profile.
create table public.user_interests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id  int  not null references public.tags(id) on delete cascade,
  source  text not null default 'onboarding',
  weight  real not null default 1,
  primary key (user_id, tag_id)
);

-- Derived taste profile ("Your taste" bars). Rebuilt by refresh_user_affinity().
create table public.user_tag_affinity (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tag_id     int  not null references public.tags(id) on delete cascade,
  affinity   real not null check (affinity between 0 and 1),
  n_visits   int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);
