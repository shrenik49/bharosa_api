-- Seed: Pune launch data. Safe to re-run.
insert into public.cities(slug, name, state, center_lat, center_lng, is_active, launched_at)
values ('pune', 'Pune', 'Maharashtra', 18.5204, 73.8567, true, now())
on conflict (slug) do nothing;

insert into public.areas(city_id, slug, name, lat, lng)
select c.id, a.slug, a.name, a.lat, a.lng from public.cities c,
(values ('koregaon-park','Koregaon Park',18.5362,73.8938), ('kalyani-nagar','Kalyani Nagar',18.5463,73.9030),
        ('camp','Camp',18.5114,73.8776), ('sadashiv-peth','Sadashiv Peth',18.5130,73.8506),
        ('baner','Baner',18.5590,73.7868), ('kothrud','Kothrud',18.5074,73.8077)) as a(slug,name,lat,lng)
where c.slug = 'pune'
on conflict (city_id, slug) do nothing;

insert into public.tags(kind, slug, name, sort) values
 ('format','street-food','Street food',1), ('format','cafe','Cafés',2), ('format','late-night','Late night',3),
 ('format','rooftop','Rooftops',4), ('format','fine-dining','Fine dining',5),
 ('food','misal-pav','Misal pav',10), ('food','bun-maska','Bun maska',11), ('food','biryani','Biryani',12),
 ('food','filter-coffee','Filter coffee',13), ('food','momos','Momos',14), ('food','chaat','Chaat',15),
 ('food','mastani','Mastani',16), ('food','thali','Thali',17), ('food','kebabs','Kebabs',18), ('food','cold-brew','Cold brew',19),
 ('cuisine','maharashtrian','Maharashtrian',30), ('cuisine','south-indian','South Indian',31), ('cuisine','irani','Irani',32)
on conflict (kind, slug) do nothing;

insert into public.badges(code, name, description, rule) values
 ('regular','Regular','Went back to the same place 3+ times','{"revisits":3}'),
 ('honest','Honest','30 verified visits, no flags','{"verified":30,"flags":0}'),
 ('early','Early','Rated a place before 50 others','{"first_n":50}')
on conflict (code) do nothing;
