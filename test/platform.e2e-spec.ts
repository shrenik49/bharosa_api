import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/config/swagger.config';
import { DatabaseService } from '../src/database/services/database.service';
import { configureApp } from '../src/main';

/** Cross-cutting behaviour every endpoint inherits: errors, headers, validation, CORS, docs. */
describe('Platform standards', () => {
  let app: INestApplication;
  // Every account this suite signs up is removed in afterAll, so repeated runs leave the database clean.
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await app.get(DatabaseService).query('delete from users where email = any($1)', [createdEmails]);
    }
    await app.close();
  });

  it('returns one consistent error shape with a request id and no internals', async () => {
    const res = await request(app.getHttpServer()).get('/profiles/me').expect(401);
    expect(Object.keys(res.body).sort()).toEqual(['error', 'message', 'path', 'requestId', 'statusCode', 'timestamp']);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\.ts|select |password_hash/i);
  });

  it('lists every validation problem and rejects unknown fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '', email: 'nope', password: 'short', isAdmin: true })
      .expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.join(' ')).toMatch(/isAdmin should not exist/);
  });

  it('rejects malformed ids and out-of-range pagination', async () => {
    const email = `plat-${Date.now()}@example.com`;
    createdEmails.push(email);
    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Plat', email, password: 'password123' })
      .expect(201);
    const auth = { Authorization: `Bearer ${signup.body.accessToken}` };
    await request(app.getHttpServer()).get('/places/not-a-uuid').set(auth).expect(400);
    await request(app.getHttpServer()).get('/feed?limit=500').set(auth).expect(400);
    await request(app.getHttpServer()).get('/feed?offset=-1').set(auth).expect(400);
  });

  it('sets security headers and no CORS headers for unknown origins', async () => {
    const res = await request(app.getHttpServer()).get('/health').set('Origin', 'https://evil.example').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rate limits credential endpoints', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'a@b.co', password: 'x' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  }, 60_000);

  it('publishes Swagger docs covering the endpoints', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/feed', '/visits/checkin', '/rankings/compare']),
    );
  });
});
