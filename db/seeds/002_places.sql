-- Seed: well-known Pune places so the feed is not empty. Safe to re-run.
-- !! Coordinates are APPROXIMATE (from memory, ~100-300 m accuracy) and some places may have
-- !! moved or closed. Check each on Google Maps / OSM before launch: check-in verification
-- !! uses a 100 m radius, so wrong coordinates will reject real visits.
-- Columns: slug, name, area slug (null if not one of our 6 areas), lat, lng, price 1-4, tag slugs

with src(slug, name, area, lat, lng, price, tags) as (values
  ('vaishali',            'Vaishali',                 null,            18.5206, 73.8412, 2, array['south-indian']),
  ('roopali',             'Roopali',                  null,            18.5198, 73.8420, 2, array['south-indian','filter-coffee']),
  ('cafe-goodluck',       'Cafe Goodluck',            null,            18.5175, 73.8416, 1, array['irani','bun-maska']),
  ('kayani-bakery',       'Kayani Bakery',            'camp',          18.5127, 73.8783, 1, array['irani','bun-maska']),
  ('dorabjee-and-sons',   'Dorabjee & Sons',          'camp',          18.5160, 73.8775, 3, array['irani','biryani']),
  ('sujata-mastani',      'Sujata Mastani',           'sadashiv-peth', 18.5129, 73.8527, 1, array['mastani']),
  ('bedekar-misal',       'Bedekar Misal',            null,            18.5138, 73.8556, 1, array['misal-pav','maharashtrian']),
  ('shreyas',             'Shreyas',                  null,            18.5153, 73.8440, 2, array['thali','maharashtrian']),
  ('german-bakery',       'German Bakery',            'koregaon-park', 18.5381, 73.8934, 2, array['cafe']),
  ('malaka-spice',        'Malaka Spice',             'koregaon-park', 18.5409, 73.8950, 3, array['fine-dining']),
  ('the-flour-works',     'The Flour Works',          'koregaon-park', 18.5400, 73.8920, 2, array['cafe']),
  ('mahesh-lunch-home',   'Mahesh Lunch Home',        null,            18.5170, 73.8450, 3, array['maharashtrian']),
  ('wadeshwar',           'Wadeshwar',                null,            18.5178, 73.8395, 2, array['maharashtrian','thali']),
  ('hotel-shabree',       'Hotel Shabree',            null,            18.5167, 73.8423, 2, array['maharashtrian','thali']),
  ('goodluck-chaat-fc',   'Chaat Corner, FC Road',    null,            18.5232, 73.8412, 1, array['street-food','chaat'])
), c as (select id from public.cities where slug = 'pune')
insert into public.places(city_id, area_id, name, slug, lat, lng, price_level)
select c.id, a.id, s.name, s.slug, s.lat, s.lng, s.price
from src s cross join c
left join public.areas a on a.city_id = c.id and a.slug = s.area
on conflict (city_id, slug) do nothing;

-- Tags are a second statement so it can see the places inserted above.
with src(slug, tags) as (values
  ('vaishali',          array['south-indian']),
  ('roopali',           array['south-indian','filter-coffee']),
  ('cafe-goodluck',     array['irani','bun-maska']),
  ('kayani-bakery',     array['irani','bun-maska']),
  ('dorabjee-and-sons', array['irani','biryani']),
  ('sujata-mastani',    array['mastani']),
  ('bedekar-misal',     array['misal-pav','maharashtrian']),
  ('shreyas',           array['thali','maharashtrian']),
  ('german-bakery',     array['cafe']),
  ('malaka-spice',      array['fine-dining']),
  ('the-flour-works',   array['cafe']),
  ('mahesh-lunch-home', array['maharashtrian']),
  ('wadeshwar',         array['maharashtrian','thali']),
  ('hotel-shabree',     array['maharashtrian','thali']),
  ('goodluck-chaat-fc', array['street-food','chaat'])
)
insert into public.place_tags(place_id, tag_id)
select p.id, t.id
from src s
join public.cities c on c.slug = 'pune'
join public.places p on p.city_id = c.id and p.slug = s.slug
join public.tags t on t.slug = any(s.tags)
on conflict do nothing;
