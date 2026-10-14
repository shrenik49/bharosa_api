-- Migration 3: the core loop. Places, verified visits, rankings, reviews.

create table public.places (
  id          uuid primary key default gen_random_uuid(),
  city_id     smallint not null references public.cities(id),
  area_id     int references public.areas(id),
  name        text not null,
  slug        text not null,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  price_level smallint check (price_level between 1 and 4),
  phone       text,
  hours       jsonb,                       -- {"mon":[["08:00","22:00"]], ...}
  links       jsonb not null default '{}', -- website, instagram, maps
  external    jsonb not null default '{}', -- osm_id, google_place_id: lets us import/merge later
  status      text not null default 'active' check (status in ('active','closed','hidden')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (city_id, slug)
);
create trigger places_updated before update on public.places
  for each row execute function public.set_updated_at();
create index places_city_idx   on public.places(city_id) where status = 'active';
create index places_name_trgm  on public.places using gin (name gin_trgm_ops);
create index places_geo_idx    on public.places(lat, lng);

create table public.place_tags (
  place_id uuid not null references public.places(id) on delete cascade,
  tag_id   int  not null references public.tags(id) on delete cascade,
  primary key (place_id, tag_id)
);
create index place_tags_tag_idx on public.place_tags(tag_id);

-- "Order: Kolhapuri misal". Dishes come from visits, so the menu builds itself.
create table public.dishes (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index dishes_place_name_uq on public.dishes(place_id, lower(name));

-- ---------------------------------------------------------------------------
-- VISITS: the fact everything else hangs off. Only `verified` visits count.
-- The API creates visits; only the verify endpoints
-- set `verified`, so a client can never mark its own visit verified.
-- Bill photos are read on-device and discarded: we keep a fingerprint, not the image.
-- ---------------------------------------------------------------------------
create table public.visits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  place_id          uuid not null references public.places(id) on delete cascade,
  visited_at        timestamptz not null default now(),
  visit_date        date generated always as ((visited_at at time zone 'Asia/Kolkata')::date) stored,
  method            text not null check (method in ('bill','upi','checkin')),
  status            text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_at       timestamptz,
  payment_type      text not null default 'self' check (payment_type in ('self','invited','sponsored')),
  proof_fingerprint text,                      -- hash of bill date+total+place; blocks reuse
  proof_meta        jsonb not null default '{}',
  distance_m        int,                       -- check-in distance, set server-side
  created_at        timestamptz not null default now(),
  unique (user_id, place_id, visit_date)       -- one visit per place per day
);
create unique index visits_fingerprint_uq on public.visits(proof_fingerprint) where proof_fingerprint is not null;
create index visits_place_verified_idx on public.visits(place_id, user_id) where status = 'verified';
create index visits_user_idx           on public.visits(user_id, visited_at desc);

create table public.visit_dishes (
  visit_id uuid not null references public.visits(id) on delete cascade,
  dish_id  uuid not null references public.dishes(id) on delete cascade,
  primary key (visit_id, dish_id)
);

-- "A line for your circle". At most one per visit; only for verified visits.
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null unique references public.visits(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  like_count int  not null default 0,
  is_hidden  boolean not null default false,   -- set when a report is upheld
  created_at timestamptz not null default now()
);
create index reviews_place_idx on public.reviews(place_id, created_at desc) where not is_hidden;
create index reviews_user_idx  on public.reviews(user_id);

-- ---------------------------------------------------------------------------
-- Ranking by comparison ("Better / About the same / Not as good").
-- comparisons is an immutable event log; user_place_ranks is the current state.
-- rank_key uses fractional positions: inserting between two neighbours is one
-- write, no renumbering. `score` (0-100) is derived and refreshed per user.
-- ---------------------------------------------------------------------------
create table public.comparisons (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  place_id     uuid not null references public.places(id) on delete cascade,
  ref_place_id uuid not null references public.places(id) on delete cascade,
  outcome      text not null check (outcome in ('better','same','worse')),
  visit_id     uuid references public.visits(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (place_id <> ref_place_id)
);
create index comparisons_user_idx on public.comparisons(user_id, created_at desc);

create table public.user_place_ranks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  rank_key   double precision not null,         -- higher = better
  score      real not null default 50 check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index user_place_ranks_order_idx on public.user_place_ranks(user_id, rank_key desc);
create index user_place_ranks_place_idx on public.user_place_ranks(place_id) include (user_id, score);
