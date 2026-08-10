# ContentKosh — Backend

Backend API for the ContentKosh application — Node.js + TypeScript, Express, Prisma (Postgres).

## Quick overview

- Implements authentication (JWT), user management, Prisma ORM, file upload support, and Swagger API docs.
- Main entrypoint: `src/index.ts`.

## Prerequisites

- Node.js 16+ (recommended 18+)
- PostgreSQL (12+)
- npm (or yarn/pnpm)

## Setup (local development)

1. Install dependencies:

```bash
cd contentkosh-backend
npm install
```

2. Configure environment:

- Copy an environment template or create `.env` in the `contentkosh-backend` folder. You can use `env.local` or `env.uat` as a starting point.
- At minimum set:

```
DATABASE_URL=<postgres-connection-string>
JWT_SECRET=<a-strong-secret>
NEXT_PUBLIC_API_URL=http://localhost:3000
```

3. Prepare database (Prisma):

```bash
# generate Prisma client
npm run db:generate

# apply migrations (development)
npm run db:migrate

# or, for a quick dev sync (no migrations):
npm run db:push

# seed initial data (optional)
npm run db:seed
```

4. Run development server:

```bash
npm run dev
```

By default the server runs on port `8080` (see `PORT` env var). Swagger UI is available at `http://localhost:8080/api-docs`.

## Useful scripts

- `npm run dev` — start dev server with `nodemon` (hot reload)
- `npm run build` — run tests then compile TypeScript (`tsc -p tsconfig.build.json`)
- `npm start` — run production bundle from `dist/`
- `npm run db:generate` — `prisma generate`
- `npm run db:migrate` — create/apply a migration (dev only — prompts, uses a shadow DB)
- `npm run db:migrate:deploy` — apply committed migrations to `public` (production-safe, no prompts)
- `npm run db:tenants:migrate` — apply any migrations a tenant schema doesn't have yet, for every active business
- `npm run db:tenants:baseline` — one-time-only: mark existing migrations as already applied for every tenant schema, without running them (see below)
- `npm run db:setup` — `db:generate` + `db:migrate:deploy` + `db:tenants:migrate` in one shot; the standard "bring this environment up to date" command
- `npm run db:push` — push schema to database (no migrations, dev only)
- `npm run db:studio` — open Prisma Studio
- `npm run db:reset-seed` — reset DB and run seed (dev only, destroys data)
- `npm test` — run Jest tests

## Environment variables

- `DATABASE_URL` — PostgreSQL connection string used by Prisma
- `PORT` — server port (default 8080)
- `JWT_SECRET` — secret used to sign JWT tokens
- `FRONTEND_URL` / `NEXT_PUBLIC_API_URL` — frontend base URL used for CORS / callbacks
- File-upload related variables are present in `.env` (allowed types, sizes, upload dir)

Check the `.env`, `.env.local`, or `.env.uat` files in the repo root to see concrete examples.

## API docs

- Swagger UI (interactive): `http://localhost:8080/api-docs`
- Raw OpenAPI JSON available at `http://localhost:8080/swagger.json` (used by the web client codegen)

## Database — Prisma notes

- Schema: `prisma/schema.prisma` — models and relations live here. It's the **only** place table structure is defined; there is no second hand-written copy anywhere.
- To generate the client: `npm run db:generate`
- To inspect data: `npm run db:studio`

### Multi-tenant schema architecture

Each business gets its own PostgreSQL schema (`tenant_<slug>`), created and kept up to date by replaying the real files under `prisma/migrations/` (see `src/services/tenantSchemaMigrator.ts`). A handful of tables are shared and live only in `public`, listed once in `src/config/tenant-schema.constants.ts`:

- `users`, `refresh_tokens`, `business`, `business_slug_history`, `system_config`, `api_audit_logs`

Everything else in `schema.prisma` (exams, courses, batches, content, tests, teachers, students, …) is tenant-scoped: it's created inside every tenant schema and nowhere else is it queried from. `prisma/migrations/` is committed to git — it is the single source of truth for both the public schema and every tenant schema's structure.

