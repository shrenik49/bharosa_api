# Bharosa API

NestJS + PostgreSQL backend for Bharosa (restaurant and café discovery for India, launching in Pune; personalised trust scores, only verified visits can rate). It replaces the Supabase backend. The mobile app lives in a separate repo (`bharosa_app`, React Native). Setup, endpoints and known gaps: [README.md](README.md).

## Git workflow (same as the app repo, minus `main`: only two long-lived branches)
Remote: `https://github.com/shrenik49/bharosa_api.git`.
- `production`: what ships. Updated only by a pull request from `develop`.
- `develop`: integration branch. Every feature merges here through a pull request.
- `feature/<name>` (also `fix/<name>`, `docs/<name>`): one branch per feature, created from `develop`, merged back into `develop` by pull request.
- Never commit directly to `develop` or `production`, and never force-push them.
- Commit and push only when asked. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `gh` is not installed, so pull requests are opened on GitHub (compare `develop...feature/<name>`).
- A feature branch updates its docs (README endpoint table / known gaps, and this file if a decision, command or gotcha changes) in the same change.

## Decisions (do not revisit without asking)
- TypeScript only: no JavaScript source or config files (`eslint.config.ts`, not `.mjs`). No `any`.
- NestJS 12 (ESM-only packages, compiled to CommonJS; tests need `--experimental-vm-modules`, already in the npm scripts).
- PostgreSQL via `pg` with hand-written, parameterised SQL (no ORM). Any Postgres 14+ with `pg_trgm` and `citext`.
- Schema changes are new numbered files in `db/migrations`; never edit an applied migration. Seeds in `db/seeds` must be idempotent.
- Business rules live in services, not in the database. The database keeps only integrity guarantees (stats, like counters, "content only on a verified visit", max 3 photos).
- Auth is our own: bcrypt, 15-minute JWT access tokens, rotating hashed refresh tokens with reuse detection.
- Clients can never mark a visit verified or write ranks: only `VisitsService` and `RankingsService` do, after checking proof. Do not add an endpoint that weakens this.

## Layout
`src/modules/<feature>/{<feature>.module.ts, controllers/, services/, dto/}` with unit specs next to the service they test. Shared code in `src/common` (decorators, guards, filters, interceptors, middleware, logger, interfaces, dto, utils), config in `src/config`, DB access in `src/database`, e2e tests in `test/`. Full tree in the README.

## Standards (applied centrally; new modules inherit them)
- Controllers only route and document (Swagger); services hold the logic and SQL; request/response shapes are classes in `dto/` (validated with class-validator).
- Every route needs a JWT unless marked `@Public()`. Take the user from `@CurrentUser()`, never from the body. Scope every query to that user.
- Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform), Helmet, CORS allowlist (`CORS_ORIGINS`, empty by default), rate limits (120/min, 10/min on credential routes), one error shape with a request id, no stack traces or SQL in responses.
- Lists are paginated (`PaginationQueryDto`, max 50). DB statement timeout 10 s, HTTP timeout 30 s, graceful shutdown on.
- Secrets only in `.env` (git-ignored); `.env.example` has no real values. Config is validated at startup (`src/config/env.config.ts`).
- New feature checklist: module with controllers/services/dto, registered in `app.module.ts`; unit spec for the rules; e2e case for the endpoint, including auth and validation failures; update the README.

## Commands (Windows)
- `npm run migrate` / `npm run seed`: apply migrations / seed data to `DATABASE_URL`
- `npm run start:dev`: run with reload; docs at `http://localhost:3000/docs`
- `npm run verify`: type check, lint, build, unit tests, e2e tests. Run before finishing a change.
- `npm run format`: prettier
- E2E tests use the database in `DATABASE_URL` and delete the users they create. Use a throwaway database, not production.

## Gotchas
- This machine has no Docker or psql. For tests, an embedded Postgres works (`embedded-postgres` npm package in a scratch folder, port 54329); stop it afterwards.
- `nest build` compiles only `src`; `tsc --noEmit` (npm run typecheck) also checks `test/` and `eslint.config.ts`.
- Dates for visits use India time (Asia/Kolkata); one visit per user per place per day.
- Badge awarding runs in the background after a visit or ranking; it never fails the request.
- Password-reset emails are only logged in development; no mail provider is wired yet.
- Photo files are not handled here: the app uploads to object storage (provider not chosen), then calls `POST /photos`.

## Status
- Done: schema (29 tables + reset tokens), all endpoints in the README, 30 unit + 43 e2e tests passing.
- Not done: photo storage provider, mail provider, moderation/admin role, push notifications, UPI verification. See "Known gaps" in the README.
- Next: create the GitHub repo and push `develop` and `production`; choose a hosted Postgres; switch the app's `src/api` layer from Supabase to this API (separate change in the app repo).
