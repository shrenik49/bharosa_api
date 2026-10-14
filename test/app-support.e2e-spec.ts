import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/services/database.service';
import { configureApp } from '../src/main';

// A tiny but real JPEG header + padding (only the first bytes matter to the type check).
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

/** Endpoints the mobile app relies on: saved places, dishes, uploads, taste data, profile extras. */
describe('App support endpoints', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const stamp = Date.now();
  const emails = [`s-a-${stamp}@example.com`, `s-b-${stamp}@example.com`];
  const tokens: string[] = [];
  const ids: string[] = [];
  let pa = '';
  let pb = '';
  let visitA = '';
  const uploaded: string[] = [];

  const http = () => request(app.getHttpServer());
  const as = (i: number) => ({ Authorization: `Bearer ${tokens[i]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    pa = (await db.queryOne<{ id: string }>(`select id from places where slug = 'vaishali'`))!.id;
    pb = (await db.queryOne<{ id: string }>(`select id from places where slug = 'roopali'`))!.id;
    for (const [i, email] of emails.entries()) {
      const res = await http()
        .post('/auth/signup')
        .send({ name: i === 0 ? 'Sana' : 'Tej', email, password: 'password123' })
        .expect(201);
      tokens.push(res.body.accessToken);
      ids.push(res.body.user.id);
    }
    const visit = await http()
      .post('/visits/checkin')
      .set(as(0))
      .send({ placeId: pa, lat: 18.5206, lng: 73.8412 })
      .expect(200);
    visitA = visit.body.id;
  });

  afterAll(async () => {
    await db.query('delete from dishes where place_id = $1 and lower(name) like $2', [pa, 'e2e %']);
    await db.query('delete from users where email = any($1)', [emails]);
    await db.query('select refresh_place_stats($1), refresh_place_stats($2)', [pa, pb]);
    await app.close();
  });

  describe('saved places ("Want to try")', () => {
    it('saves, lists with coordinates and tags, and removes a place', async () => {
      await http().put(`/lists/want/items/${pa}`).set(as(0)).expect(204);
      await http().put(`/lists/want/items/${pa}`).set(as(0)).expect(204); // idempotent
      const want = await http().get('/lists/want').set(as(0)).expect(200);
      expect(want.body.kind).toBe('want');
      expect(want.body.items).toHaveLength(1);
      expect(want.body.items[0]).toMatchObject({ placeId: pa, name: 'Vaishali' });
      expect(typeof want.body.items[0].lat).toBe('number');
      expect(want.body.items[0].tagSlugs).toContain('south-indian');
      await http().delete(`/lists/want/items/${pa}`).set(as(0)).expect(204);
      const after = await http().get('/lists/want').set(as(0)).expect(200);
      expect(after.body.items).toEqual([]);
      await http().put('/lists/want/items/00000000-0000-0000-0000-000000000000').set(as(0)).expect(404);
    });

    it('returns coordinates for Been there', async () => {
      const res = await http().get('/lists/been-there').set(as(0)).expect(200);
      expect(res.body[0]).toMatchObject({ placeId: pa });
      expect(typeof res.body[0].lat).toBe('number');
    });
  });

  describe('dishes and "what you ate"', () => {
    it('adds typed dishes to the menu once and attaches them to the visit', async () => {
      const first = await http().get(`/places/${pa}/dishes`).set(as(0)).expect(200);
      expect(first.body.some((d: { name: string }) => d.name === 'E2E Masala Dosa')).toBe(false);

      await http()
        .put(`/visits/${visitA}/dishes`)
        .set(as(0))
        .send({ dishIds: [], newDishNames: ['E2E Masala Dosa'] })
        .expect(204);
      // Same name in different case reuses the same dish, never a duplicate.
      await http()
        .put(`/visits/${visitA}/dishes`)
        .set(as(0))
        .send({ dishIds: [], newDishNames: ['e2e masala dosa'] })
        .expect(204);

      const menu = await http().get(`/places/${pa}/dishes`).set(as(0)).expect(200);
      const dishes = menu.body.filter((d: { name: string }) => d.name.toLowerCase() === 'e2e masala dosa');
      expect(dishes).toHaveLength(1);
      const attached = await db.queryOne<{ n: number }>(
        'select count(*)::int as n from visit_dishes where visit_id = $1',
        [visitA],
      );
      expect(attached!.n).toBe(1);

      const detail = await http().get(`/places/${pa}`).set(as(0)).expect(200);
      expect(detail.body.dishes.map((d: { name: string }) => d.name)).toContain('E2E Masala Dosa');
    });

    it('ignores dish ids from other places and refuses someone elses visit', async () => {
      const other = await db.queryOne<{ id: string }>(
        `insert into dishes(place_id, name) values ($1, 'E2E Other Place Dish') returning id`,
        [pb],
      );
      await http()
        .put(`/visits/${visitA}/dishes`)
        .set(as(0))
        .send({ dishIds: [other!.id], newDishNames: [] })
        .expect(204);
      const attached = await db.queryOne<{ n: number }>(
        'select count(*)::int as n from visit_dishes where visit_id = $1',
        [visitA],
      );
      expect(attached!.n).toBe(1);
      await db.query('delete from dishes where id = $1', [other!.id]);
      await http()
        .put(`/visits/${visitA}/dishes`)
        .set(as(1))
        .send({ dishIds: [], newDishNames: ['Nope'] })
        .expect(403);
      await http()
        .put(`/visits/${visitA}/dishes`)
        .set(as(0))
        .send({ dishIds: ['x'], newDishNames: [] })
        .expect(400);
    });
  });

  describe('photo upload', () => {
    it('stores a real image, serves it at /media and records it on the visit', async () => {
      const res = await http()
        .post('/photos/upload')
        .set(as(0))
        .field('visitId', visitA)
        .field('width', '1080')
        .field('height', '720')
        .attach('file', JPEG, { filename: 'p.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(res.body).toMatchObject({ visitId: visitA, userId: ids[0], width: 1080 });
      expect(res.body.storagePath).toMatch(new RegExp(`^${ids[0]}/[0-9a-f-]{36}\\.jpg$`));
      uploaded.push(res.body.id);

      expect(existsSync(resolve(process.env.UPLOAD_DIR ?? 'uploads', res.body.storagePath))).toBe(true);
      const served = await http().get(res.body.url).expect(200);
      expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.from(served.body).length).toBeGreaterThan(100);
    });

    it('rejects non-images, missing files, oversize files and other peoples visits', async () => {
      await http()
        .post('/photos/upload')
        .set(as(0))
        .field('visitId', visitA)
        .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.jpg', contentType: 'image/jpeg' })
        .expect(400);
      await http().post('/photos/upload').set(as(0)).field('visitId', visitA).expect(400);
      await http()
        .post('/photos/upload')
        .set(as(0))
        .field('visitId', visitA)
        .attach('file', Buffer.concat([JPEG, Buffer.alloc(1_100_000)]), {
          filename: 'big.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);
      await http()
        .post('/photos/upload')
        .set(as(1))
        .field('visitId', visitA)
        .attach('file', JPEG, { filename: 'p.jpg', contentType: 'image/jpeg' })
        .expect(403);
    });

    it('deletes the file when the photo is deleted', async () => {
      const mine = await http().get('/photos/mine').set(as(0)).expect(200);
      const photo = mine.body.find((p: { id: string }) => p.id === uploaded[0]);
      const file = resolve(process.env.UPLOAD_DIR ?? 'uploads', photo.storagePath);
      expect(existsSync(file)).toBe(true);
      await http().delete(`/photos/${photo.id}`).set(as(0)).expect(204);
      expect(existsSync(file)).toBe(false);
    });
  });

  describe('reviews filter, taste data and profiles', () => {
    it('filters reviews to my circle', async () => {
      await http().patch('/settings').set(as(0)).send({ ratingAudience: 'everyone' }).expect(200);
      await http().post('/reviews').set(as(0)).send({ visitId: visitA, body: 'Great dosa' }).expect(201);
      const all = await http().get(`/places/${pa}/reviews?filter=all`).set(as(1)).expect(200);
      expect(all.body).toHaveLength(1);
      const none = await http().get(`/places/${pa}/reviews?filter=circle`).set(as(1)).expect(200);
      expect(none.body).toEqual([]);
      await http().post('/circle').set(as(1)).send({ memberId: ids[0] }).expect(204);
      const circle = await http().get(`/places/${pa}/reviews?filter=circle`).set(as(1)).expect(200);
      expect(circle.body).toHaveLength(1);
      await http().get(`/places/${pa}/reviews?filter=bogus`).set(as(1)).expect(400);
    });

    it('replaces quiz interests when the quiz is retaken, and reports them with affinity', async () => {
      const tags = await db.query<{ id: number; slug: string }>(
        `select id, slug from tags where slug in ('misal-pav','biryani','cafe')`,
      );
      const id = (slug: string) => tags.find(t => t.slug === slug)!.id;
      await http()
        .post('/onboarding/taste-profile')
        .set(as(0))
        .send({ tagIds: [id('misal-pav'), id('biryani')], placeIds: [pa] })
        .expect(204);
      await http()
        .post('/onboarding/taste-profile')
        .set(as(0))
        .send({ tagIds: [id('biryani'), id('cafe')], placeIds: [pa] })
        .expect(204);
      const interests = await http().get('/profiles/me/interests').set(as(0)).expect(200);
      expect(interests.body.map((t: { tagId: number }) => t.tagId).sort()).toEqual([id('biryani'), id('cafe')].sort());
      await http().get('/profiles/me/affinity').set(as(0)).expect(200);
    });

    it('shows people with creator flag, similarity fields and a transparency page without setup', async () => {
      const circle = await http().get('/circle').set(as(1)).expect(200);
      expect(circle.body[0]).toMatchObject({ userId: ids[0], isCreator: false });
      const profile = await http().get(`/users/${ids[0]}`).set(as(1)).expect(200);
      expect(profile.body).toMatchObject({ relation: 'friend', similarityScore: null, similarityOverlap: null });
      const creator = await http().get(`/creators/${ids[0]}`).set(as(1)).expect(200);
      expect(creator.body).toMatchObject({ userId: ids[0], tagline: null, links: {}, verifiedVisits: 0 });
    });

    it('lists my recent visits with the area', async () => {
      const visits = await http().get('/visits/mine?limit=10').set(as(0)).expect(200);
      expect(visits.body[0]).toMatchObject({ placeId: pa, placeName: 'Vaishali' });
      expect(visits.body[0]).toHaveProperty('area');
    });

    it('reads one place from the feed, and ranked places carry their area', async () => {
      const one = await http().get(`/feed?city=pune&placeId=${pa}`).set(as(0)).expect(200);
      expect(one.body).toHaveLength(1);
      expect(one.body[0]).toMatchObject({ placeId: pa, name: 'Vaishali' });
      await http().get('/feed?city=pune&placeId=not-a-uuid').set(as(0)).expect(400);

      await http()
        .post('/rankings/compare')
        .set(as(0))
        .send({ visitId: visitA, refPlaceId: pb, outcome: 'better' })
        .expect(200);
      const ranked = await http().get('/rankings/mine').set(as(0)).expect(200);
      expect(ranked.body[0]).toHaveProperty('area');
    });

    it('credits the photographer on photos', async () => {
      const photo = await http()
        .post('/photos/upload')
        .set(as(0))
        .field('visitId', visitA)
        .attach('file', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(photo.body.authorName).toBe('Sana');
      const list = await http().get(`/places/${pa}/photos`).set(as(1)).expect(200);
      expect(list.body[0].authorName).toBe('Sana');
      await http().delete(`/photos/${photo.body.id}`).set(as(0)).expect(204);
    });
  });
});