Each tenant schema tracks which migrations it has applied in its own `_tenant_migrations` table, similar to Prisma's own `_prisma_migrations`. That's what makes `npm run db:tenants:migrate` safe to run repeatedly: a migration a tenant already has is skipped, only new ones are applied.

### Making a schema change (adding/changing a column, table, etc.)

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate` — creates a new folder under `prisma/migrations/` with the generated SQL, applies it to your local `public` schema, regenerates the client. If you're adding a `NOT NULL` column to a table with existing rows, Prisma will ask for a default (or backfill logic can be added to the generated `migration.sql` before running it).
3. `npm run db:tenants:migrate` — applies that same new migration to your local tenant schemas so you can test the full flow (including tenant-scoped models) before pushing.
4. Commit the new `prisma/migrations/<timestamp>_<name>/` folder together with your code changes and open a PR — the migration folder is not gitignored.

### Deploying a schema change

Run once against the target environment, in order:

```bash
npm run db:generate        # regenerate the Prisma client to match schema.prisma
npm run db:migrate:deploy  # apply any new migrations to the public schema
npm run db:tenants:migrate # apply any new migrations to every active tenant schema
```

Or just `npm run db:setup`, which is exactly those three steps. Then restart the app process so it picks up the regenerated client and new code.

This is additive and non-destructive: `db:migrate:deploy` only ever applies migrations Prisma hasn't recorded yet for `public`, and `db:tenants:migrate` only ever applies migrations a given tenant schema hasn't recorded yet — existing data is never dropped or rewritten by this flow. New businesses that sign up after the deploy are provisioned straight from the full up-to-date migration history, so they never need a separate "which fields does this tenant have" check.

**Do not** run `prisma migrate dev` or `npm run db:push` against a shared/production database — both are dev-only tools (interactive prompts, shadow database, or schema drift with no migration record). Always use `db:migrate:deploy` there.

### One-time setup note: `db:tenants:baseline`

`npm run db:tenants:baseline` exists only for the one-time cutover to this bookkeeping system (marks every migration that existed at cutover time as already-applied for every existing tenant schema, without running any SQL, since those schemas were already up to date). It has already been run for this project's existing environments — you should not need to run it again unless you're bringing a brand-new environment's tenant schemas under tracking for the first time. Supports a `--dry-run` flag to preview what it would do first.

## Testing

- Unit/integration tests use Jest. Run `npm test` or `npm run test:watch` during development.

## Project layout (high level)

- `src/` — application source (controllers, services, repositories, middlewares, routes)
- `prisma/` — Prisma schema and seed scripts
- `scripts/` — small utilities (e.g. doc generation)

## Troubleshooting

- If Prisma fails to connect, verify `DATABASE_URL` and that Postgres is running and accessible.
- If swagger/codegen fails, start the backend first and visit `/swagger.json` to confirm it's reachable.

## Contributing

- Fork the repository and create a branch using the pattern `feature/your-feature` or `fix/issue-123`.
- Run tests and linters locally before opening a PR:

```bash
npm install
# run lint (if available)
npm run lint || true
npm test
```

- Commit message guidance: use present-tense, be descriptive, and reference issue numbers (example: `Fix: validate user input (#123)`).
- Open a Pull Request with a clear description, test instructions, and any relevant screenshots or API requests.
- Maintain code review etiquette: respond to review comments, update the branch, and squash/fixup commits if requested.

## Development

Local development checklist and common commands:

1. Ensure PostgreSQL is running and reachable.
2. Create or copy `.env` and set required variables (`DATABASE_URL`, `JWT_SECRET`, `PORT`, etc.).
3. Install dependencies:

```bash
npm install
```

4. Prepare the database:

```bash
npm run db:generate
npm run db:migrate
# optional: seed initial data
npm run db:seed
```

5. Start the dev server:

```bash
npm run dev
```

6. Common maintenance commands:

- `npm run db:studio` — open Prisma Studio to inspect data
- `npm run db:push` — push schema changes without generating migrations (dev only)
- `npm run db:reset-seed` — reset database and re-seed (dev only)

If you prefer separate files, I can create dedicated `CONTRIBUTING.md` and `DEVELOPMENT.md` files — let me know.