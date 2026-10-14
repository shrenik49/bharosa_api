-- Migration 5: derived data and database-level integrity.
-- Business rules (verification, ranking, feed) live in the NestJS services.
-- What stays here are the guarantees that must hold no matter who writes: counters,
-- aggregates and the "content only on a verified visit" rule.

-- ===========================================================================
-- place_stats: pre-aggregated so the Discover feed never scans visits.
-- ===========================================================================
create table public.place_stats (
  place_id         uuid primary key references public.places(id) on delete cascade,
  verified_visits  int not null default 0,
  unique_visitors  int not null default 0,
  repeat_visitors  int not null default 0,      -- visited on 2+ different days
  review_count     int not null default 0,
  photo_count      int not null default 0,
  last_visit_at    timestamptz,
  updated_at       timestamptz not null default now()
);

create or replace function public.refresh_place_stats(p_place uuid) returns void
language sql as $$
  with per_user as (
    select user_id, count(*) as n, max(visited_at) as last_at
    from public.visits where place_id = p_place and status = 'verified'
    group by user_id
  )
  insert into public.place_stats as s
    (place_id, verified_visits, unique_visitors, repeat_visitors, review_count, photo_count, last_visit_at, updated_at)
  select p_place,
    coalesce(sum(n), 0)::int, count(*)::int, count(*) filter (where n > 1)::int,
    (select count(*) from public.reviews r where r.place_id = p_place and not r.is_hidden)::int,
    (select count(*) from public.photos  f where f.place_id = p_place and f.status = 'approved')::int,
    max(last_at), now()
  from per_user
  on conflict (place_id) do update set
    verified_visits = excluded.verified_visits, unique_visitors = excluded.unique_visitors,
    repeat_visitors = excluded.repeat_visitors, review_count = excluded.review_count,
    photo_count = excluded.photo_count, last_visit_at = excluded.last_visit_at, updated_at = now();
$$;

create or replace function public.trg_refresh_stats_from_visit() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_place_stats(old.place_id);
  elsif (new.status = 'verified' or (tg_op = 'UPDATE' and old.status = 'verified')) then
    perform public.refresh_place_stats(new.place_id);
  end if;
  return null;
end $$;
create trigger visits_stats after insert or update of status or delete on public.visits
  for each row execute function public.trg_refresh_stats_from_visit();

create or replace function public.trg_refresh_stats_from_content() returns trigger
language plpgsql as $$
begin
  perform public.refresh_place_stats(coalesce(new.place_id, old.place_id));
  return null;
end $$;
create trigger reviews_stats after insert or update of is_hidden or delete on public.reviews
  for each row execute function public.trg_refresh_stats_from_content();
create trigger photos_stats after insert or update of status or delete on public.photos
  for each row execute function public.trg_refresh_stats_from_content();

-- ===========================================================================
-- Guard rails: content only on VERIFIED visits you own; max 3 photos per visit.
-- ===========================================================================
create or replace function public.trg_require_verified_visit() returns trigger
language plpgsql as $$
declare v public.visits;
begin
  select * into v from public.visits where id = new.visit_id;
  if v.id is null or v.status <> 'verified' then
    raise exception 'visit % is not verified', new.visit_id using errcode = '23514';
  end if;
  if v.user_id <> new.user_id or v.place_id <> new.place_id then
    raise exception 'visit does not belong to this user and place' using errcode = '23514';
  end if;
  if tg_table_name = 'photos' and
     (select count(*) from public.photos where visit_id = new.visit_id) >= 3 then
    raise exception 'max 3 photos per visit' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger reviews_verified before insert on public.reviews
  for each row execute function public.trg_require_verified_visit();
create trigger photos_verified  before insert on public.photos
  for each row execute function public.trg_require_verified_visit();

