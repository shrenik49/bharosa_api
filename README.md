# Bharosa API

NestJS + PostgreSQL backend for Bharosa (restaurant and café discovery with personalised trust scores). Replaces the Supabase backend; the business rules that lived in SQL functions now live in TypeScript services.

## Quick start
```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and JWT_ACCESS_SECRET
npm run migrate           # applies db/migrations/*.sql (tracked in schema_migrations)
npm run seed              # Pune, areas, tags, badges, 15 places (idempotent)
npm run start:dev         # http://localhost:3000, docs at /docs
```
Any PostgreSQL 14+ works (needs the `pg_trgm` and `citext` extensions). Set `DATABASE_SSL=true` for hosted databases.

`npm run verify` runs type check, lint, build, unit tests and e2e tests. E2E tests use the database in `DATABASE_URL` and delete the users they create.

## Layout (TypeScript only: no JavaScript source, config files are .ts or .json)
```
db/
  migrations/            plain SQL schema, applied in order (tracked in schema_migrations)
  seeds/                 idempotent seed data
src/
  main.ts                bootstrap (shared HTTP setup in configureApp)
  app.module.ts          root module: config, throttling, global guard/filter/interceptor
  config/                env validation, swagger setup
  common/
    decorators/          @Public(), @CurrentUser()
    guards/              JwtAuthGuard (global)
    filters/             AllExceptionsFilter (one error shape)
    interceptors/        request logging
    middleware/          request id
    logger/              JSON logger for production
    interfaces/          shared types
    dto/                 pagination + error DTOs
    utils/               geo, time helpers
  database/
    services/            DatabaseService (pool, transactions)
    migrator/            migration runner
    cli/                 npm run migrate | seed
  modules/<feature>/     auth, account, profiles, settings, users, circle, reference, places, onboarding,
                         visits, rankings, feed, reviews, reactions, lists, photos, notifications,
                         reports, invites, badges, creators, mail, jobs, health
    <feature>.module.ts
    controllers/         HTTP only: routes, Swagger decorators, no logic
    services/            business rules and SQL (+ *.spec.ts unit tests next to them)
    dto/                 request validation + response shapes
test/                    e2e tests (auth, validation, visits, ranking, feed, security, rate limits)
```

## Endpoints (full list with schemas at `/docs`)
| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |
| Account | `POST /account/change-password`, `DELETE /account` (soft delete, password required) |
| Profile and settings | `GET/PATCH /profiles/me`, `GET/PATCH /settings` |
| People | `GET /users/search?q=`, `/users/:id` (trust record + badges), `/users/:id/ranks` (if their audience setting allows) |
| Circle | `GET /circle`, `/circle/added-me`, `/circle/twins`, `POST /circle`, `DELETE /circle/:memberId` |
| Reference | `GET /cities`, `/cities/:slug/areas`, `/tags?kinds=food,cuisine` (public) |
| Places | `GET /places`, `/places/:id`, `/places/:id/reviews`, `/places/:id/photos?sort=top|recent` |
| Taste quiz | `POST /onboarding/taste-profile` |
| Verification | `POST /visits/checkin` (within 100 m), `POST /visits/bill`, `GET /visits/mine` |
| Ranking and feed | `POST /rankings/compare`, `GET /rankings/mine`, `GET /feed?city=pune&filter=all|circle|<tag-slug>` |
| Reviews | `POST /reviews`, `GET /reviews/mine`, `PATCH/DELETE /reviews/:id` |
| Likes | `PUT/DELETE /reactions/{photo|review|list}/:id` |
| Lists | `GET /lists/mine`, `/lists/been-there`, `/lists/:id`, `POST /lists`, `PATCH/DELETE /lists/:id`, `PUT/DELETE /lists/:id/items/:placeId` |
| Photos | `POST /photos` (register after upload), `GET /photos/mine`, `DELETE /photos/:id` |
| Activity | `GET /notifications`, `/notifications/unread-count`, `POST /notifications/:id/read`, `/notifications/read-all` |
| Reports | `POST /reports`, `GET /reports/mine` |
| Invites | `POST /invites`, `GET /invites/mine`, `POST /invites/redeem` |
| Badges | `GET /badges` (awarded automatically after visits and rankings) |
| Creators | `GET /creators`, `/creators/:id`, `PUT /creators/me` |
| Health | `GET /health` |

## What moved from Supabase
| Before (Supabase) | Now |
| --- | --- |
| `auth.users`, Supabase Auth | `users` + bcrypt, JWT access tokens (15 min), rotating refresh tokens with reuse detection |
| `handle_new_user` trigger | `AuthService.signUp` (one transaction) |
| `verify_checkin`, `verify_bill` | `VisitsService` (haversine distance, IST bill-age rule) |
| `submit_comparison`, `rescore_user` | `RankingsService` (advisory lock per user) |
| `discover_feed` | `FeedService` (trust weights are constants at the top of the file) |
| `refresh_user_affinity`, `refresh_taste_similarity` | `TasteJobs`, nightly 02:00 IST (`ENABLE_JOBS`) |
| RLS policies | Authorization in code: every query is scoped to the token's user id; clients have no endpoint that sets `verified` or writes ranks |
| Triggers for stats, counters, "content only on verified visits" | Kept in the database (`0005_integrity.sql`) |
| Storage bucket | The API stores photo records only; files go to object storage (provider not chosen). Set `MEDIA_BASE_URL` to get full URLs back |

## Standards enforced centrally
Helmet, CORS allowlist (`CORS_ORIGINS`, empty by default), global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform), global rate limit (120/min; 10/min on credential endpoints), global JWT guard (opt out with `@Public()`), one error shape with a request id and no internals, JSON logs in production, DB and HTTP timeouts, graceful shutdown, pagination DTO, Swagger from DTOs.

New feature checklist: `modules/<name>/` with controllers/, services/, dto/ and a module file registered in `app.module.ts`, query ownership by `@CurrentUser()`, a unit spec for the rules, an e2e case for the endpoint.

## Known gaps
- **Photo files:** no upload endpoint or storage provider yet. The phone uploads to storage (to `{userId}/{name}.webp`), then calls `POST /photos`. Presigned URLs need the provider decision (S3, R2, Supabase Storage as plain storage, ...).
- **Moderation:** users can report, but upholding or dismissing reports (which hides content and counts a flag) needs an admin role and endpoints that do not exist yet. Creator verification (`verified_at`) and the `is_creator` flag are likewise set by us directly in the database.
- **Email:** no mail provider is wired. Password-reset codes are logged in development and dropped (with an error log) in production until `MailService` gets a provider. Email confirmation at signup is not built.
- **Push notifications:** the Activity feed exists; sending push messages (FCM) does not.
- UPI verification and on-device bill OCR are not built (same as before).
- Redeeming an invite records the use and notifies the inviter; it does not add either person to the other's circle (product decision pending).
- Nightly jobs run in-process; move to one worker before running several API instances.
- Feed: the viewer's own ranks count with the stranger weight (0.1), carried over from the SQL version.
- Seed place coordinates are approximate; verify before launch (check-in radius is 100 m).
- Test scripts need `--experimental-vm-modules` (Nest 12 packages are ESM); already in `npm test`.
