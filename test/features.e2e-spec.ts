import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/services/database.service';
import { configureApp } from '../src/main';

/** Social features: lists, circle, reviews, reactions, notifications, photos, reports, invites, badges, users, creators, account. */
describe('Feature endpoints', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const stamp = Date.now();
  const emails = [`f-a-${stamp}@example.com`, `f-b-${stamp}@example.com`];
  const password = 'password123';
  const tokens: string[] = [];
  const ids: string[] = [];
  let pa = '';
  let pb = '';
  let visitA = '';

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
        .send({ name: i === 0 ? 'Asha' : 'Bhau', email, password })
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
    await db.query('delete from users where email = any($1)', [emails]);
    await db.query('select refresh_place_stats($1), refresh_place_stats($2)', [pa, pb]);
    await app.close();
  });

  describe('settings', () => {
    it('reads and updates settings, rejecting bad values', async () => {
      const before = await http().get('/settings').set(as(0)).expect(200);
      expect(before.body.ratingAudience).toBe('circle');
      const after = await http()
        .patch('/settings')
        .set(as(0))
        .send({ ratingAudience: 'everyone', pushActivity: true })
        .expect(200);
      expect(after.body).toMatchObject({ ratingAudience: 'everyone', pushActivity: true });
      await http().patch('/settings').set(as(0)).send({ ratingAudience: 'nobody' }).expect(400);
    });
  });

  describe('lists', () => {
    let listId = '';

    it('has a protected Want to try list and supports custom lists with items', async () => {
      const mine = await http().get('/lists/mine').set(as(0)).expect(200);
      const want = mine.body.find((l: { kind: string }) => l.kind === 'want');
      expect(want).toBeDefined();
      await http().delete(`/lists/${want.id}`).set(as(0)).expect(403);

      const created = await http().post('/lists').set(as(0)).send({ name: 'Rainy day' }).expect(201);
      listId = created.body.id;
      await http().put(`/lists/${listId}/items/${pa}`).set(as(0)).send({ note: 'misal' }).expect(204);
      await http().put(`/lists/${listId}/items/${pa}`).set(as(0)).send({ note: 'misal!' }).expect(204);
      const detail = await http().get(`/lists/${listId}`).set(as(0)).expect(200);
      expect(detail.body.items).toHaveLength(1);
      expect(detail.body.items[0].note).toBe('misal!');
    });

    it('hides private lists from others until made public', async () => {
      await http().get(`/lists/${listId}`).set(as(1)).expect(404);
      await http().patch(`/lists/${listId}`).set(as(0)).send({ isPublic: true }).expect(200);
      await http().get(`/lists/${listId}`).set(as(1)).expect(200);
      await http().patch(`/lists/${listId}`).set(as(1)).send({ name: 'hijack' }).expect(404);
      await http().put(`/lists/${listId}/items/${pb}`).set(as(1)).send({}).expect(404);
    });

    it('shows verified places in Been there', async () => {
      const res = await http().get('/lists/been-there').set(as(0)).expect(200);
      expect(res.body.map((p: { placeId: string }) => p.placeId)).toContain(pa);
    });

    it('deletes a custom list', async () => {
      await http().delete(`/lists/${listId}`).set(as(0)).expect(204);
      await http().get(`/lists/${listId}`).set(as(0)).expect(404);
    });
  });

  describe('circle, users and notifications', () => {
    it('finds people, adds to the circle once, and notifies them', async () => {
      const found = await http().get('/users/search?q=bha').set(as(0)).expect(200);
      expect(found.body.map((u: { id: string }) => u.id)).toContain(ids[1]);
      await http().post('/circle').set(as(0)).send({ memberId: ids[0] }).expect(400);
      await http().post('/circle').set(as(0)).send({ memberId: ids[1] }).expect(204);
      await http().post('/circle').set(as(0)).send({ memberId: ids[1], relation: 'friend' }).expect(204);

      const circle = await http().get('/circle').set(as(0)).expect(200);
      expect(circle.body).toHaveLength(1);
      const addedMe = await http().get('/circle/added-me').set(as(1)).expect(200);
      expect(addedMe.body[0].userId).toBe(ids[0]);

      const notes = await http().get('/notifications').set(as(1)).expect(200);
      expect(notes.body.filter((n: { type: string }) => n.type === 'added_to_circle')).toHaveLength(1);
    });

    it('counts and marks notifications read', async () => {
      const count = await http().get('/notifications/unread-count').set(as(1)).expect(200);
      expect(count.body.count).toBeGreaterThanOrEqual(1);
      const list = await http().get('/notifications?unreadOnly=true').set(as(1)).expect(200);
      await http().post(`/notifications/${list.body[0].id}/read`).set(as(1)).expect(204);
      await http().post(`/notifications/${list.body[0].id}/read`).set(as(0)).expect(404);
      await http().post('/notifications/read-all').set(as(1)).expect(204);
      const after = await http().get('/notifications/unread-count').set(as(1)).expect(200);
      expect(after.body.count).toBe(0);
    });

    it('shows a public profile with relation, and respects rating privacy', async () => {
      const profile = await http().get(`/users/${ids[1]}`).set(as(0)).expect(200);
      expect(profile.body).toMatchObject({ displayName: 'Bhau', relation: 'friend' });
      expect(profile.body).not.toHaveProperty('email');
      await http().patch('/settings').set(as(1)).send({ ratingAudience: 'me' }).expect(200);
      await http().get(`/users/${ids[1]}/ranks`).set(as(0)).expect(403);
      await http().get(`/users/${ids[0]}/ranks`).set(as(1)).expect(200);
      await http().get('/users/00000000-0000-0000-0000-000000000000').set(as(0)).expect(404);
    });

    it('removes someone from the circle', async () => {
      await http().delete(`/circle/${ids[1]}`).set(as(0)).expect(204);
      const circle = await http().get('/circle').set(as(0)).expect(200);
      expect(circle.body).toEqual([]);
    });
  });

  describe('reviews, reactions and photos', () => {
    let reviewId = '';
    let photoId = '';

    it('writes one review per verified visit and lists it for the place', async () => {
      const review = await http()
        .post('/reviews')
        .set(as(0))
        .send({ visitId: visitA, body: 'Crisp dosa.' })
        .expect(201);
      reviewId = review.body.id;
      await http().post('/reviews').set(as(0)).send({ visitId: visitA, body: 'Again' }).expect(409);
      await http().post('/reviews').set(as(1)).send({ visitId: visitA, body: 'Not mine' }).expect(403);
      const listed = await http().get(`/places/${pa}/reviews`).set(as(0)).expect(200);
      expect(listed.body[0]).toMatchObject({ body: 'Crisp dosa.', authorName: 'Asha' });
      const stats = await db.queryOne<{ review_count: number }>(
        'select review_count from place_stats where place_id = $1',
        [pa],
      );
      expect(stats!.review_count).toBeGreaterThanOrEqual(1);
    });

    it('applies the author audience setting to who can read the review', async () => {
      await http().patch('/settings').set(as(0)).send({ ratingAudience: 'me' }).expect(200);
      const hidden = await http().get(`/places/${pa}/reviews`).set(as(1)).expect(200);
      expect(hidden.body).toEqual([]);
      await http().patch('/settings').set(as(0)).send({ ratingAudience: 'everyone' }).expect(200);
      const visible = await http().get(`/places/${pa}/reviews`).set(as(1)).expect(200);
      expect(visible.body).toHaveLength(1);
    });

    it('likes a review idempotently, updates the count and notifies the author', async () => {
      await http().put(`/reactions/review/${reviewId}`).set(as(1)).expect(204);
      await http().put(`/reactions/review/${reviewId}`).set(as(1)).expect(204);
      const listed = await http().get(`/places/${pa}/reviews`).set(as(1)).expect(200);
      expect(listed.body[0]).toMatchObject({ likeCount: 1, likedByMe: true });
      const notes = await http().get('/notifications').set(as(0)).expect(200);
      expect(notes.body.some((n: { type: string }) => n.type === 'review_liked')).toBe(true);
      await http().delete(`/reactions/review/${reviewId}`).set(as(1)).expect(204);
      await http()
        .put('/reactions/banana/' + reviewId)
        .set(as(1))
        .expect(400);
      await http().put('/reactions/review/00000000-0000-0000-0000-000000000000').set(as(1)).expect(404);
    });

    it('edits and deletes only my own review', async () => {
      await http().patch(`/reviews/${reviewId}`).set(as(1)).send({ body: 'x' }).expect(404);
      const edited = await http()
        .patch(`/reviews/${reviewId}`)
        .set(as(0))
        .send({ body: 'Crisp dosa, great sambar.' })
        .expect(200);
      expect(edited.body.body).toContain('sambar');
      await http().delete(`/reviews/${reviewId}`).set(as(1)).expect(404);
      await http().delete(`/reviews/${reviewId}`).set(as(0)).expect(204);
    });

    it('registers photos under my own folder only, max 3 per visit', async () => {
      const path = (n: string) => `${ids[0]}/${n}.webp`;
      await http()
        .post('/photos')
        .set(as(0))
        .send({ visitId: visitA, storagePath: `${ids[1]}/x.webp` })
        .expect(400);
      await http().post('/photos').set(as(0)).send({ visitId: visitA, storagePath: '../etc/passwd' }).expect(400);
      await http()
        .post('/photos')
        .set(as(1))
        .send({ visitId: visitA, storagePath: `${ids[1]}/x.webp` })
        .expect(403);

      const first = await http()
        .post('/photos')
        .set(as(0))
        .send({ visitId: visitA, storagePath: path('p1'), width: 1080, height: 720, bytes: 200000 })
        .expect(201);
      photoId = first.body.id;
      expect(first.body.url).toBeNull();
      await http()
        .post('/photos')
        .set(as(0))
        .send({ visitId: visitA, storagePath: path('p2') })
        .expect(201);
      await http()
        .post('/photos')
        .set(as(0))
        .send({ visitId: visitA, storagePath: path('p3') })
        .expect(201);
      await http()
        .post('/photos')
        .set(as(0))
        .send({ visitId: visitA, storagePath: path('p4') })
        .expect(422);

      const forPlace = await http().get(`/places/${pa}/photos?sort=recent`).set(as(1)).expect(200);
      expect(forPlace.body).toHaveLength(3);
      await http().put(`/reactions/photo/${photoId}`).set(as(1)).expect(204);
      const top = await http().get(`/places/${pa}/photos`).set(as(1)).expect(200);
      expect(top.body[0].id).toBe(photoId);
      expect(top.body[0].likedByMe).toBe(true);
    });

    it('deletes only my own photo', async () => {
      await http().delete(`/photos/${photoId}`).set(as(1)).expect(404);
      await http().delete(`/photos/${photoId}`).set(as(0)).expect(204);
      const mine = await http().get('/photos/mine').set(as(0)).expect(200);
      expect(mine.body).toHaveLength(2);
    });
  });

  describe('reports and invites', () => {
    it('reports other content once and never your own', async () => {
      const mine = await http().get('/photos/mine').set(as(0)).expect(200);
      const photo = mine.body[0].id;
      await http()
        .post('/reports')
        .set(as(0))
        .send({ subjectType: 'photo', subjectId: photo, reason: 'fake' })
        .expect(400);
      await http()
        .post('/reports')
        .set(as(1))
        .send({ subjectType: 'photo', subjectId: photo, reason: 'fake', details: 'stock image' })
        .expect(201);
      await http()
        .post('/reports')
        .set(as(1))
        .send({ subjectType: 'photo', subjectId: photo, reason: 'fake' })
        .expect(409);
      await http()
        .post('/reports')
        .set(as(1))
        .send({ subjectType: 'place', subjectId: '00000000-0000-0000-0000-000000000000', reason: 'other' })
        .expect(404);
      await http()
        .post('/reports')
        .set(as(1))
        .send({ subjectType: 'user', subjectId: ids[1], reason: 'abuse' })
        .expect(400);
      const list = await http().get('/reports/mine').set(as(1)).expect(200);
      expect(list.body[0].status).toBe('open');
    });

    it('creates invites, redeems them once, and notifies the inviter', async () => {
      const invite = await http().post('/invites').set(as(0)).send({ maxUses: 1 }).expect(201);
      expect(invite.body.code).toMatch(/^[A-Z2-9]{8}$/);
      await http().post('/invites/redeem').set(as(0)).send({ code: invite.body.code }).expect(400);
      await http().post('/invites/redeem').set(as(1)).send({ code: invite.body.code.toLowerCase() }).expect(204);
      await http().post('/invites/redeem').set(as(1)).send({ code: invite.body.code }).expect(422);
      await http().post('/invites/redeem').set(as(1)).send({ code: 'ZZZZZZZZ' }).expect(404);
      const mine = await http().get('/invites/mine').set(as(0)).expect(200);
      expect(mine.body[0].uses).toBe(1);
      const notes = await http().get('/notifications').set(as(0)).expect(200);
      expect(notes.body.some((n: { type: string }) => n.type === 'invite_redeemed')).toBe(true);
    });
  });

  describe('badges and creators', () => {
    it('awards the early badge after a first comparison and lists the catalog', async () => {
      await http()
        .post('/rankings/compare')
        .set(as(0))
        .send({ visitId: visitA, refPlaceId: pb, outcome: 'better' })
        .expect(200);
      // Badge evaluation runs in the background after the response.
      let earned = false;
      for (let i = 0; i < 20 && !earned; i++) {
        const catalog = await http().get('/badges').set(as(0)).expect(200);
        earned = catalog.body.some(
          (b: { code: string; awardedAt: string | null }) => b.code === 'early' && b.awardedAt,
        );
        if (!earned) await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(earned).toBe(true);
      const profile = await http().get(`/users/${ids[0]}`).set(as(1)).expect(200);
      expect(profile.body.badges.map((b: { code: string }) => b.code)).toContain('early');
    });

    it('keeps my creator page editable and the creator flag out of reach', async () => {
      const page = await http()
        .put('/creators/me')
        .set(as(0))
        .send({
          tagline: 'Street food hunter',
          links: { instagram: 'https://example.com/asha' },
          disclosurePolicy: 'I pay for everything.',
        })
        .expect(200);
      expect(page.body).toMatchObject({ tagline: 'Street food hunter', verifiedAt: null });
      await http().put('/creators/me').set(as(0)).send({ verifiedAt: 'now' }).expect(400);
      const listed = await http().get('/creators').set(as(1)).expect(200);
      expect(listed.body.map((c: { userId: string }) => c.userId)).not.toContain(ids[0]); // is_creator is set by us
      await db.query('update profiles set is_creator = true where id = $1', [ids[0]]);
      const after = await http().get('/creators').set(as(1)).expect(200);
      expect(after.body.map((c: { userId: string }) => c.userId)).toContain(ids[0]);
      await http().get(`/creators/${ids[0]}`).set(as(1)).expect(200);
    });
  });

  describe('account and password reset', () => {
    it('resets a forgotten password with a one-time code and signs out old sessions', async () => {
      const email = `f-c-${stamp}@example.com`;
      const signup = await http().post('/auth/signup').send({ name: 'Chitra', email, password }).expect(201);
      emails.push(email);
      await http()
        .post('/auth/forgot-password')
        .send({ email: `nobody-${stamp}@example.com` })
        .expect(204);
      await http().post('/auth/forgot-password').send({ email }).expect(204);

      // The email is only logged in development, so create a known token the way the service would.
      const { createHash } = await import('crypto');
      const token = 'known-reset-token-for-tests';
      await db.query(
        `insert into password_reset_tokens(user_id, token_hash, expires_at)
         values ($1, $2, now() + interval '1 hour')`,
        [signup.body.user.id, createHash('sha256').update(token).digest('hex')],
      );
      await http()
        .post('/auth/reset-password')
        .send({ token: 'wrong-token', newPassword: 'newpassword456' })
        .expect(400);
      await http().post('/auth/reset-password').send({ token, newPassword: 'newpassword456' }).expect(204);
      await http().post('/auth/reset-password').send({ token, newPassword: 'anotherpass789' }).expect(400);

      await http().post('/auth/refresh').send({ refreshToken: signup.body.refreshToken }).expect(401);
      await http().post('/auth/login').send({ email, password }).expect(401);
      await http().post('/auth/login').send({ email, password: 'newpassword456' }).expect(200);
    });

    it('changes the password after confirming the current one', async () => {
      await http()
        .post('/account/change-password')
        .set(as(1))
        .send({ currentPassword: 'wrong-one', newPassword: 'brandnew123' })
        .expect(401);
      await http()
        .post('/account/change-password')
        .set(as(1))
        .send({ currentPassword: password, newPassword: 'brandnew123' })
        .expect(204);
      await http().post('/auth/login').send({ email: emails[1], password }).expect(401);
      await http().post('/auth/login').send({ email: emails[1], password: 'brandnew123' }).expect(200);
    });

    it('deletes an account after confirming the password, and it can no longer sign in or be found', async () => {
      const email = `f-d-${stamp}@example.com`;
      const signup = await http().post('/auth/signup').send({ name: 'Dev', email, password }).expect(201);
      emails.push(email);
      await http()
        .delete('/account')
        .set({ Authorization: `Bearer ${signup.body.accessToken}` })
        .send({ password: 'wrong' })
        .expect(401);
      await http()
        .delete('/account')
        .set({ Authorization: `Bearer ${signup.body.accessToken}` })
        .send({ password })
        .expect(204);
      await http().post('/auth/login').send({ email, password }).expect(401);
      await http().get(`/users/${signup.body.user.id}`).set(as(0)).expect(404);
    });
  });
});
