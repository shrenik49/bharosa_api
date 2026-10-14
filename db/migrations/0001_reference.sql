-- Bharosa schema 1: extensions, helpers, reference data (plain PostgreSQL, no Supabase dependency).

create extension if not exists pg_trgm     ;
create extension if not exists citext      ;

-- Shared trigger: keep updated_at honest.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Cities and areas. Launching Pune first, but nothing else in the schema is
-- Pune specific: a new city is a row here, not a migration.
-- ---------------------------------------------------------------------------
create table public.cities (
  id          smallint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  state       text,
  country     text not null default 'IN',
  center_lat  double precision not null,
  center_lng  double precision not null,
  is_active   boolean not null default false,   -- shown in the city picker
  launched_at timestamptz
);

create table public.areas (
  id       int generated always as identity primary key,
  city_id  smallint not null references public.cities(id) on delete cascade,
  slug     text not null,
  name     text not null,
  lat      double precision,
  lng      double precision,
  unique (city_id, slug)
);

-- ---------------------------------------------------------------------------
-- Tags: ONE table for every way we describe a place or a taste.
-- kind: cuisine | food | format | vibe | diet  (text + check so adding a kind is
-- a one-line migration, unlike a Postgres enum).
-- Onboarding picks ("Misal pav"), Discover chips ("Street food", "Late night")
-- and taste bars ("Rooftops") are all tags.
-- ---------------------------------------------------------------------------
create table public.tags (
  id        int generated always as identity primary key,
  kind      text not null check (kind in ('cuisine','food','format','vibe','diet')),
  slug      text not null,
  name      text not null,
  parent_id int references public.tags(id) on delete set null,
  sort      smallint not null default 0,
  is_active boolean not null default true,
  unique (kind, slug)
);
create index tags_parent_idx on public.tags(parent_id) where parent_id is not null;