-- ===========================================================================
-- Like counters + notification on like (one trigger, any subject_type).
-- ===========================================================================
create or replace function public.trg_reaction_counts() returns trigger
language plpgsql as $$
declare d int; t text; i uuid; owner uuid;
begin
  if tg_op = 'INSERT' then d := 1; t := new.subject_type; i := new.subject_id;
  else d := -1; t := old.subject_type; i := old.subject_id; end if;
  if t = 'photo' then
    update public.photos set like_count = greatest(like_count + d, 0) where id = i returning user_id into owner;
  elsif t = 'review' then
    update public.reviews set like_count = greatest(like_count + d, 0) where id = i returning user_id into owner;
  elsif t = 'list' then
    update public.lists set like_count = greatest(like_count + d, 0) where id = i returning user_id into owner;
  end if;
  if tg_op = 'INSERT' and owner is not null and owner <> new.user_id then
    insert into public.notifications(user_id, type, actor_id, subject_type, subject_id)
    values (owner, t || '_liked', new.user_id, t, i);
  end if;
  return null;
end $$;
create trigger reactions_counts after insert or delete on public.reactions
  for each row execute function public.trg_reaction_counts();

-- Remove likes when the liked thing is deleted (no FK because the table is polymorphic).
create or replace function public.trg_reaction_cleanup() returns trigger
language plpgsql as $$
begin
  delete from public.reactions where subject_type = tg_argv[0] and subject_id = old.id;
  return old;
end $$;
create trigger photos_cleanup  after delete on public.photos  for each row execute function public.trg_reaction_cleanup('photo');
create trigger reviews_cleanup after delete on public.reviews for each row execute function public.trg_reaction_cleanup('review');
create trigger lists_cleanup   after delete on public.lists   for each row execute function public.trg_reaction_cleanup('list');

-- Tell people when they are added to a circle.
create or replace function public.trg_circle_notify() returns trigger
language plpgsql as $$
begin
  insert into public.notifications(user_id, type, actor_id, subject_type, subject_id)
  values (new.member_id, 'added_to_circle', new.owner_id, 'user', new.owner_id);
  return null;
end $$;
create trigger circle_notify after insert on public.circle_members
  for each row execute function public.trg_circle_notify();

-- ===========================================================================
-- Views the screens read.
-- ===========================================================================
create view public.user_trust_stats as
select u.id as user_id,
       count(v.*) filter (where v.status = 'verified')                         as verified_visits,
       (select count(*) from (select place_id from public.visits x
         where x.user_id = u.id and x.status = 'verified'
         group by place_id having count(*) > 1) r)                              as places_revisited,
       (select count(*) from public.reports rp
         where rp.status = 'upheld'
           and ((rp.subject_type = 'review' and rp.subject_id in (select id from public.reviews where user_id = u.id))
             or (rp.subject_type = 'photo'  and rp.subject_id in (select id from public.photos  where user_id = u.id))))
                                                                                as flags
from public.profiles u
left join public.visits v on v.user_id = u.id
group by u.id;

create view public.creator_stats as
select cp.user_id,
       count(*) filter (where v.status = 'verified')                                    as verified_visits,
       round(100.0 * count(*) filter (where v.status = 'verified' and v.payment_type = 'self')
             / nullif(count(*) filter (where v.status = 'verified'), 0))                 as paid_own_pct,
       count(*) filter (where v.status = 'verified' and v.payment_type = 'sponsored')   as sponsored_flagged
from public.creator_profiles cp
left join public.visits v on v.user_id = cp.user_id
group by cp.user_id;

create view public.been_there as
select v.user_id, v.place_id, count(*) as visits, max(v.visited_at) as last_visit
from public.visits v where v.status = 'verified'
group by v.user_id, v.place_id;

-- Who may see whose ratings (Settings > Who can see my ratings). Pure read helper for the API queries.
create or replace function public.can_see_user(viewer uuid, author uuid) returns boolean
language sql stable as $$
  select viewer = author
      or exists (select 1 from public.user_settings s
                 where s.user_id = author and s.rating_audience = 'everyone')
      or exists (select 1 from public.user_settings s
                 join public.circle_members c on c.owner_id = author and c.member_id = viewer
                 where s.user_id = author and s.rating_audience = 'circle');
$$;
