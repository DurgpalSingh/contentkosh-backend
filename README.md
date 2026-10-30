# ContentKosh — Backend

Backend API for the ContentKosh application — Node.js + TypeScript, Express, Prisma (Postgres).

- Authentication (JWT + refresh tokens), user management, multi-tenant Postgres schemas, file uploads, and Swagger API docs.
- Transactional email over SMTP (nodemailer).
- Main entrypoint: `src/index.ts`.

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [SMTP setup (email sending)](#smtp-setup-email-sending)
5. [Useful scripts](#useful-scripts)
6. [API docs](#api-docs)
7. [Database — Prisma notes](#database--prisma-notes)
8. [Testing](#testing)
9. [Project layout](#project-layout)
10. [Troubleshooting](#troubleshooting)
11. [Contributing](#contributing)

## Prerequisites

- Node.js 18+ (16 may work, 18+ recommended)
- PostgreSQL 12+
- npm (or yarn/pnpm)
- An SMTP mailbox for sending email (only needed if you want emails to be sent — see [SMTP setup](#smtp-setup-email-sending))

## Quick start

```bash
# 1. Install dependencies
cd contentkosh-backend
npm install

# 2. Create your env file (then edit it — see "Environment variables")
cp .env.local .env

# 3. Prepare the database
npm run db:generate
npm run db:migrate        # or `npm run db:push` for a quick dev sync (no migrations)
npm run db:seed           # optional: seed initial data

# 4. Optional: create the platform Super Admin
#    (password is passed as a CLI arg, never stored in .env)
npx tsx prisma/seed-superadmin.ts "MyPlainPassword123"

# 5. Start the dev server
npm run dev
```

The server runs on port `8080` by default (see `PORT`). Swagger UI: `http://localhost:8080/api-docs`.

## Environment variables

Create a `.env` file in `contentkosh-backend/`. Use `.env.local` (local dev) or `.env.uat` (UAT) as a starting point. `.env` is git-ignored — never commit real secrets.

### Core (required)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma, e.g. `postgresql://postgres:postgres@localhost:5432/contentkosh?schema=public` |
| `JWT_SECRET` | Long random secret used to sign JWTs. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | Frontend base URL, used for CORS and callbacks (e.g. `http://localhost:3000`) |

### Server, auth and cookies (optional)

| Variable | Description |
| --- | --- |
| `PORT` | Server port (default `8080`) |
| `NODE_ENV` | `development` / `production` |
| `LOG_LEVEL` | Winston log level |
| `ACCESS_TOKEN_EXPIRES_IN`, `JWT_EXPIRES_IN` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_SECRET` | Refresh token lifetime / signing secret |
| `ACCESS_COOKIE_NAME`, `REFRESH_COOKIE_NAME` | Cookie names |
| `ACCESS_COOKIE_MAX_AGE_MS`, `REFRESH_COOKIE_MAX_AGE_MS` | Cookie lifetimes in milliseconds |
| `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Cookie scope/security. Cross-site setups (e.g. UAT) need `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` |
| `WORKSPACE_EXPIRY_TIME` | Workspace expiry setting |
| `AUDIT_RETENTION_DAYS`, `AUDIT_CLEANUP_SCHEDULE` | API audit-log retention and cleanup cron schedule |

### File uploads (optional)

| Variable | Description |
| --- | --- |
| `UPLOAD_DIR` | Upload directory (e.g. `uploads/content`) |
| `ALLOWED_FILE_TYPES` | Comma-separated extensions, e.g. `pdf,jpg,jpeg,png,doc,docx` |
| `MAX_PDF_SIZE_MB`, `MAX_IMAGE_SIZE_MB`, `MAX_DOC_SIZE_MB` | Per-type size limits |
| `BULK_UPLOAD_ALLOWED_MIME_TYPES`, `BULK_UPLOAD_MAX_SIZE_MB` | Bulk-upload limits |

### Email — SMTP

Needed for sending emails (e.g. the new-business-signup notification and business status emails). Emails are sent over SMTP with [nodemailer](https://nodemailer.com/). Without these values, email sending fails with `SMTP is not configured`. Setup steps are in [SMTP setup](#smtp-setup-email-sending).

| Variable | Description |
| --- | --- |
| `SMTP_HOST` | SMTP server host, e.g. `smtp.hostinger.com` |
| `SMTP_PORT` | SMTP port. Defaults to `465` |
| `SMTP_SECURE` | `true` for implicit TLS (port 465), `false` for STARTTLS (port 587). Defaults to `true` |
| `SMTP_USER` | Mailbox used to log in to the SMTP server |
| `SMTP_PASSWORD` | **Path to a JSON secrets file outside the project** that holds the mailbox password — not the password itself ([details](#keeping-the-smtp-password-out-of-env)) |
| `MAIL_FROM_NAME` | Display name on outgoing mail. Defaults to `ContentKosh` |
| `MAIL_FROM_EMAIL` | Address emails are sent **from**. Defaults to `SMTP_USER`. Most providers require it to match the mailbox in `SMTP_USER` |
| `BUSINESS_SIGNUP_NOTIFICATION_EMAIL` | Inbox that receives a notification when a new business signs up. Optional — defaults to `info@contentkosh.in` |

Final result in `.env`:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=/etc/contentkosh/secrets.json
MAIL_FROM_NAME=ContentKosh
MAIL_FROM_EMAIL=noreply@yourdomain.com
BUSINESS_SIGNUP_NOTIFICATION_EMAIL=admin@yourdomain.com
```

## SMTP setup (email sending)

The backend sends email through any SMTP server (the project uses Hostinger). You set this up **once per environment**.

**Step 1: Create the sender mailbox**
1. In your mail provider (e.g. Hostinger hPanel → Emails), create a dedicated mailbox such as `noreply@yourdomain.com`. All emails are sent from it.
2. Note the SMTP host, port and whether it uses SSL/TLS. For Hostinger: `smtp.hostinger.com`, port `465`, SSL.

**Step 2: Create the secrets file (outside the project)**
1. Create a JSON file in a folder that is **not** inside the repository, for example `C:\secrets\contentkosh.json` on Windows or `/etc/contentkosh/secrets.json` on a server.
2. Put the mailbox password in it:

   ```json
   { "SMTP_PASSWORD": "your-mailbox-password" }
   ```
3. Restrict access so only the app's user can read it (on Linux: `chmod 600 /etc/contentkosh/secrets.json`).

**Step 3: Fill in `.env`**
1. Set the values from the table above. `SMTP_PASSWORD` must be the **full path** to the secrets file from Step 2.
2. Set `BUSINESS_SIGNUP_NOTIFICATION_EMAIL` to the inbox that should be notified of new signups.

**Step 4: Verify the setup**
1. Restart the server:

   ```bash
   npm run dev
   ```
2. Sign up a test business.
3. Check the inbox of `BUSINESS_SIGNUP_NOTIFICATION_EMAIL`. A new-signup email should arrive.
4. If it does not, check the server logs and the [Troubleshooting](#troubleshooting) table.

### Keeping the SMTP password out of `.env`

`SMTP_PASSWORD` holds a file path, never the password. At startup the backend reads that JSON file and takes its `SMTP_PASSWORD` value. This keeps the real password out of `.env`, out of git and out of screenshots of your config.

- The file must contain valid JSON with a non-empty string `SMTP_PASSWORD`.
- If the file is missing, unreadable or invalid, the server fails at startup with a clear error naming the path.
- Use a separate secrets file (and mailbox password) per environment (local, UAT, production).

### Security notes

- Keep `.env` private and never commit it. Keep the secrets file outside the repository.
- Restrict file permissions on the secrets file.
- SMTP providers limit how many emails you can send per hour/day. This is fine for notifications, not for bulk mail.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start dev server with `nodemon` (hot reload) |
| `npm run build` | Run tests, then compile TypeScript (`tsc -p tsconfig.build.json`) |
| `npm start` | Run production bundle from `dist/` |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Jest tests |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | Create/apply a migration (dev only — prompts, uses a shadow DB) |
| `npm run db:migrate:deploy` | Apply committed migrations to `public` (production-safe, no prompts) |
| `npm run db:tenants:migrate` | Apply any migrations a tenant schema doesn't have yet, for every active business |
| `npm run db:tenants:baseline` | One-time only: mark existing migrations as applied for every tenant schema without running them ([details](#one-time-setup-note-dbtenantsbaseline)) |
| `npm run db:setup` | `db:generate` + `db:migrate:deploy` + `db:tenants:migrate` — the standard "bring this environment up to date" command |
| `npm run db:push` | Push schema to the database without migrations (dev only) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset-seed` | Reset DB and run seeds (dev only, **destroys data**) |
| `npm run db:seed:superadmin` / `npx tsx prisma/seed-superadmin.ts "<password>"` | Create the platform Super Admin. Email comes from `SUPERADMIN_EMAIL` (defaults to `info@contentkosh.com`); the password is a CLI arg so it's never stored in `.env` |
| `npm run export-swagger` | Export API docs |

## API docs

- Swagger UI (interactive): `http://localhost:8080/api-docs`
- Raw OpenAPI JSON: `http://localhost:8080/swagger.json` (used by the web client codegen)

## Database — Prisma notes

- Schema: `prisma/schema.prisma` — models and relations live here. It's the **only** place table structure is defined; there is no second hand-written copy anywhere.
- Generate the client: `npm run db:generate`
- Inspect data: `npm run db:studio`

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

Unit/integration tests use Jest. Run `npm test` (or `npm run test:watch` during development).

## Project layout

- `src/` — application source (controllers, services, repositories, middlewares, routes)
- `prisma/` — Prisma schema, migrations and seed scripts
- `uploads/` — uploaded files (only `uploads/assets` is public)
- `postman/` — Postman collections

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Prisma can't connect | Verify `DATABASE_URL` and that Postgres is running and reachable |
| Swagger/codegen fails | Start the backend first and open `/swagger.json` to confirm it's reachable |
| `SMTP is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD` | One of `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` is empty — see [SMTP setup](#smtp-setup-email-sending) |
| `SMTP is not configured: set MAIL_FROM_EMAIL` | Set `MAIL_FROM_EMAIL` (or `SMTP_USER`, which it defaults to) |
| `Secret file could not be read: <path>` at startup | `SMTP_PASSWORD` must be the path to an existing JSON secrets file — see [Keeping the SMTP password out of `.env`](#keeping-the-smtp-password-out-of-env) |
| `Secret file does not contain a non-empty string for the requested key` | The JSON file needs `{ "SMTP_PASSWORD": "..." }` |
| `Invalid login` / `535 Authentication failed` when sending mail | Wrong mailbox password in the secrets file, or `SMTP_USER` is not the full mailbox address |
| `ECONNREFUSED` / `ETIMEDOUT` when sending mail | Check `SMTP_HOST`, `SMTP_PORT` and `SMTP_SECURE` (465 + `true`, or 587 + `false`), and that outbound SMTP is not blocked by your network or host |

## Contributing

- Create a branch using the pattern `feature/your-feature` or `fix/issue-123`.
- Run tests before opening a PR:

```bash
npm install
npm test
```

- Commit messages: present-tense and descriptive; reference issue numbers (e.g. `Fix: validate user input (#123)`).
- Open a Pull Request with a clear description, test instructions, and any relevant screenshots or API requests.
- Respond to review comments and update the branch (squash/fixup commits if requested).
- If you change the database schema, commit the generated `prisma/migrations/` folder with your PR (see [Making a schema change](#making-a-schema-change-addingchanging-a-column-table-etc)).
