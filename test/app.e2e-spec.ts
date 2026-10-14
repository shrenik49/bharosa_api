import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/services/database.service';
import { TasteJobs } from '../src/modules/jobs/services/taste-jobs.service';
import { configureApp } from '../src/main';

/** Runs against the database in DATABASE_URL (migrated + seeded). Creates and removes its own users. */
describe('Bharosa API', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const stamp = Date.now();
  const emailA = `e2e-a-${stamp}@example.com`;
  const emailB = `e2e-b-${stamp}@example.com`;
  let tokenA = '';
  let refreshA = '';
  let tokenB = '';
  let pa = '';
  let pb = '';

  const http = () => request(app.getHttpServer());
  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });
  const userId = async (email: string) =>
    (await db.queryOne<{ id: string }>('select id from users where email = $1', [email]))!.id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    pa = (await db.queryOne<{ id: string }>(`select id from places where slug = 'vaishali'`))!.id;
    pb = (await db.queryOne<{ id: string }>(`select id from places where slug = 'roopali'`))!.id;
  });

  afterAll(async () => {
    await db.query('delete from users where email = any($1)', [[emailA, emailB]]);
    await db.query('select refresh_place_stats($1), refresh_place_stats($2)', [pa, pb]);
    await app.close();
  });

  describe('auth', () => {
    it('rejects protected routes without a token', async () => {
      await http().get('/profiles/me').expect(401);
    });

    it('signs up, creating profile, settings and the Want to try list', async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ name: 'Asha', email: emailA, password: 'password123' })
        .expect(201);
      tokenA = res.body.accessToken;
      refreshA = res.body.refreshToken;
      expect(res.body.user.displayName).toBe('Asha');
      const lists = await db.query('select kind from lists where user_id = $1', [res.body.user.id]);
      expect(lists.map(l => l.kind)).toEqual(['want']);
      const b = await http()
        .post('/auth/signup')
        .send({ name: 'Bhau', email: emailB, password: 'password123' })
        .expect(201);
      tokenB = b.body.accessToken;
    });

    it('rejects a duplicate email, weak password and wrong password', async () => {
      await http().post('/auth/signup').send({ name: 'X', email: emailA, password: 'password123' }).expect(409);
      await http().post('/auth/signup').send({ name: 'X', email: 'new@example.com', password: 'short' }).expect(400);
      await http().post('/auth/login').send({ email: emailA, password: 'wrong-password' }).expect(401);
      await http().post('/auth/login').send({ email: emailA, password: 'password123' }).expect(200);
    });

    it('rotates refresh tokens and revokes everything if an old one is reused', async () => {
      const first = await http().post('/auth/refresh').send({ refreshToken: refreshA }).expect(200);
      await http().post('/auth/refresh').send({ refreshToken: refreshA }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
    });

    it('returns the profile and refuses fields clients must not write', async () => {
      const me = await http().get('/profiles/me').set(authed(tokenA)).expect(200);
      expect(me.body.onboarded).toBe(false);
      await http().patch('/profiles/me').set(authed(tokenA)).send({ bio: 'hi', onboarded_at: 'now' }).expect(400);
      const upd = await http().patch('/profiles/me').set(authed(tokenA)).send({ bio: 'hi' }).expect(200);
      expect(upd.body.bio).toBe('hi');
    });
  });

  describe('reference data, places and the taste quiz', () => {
    it('serves tags publicly and places to signed-in users', async () => {
      const tags = await http().get('/tags?kinds=food,cuisine,format').expect(200);
      expect(tags.body.length).toBeGreaterThan(10);
      const places = await http().get('/places?city=pune').set(authed(tokenA)).expect(200);
      expect(places.body.length).toBe(15);
      const one = await http().get(`/places/${pa}`).set(authed(tokenA)).expect(200);
      expect(one.body.name).toBe('Vaishali');
    });

    it('saves the taste profile idempotently and marks onboarded', async () => {
      const tag = (await db.queryOne<{ id: number }>(`select id from tags where slug = 'misal-pav'`))!.id;
      const body = { tagIds: [tag], placeIds: [pa, pb] };
      await http().post('/onboarding/taste-profile').set(authed(tokenA)).send(body).expect(204);
      await http().post('/onboarding/taste-profile').set(authed(tokenA)).send(body).expect(204);
      const me = await http().get('/profiles/me').set(authed(tokenA)).expect(200);
      expect(me.body.onboarded).toBe(true);
      expect(me.body.cityId).not.toBeNull();
      const items = await db.queryOne<{ n: number }>(
        `select count(*)::int as n from list_items li join lists l on l.id = li.list_id
          where l.user_id = $1 and l.kind = 'favorites'`,
        [await userId(emailA)],
      );
      expect(items!.n).toBe(2);
    });
  });

  describe('visit verification and ranking', () => {
    let visitA = '';

    it('rejects a far check-in and accepts a near one', async () => {
      await http().post('/visits/checkin').set(authed(tokenA)).send({ placeId: pb, lat: 18.6, lng: 73.9 }).expect(422);
      const ok = await http()
        .post('/visits/checkin')
        .set(authed(tokenA))
        .send({ placeId: pa, lat: 18.5206, lng: 73.8412 })
        .expect(200);
      expect(ok.body.status).toBe('verified');
      visitA = ok.body.id;
    });

    it('verifies a bill once and rejects reuse, old bills', async () => {
      const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const body = { placeId: pb, fingerprint: `fp-${stamp}-aaaaaaaa`, billDate: today };
      const ok = await http().post('/visits/bill').set(authed(tokenA)).send(body).expect(201);
      expect(ok.body.status).toBe('verified');
      await http()
        .post('/visits/bill')
        .set(authed(tokenA))
        .send({ ...body, placeId: pa })
        .expect(409);
      await http()
        .post('/visits/bill')
        .set(authed(tokenA))
        .send({ ...body, fingerprint: 'another-fp-123', billDate: '2020-01-01' })
        .expect(422);
    });

    it('updates place stats via triggers', async () => {
      const s = await db.queryOne<{ verified_visits: number }>(
        'select verified_visits from place_stats where place_id = $1',
        [pa],
      );
      expect(s!.verified_visits).toBeGreaterThanOrEqual(1);
    });

    it('ranks by comparison and blocks comparing another users visit', async () => {
      const res = await http()
        .post('/rankings/compare')
        .set(authed(tokenA))
        .send({ visitId: visitA, refPlaceId: pb, outcome: 'better' })
        .expect(200);
      expect(res.body.score).toBe(100);
      const mine = await http().get('/rankings/mine').set(authed(tokenA)).expect(200);
      expect(mine.body.map((r: { name: string }) => r.name)).toEqual(['Vaishali', 'Roopali']);
      await http()
        .post('/rankings/compare')
        .set(authed(tokenB))
        .send({ visitId: visitA, refPlaceId: pb, outcome: 'better' })
        .expect(403);
    });
  });

  describe('feed and jobs', () => {
    it('returns all places and supports tag and circle filters', async () => {
      const all = await http().get('/feed?city=pune&filter=all').set(authed(tokenB)).expect(200);
      expect(all.body.length).toBe(15);
      const tagged = await http().get('/feed?city=pune&filter=maharashtrian').set(authed(tokenB)).expect(200);
      expect(tagged.body.length).toBeGreaterThan(0);
      const circle = await http().get('/feed?city=pune&filter=circle').set(authed(tokenB)).expect(200);
      expect(circle.body).toEqual([]);
    });

    it('shows a friend rating with a vouch once in the circle', async () => {
      const a = await userId(emailA);
      const b = await userId(emailB);
      await db.query(`update user_settings set rating_audience = 'circle' where user_id = $1`, [a]);
      await db.query('insert into circle_members(owner_id, member_id) values ($1, $2), ($2, $1)', [b, a]);
      const circle = await http().get('/feed?city=pune&filter=circle').set(authed(tokenB)).expect(200);
      const top = circle.body.find((p: { name: string }) => p.name === 'Vaishali');
      expect(top.vouchers).toBe(1);
      expect(top.voucherNames).toEqual(['Asha']);
      expect(top.match).toBeGreaterThan(50);
    });

    it('runs the nightly taste jobs without error', async () => {
      const a = await userId(emailA);
      const jobs = app.get(TasteJobs);
      await jobs.refreshUserAffinity(a);
      await jobs.refreshTasteSimilarity(a);
      const aff = await db.query('select 1 from user_tag_affinity where user_id = $1', [a]);
      expect(aff.length).toBeGreaterThan(0);
    });
  });

  it('health check', async () => {
    await http().get('/health').expect(200);
  });
});
