# ContentKosh — Backend

Backend API for the ContentKosh application — Node.js + TypeScript, Express, Prisma (Postgres).

- Authentication (JWT + refresh tokens), user management, multi-tenant Postgres schemas, file uploads, and Swagger API docs.
- Transactional email through the Gmail API (OAuth2).
- Main entrypoint: `src/index.ts`.

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Gmail API setup (email sending)](#gmail-api-setup-email-sending)
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
- A Google account for the Gmail sender (only needed if you want emails to be sent — see [Gmail API setup](#gmail-api-setup-email-sending))

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

### Email — Gmail API

Needed for sending emails (e.g. the new-business-signup notification and business status emails). Without them, email sending fails with `Gmail API is not configured`.

| Variable | Description | Where to get it |
| --- | --- | --- |
| `GMAIL_CLIENT_ID` | OAuth client ID | [Step 6](#gmail-api-setup-email-sending) |
| `GMAIL_CLIENT_SECRET` | OAuth client secret | [Step 6](#gmail-api-setup-email-sending) |
| `GMAIL_REFRESH_TOKEN` | Long-lived token that lets the server send mail without a login | [Step 10](#gmail-api-setup-email-sending) |
| `GMAIL_SENDER_EMAIL` | The Gmail address emails are sent **from**. Must be the same account you sign in with in Step 10 | Your sender account |
| `BUSINESS_SIGNUP_NOTIFICATION_EMAIL` | Inbox that receives a notification when a new business signs up. Optional — defaults to `info@contentkosh.in` | Any inbox you monitor |

Final result in `.env`:

```env
GMAIL_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_SENDER_EMAIL=noreply@yourdomain.com
BUSINESS_SIGNUP_NOTIFICATION_EMAIL=admin@yourdomain.com
```

## Gmail API setup (email sending)

The backend sends email through the Gmail API using OAuth2. You set this up **once per environment** and end up with 4 values for `.env`: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `GMAIL_SENDER_EMAIL`.

**Before you start:**
- Use a dedicated sender account, for example `noreply@yourdomain.com`, instead of a personal Gmail. All emails are sent from this account.
- You need access to that account's password / 2-step verification, because you will sign in with it once in Step 10.
- Do the steps in order. Step 9 (publish) must be done **before** Step 10 (token), or the token will expire in 7 days.

**Step 1: Choose the sender account**
1. Decide which Google account will send the emails (a `@gmail.com` or Google Workspace account).
2. Write down its email address. This is your `GMAIL_SENDER_EMAIL`.
3. Sign in to this account in your browser. Use it for every step below.

**Step 2: Create a Google Cloud project**
1. Open https://console.cloud.google.com/
2. Sign in with the sender account.
3. Click the project picker at the top, then click **New Project**.
4. Name it, for example `contentkosh-mail`, and click **Create**.
5. Make sure the new project is selected in the project picker.

**Step 3: Enable the Gmail API**
1. Open https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Select your project.
3. Click **Enable**.

**Step 4: Set up the consent screen**
1. Open https://console.cloud.google.com/auth/overview
2. Select your project and click **Get started**.
3. Enter an app name, for example `ContentKosh Mailer`, and choose your email as the **User support email**. Click **Next**.
4. For **Audience**, choose **External**. Click **Next**.
   - If the sender is a Google Workspace account, you can choose **Internal** instead. Internal apps never expire their tokens, so you can skip Step 9.
5. Enter your email as the **Contact information**. Click **Next**.
6. Tick the agreement checkbox, click **Continue**, then click **Create**.

**Step 5: Add the Gmail send permission**
1. Open https://console.cloud.google.com/auth/scopes
2. Click **Add or remove scopes**.
3. In the filter box, search for `gmail.send`, or paste this into **Manually add scopes**:

   ```
   https://www.googleapis.com/auth/gmail.send
   ```
4. Tick it, click **Update**, then click **Save**.
5. This scope can only send emails. It cannot read the mailbox.

**Step 6: Create the OAuth client (client ID and secret)**
1. Open https://console.cloud.google.com/auth/clients
2. Click **Create client**.
3. For **Application type**, select **Desktop app**.
4. Name it, for example `contentkosh-backend`, and click **Create**.
5. A dialog shows the **Client ID** and **Client secret**. Copy both (you can also reopen the client later to see them).

**Step 7: Put the client ID, secret and sender in `.env`**
1. Open the `.env` file in `contentkosh-backend/`.
2. Fill in these three values:

   ```env
   GMAIL_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
   GMAIL_SENDER_EMAIL=noreply@yourdomain.com
   ```
3. Leave `GMAIL_REFRESH_TOKEN` empty for now. You get it in Step 10.

**Step 8: Set the signup notification inbox**
1. In the same `.env` file, set the inbox that should receive a notification whenever a new business signs up:

   ```env
   BUSINESS_SIGNUP_NOTIFICATION_EMAIL=admin@yourdomain.com
   ```
2. This is optional. If you skip it, it defaults to `info@contentkosh.in`.

**Step 9: Publish the app so the token never expires**
1. Open https://console.cloud.google.com/auth/audience
2. Under **Publishing status**, check the status.
3. If it says **Testing**, click **Publish app**, then click **Confirm**.
4. The status must now say **In production**.

> **Important:** while an External app is in **Testing**, Google expires its refresh token after **7 days**, and emails silently stop working with `invalid_grant`. Always publish before generating the token.

You do **not** need Google verification. Because the app is only for you, ignore the "unverified app" warning you will see in Step 10.

**Step 10: Generate the refresh token**
1. Open a terminal in the `contentkosh-backend` folder.
2. Run:

   ```bash
   npx tsx scripts/getGmailRefreshToken.ts
   ```
3. The script prints a long URL. Open it in your browser.
4. Sign in with the **sender account** from Step 1.
5. If Google shows **"Google hasn't verified this app"**, click **Advanced**, then **Go to ContentKosh Mailer (unsafe)**. It is your own app.
6. Click **Continue** / **Allow** to grant "Send email on your behalf".
7. The browser shows "Success! You can close this tab". Go back to the terminal (keep the script running until this point).
8. The terminal prints a line like this:

   ```
   GMAIL_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
9. Copy that whole line into your `.env` file.

If the script says **"No refresh_token was returned"**: open https://myaccount.google.com/permissions, remove the app's access, and run the script again.

If you are setting up a remote server: run the script on your own computer (it needs a browser and `localhost:53682`), then copy only `GMAIL_REFRESH_TOKEN` into the server's environment.

**Step 11: Verify the setup**
1. Check that all 5 values in `.env` are filled in:

   ```env
   GMAIL_CLIENT_ID=
   GMAIL_CLIENT_SECRET=
   GMAIL_REFRESH_TOKEN=
   GMAIL_SENDER_EMAIL=
   BUSINESS_SIGNUP_NOTIFICATION_EMAIL=
   ```
2. Restart the server:

   ```bash
   npm run dev
   ```
3. Sign up a test business.
4. Check the inbox of `BUSINESS_SIGNUP_NOTIFICATION_EMAIL`. A new-signup email should arrive.
5. If it does not, check the server logs and the [Troubleshooting](#troubleshooting) table.

### Keeping the refresh token alive

With the app **In production** (or **Internal**), the token does not expire on a timer. It stops working only in these cases:

| Cause | How to prevent it |
| --- | --- |
| App left in **Testing** (External apps) | Publish it (Step 9) |
| Token unused for **6 months** | Normal use keeps it alive. For a rarely used environment, trigger a test email every few months |
| Sender **changes their Google password** (Gmail tokens are revoked on password change) | After any password change, repeat Step 10 and update `GMAIL_REFRESH_TOKEN` |
| Sender removes the app at https://myaccount.google.com/permissions | Don't revoke it. If you do, repeat Step 10 |
| More than **100 refresh tokens** issued for the same account and client (the oldest is dropped) | Don't re-run Step 10 needlessly, and keep one token per environment |
| OAuth client deleted, or its secret reset | Don't delete or rotate it. If you do, update `GMAIL_CLIENT_SECRET` and repeat Step 10 |
| Workspace admin restricts API access | Ask the admin to allow the app |

If emails start failing with `invalid_grant`, the token is dead. Repeat Step 10 and update `GMAIL_REFRESH_TOKEN`.

### Security notes

- Keep `.env` private. Never commit it or share `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN`.
- Use a separate token per environment (local, UAT, production).
- Gmail limits sending to roughly 500 recipients/day for regular accounts and 2,000/day for Workspace. This is fine for notifications, not for bulk mail.

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
| `npx tsx scripts/getGmailRefreshToken.ts` | Generate `GMAIL_REFRESH_TOKEN` ([guide](#gmail-api-setup-email-sending)) |
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
- `scripts/` — small utilities (e.g. `getGmailRefreshToken.ts`, doc generation)
- `uploads/` — uploaded files (only `uploads/assets` is public)
- `postman/` — Postman collections

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Prisma can't connect | Verify `DATABASE_URL` and that Postgres is running and reachable |
| Swagger/codegen fails | Start the backend first and open `/swagger.json` to confirm it's reachable |
| `Gmail API is not configured: set GMAIL_CLIENT_ID, …` | One of `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` is empty — see [Gmail API setup](#gmail-api-setup-email-sending) |
| `Gmail API is not configured: set GMAIL_SENDER_EMAIL` | Set `GMAIL_SENDER_EMAIL` |
| `invalid_grant` when sending mail | Refresh token expired or revoked — most often the app was left in *Testing* (7-day expiry) or the sender changed their password. Publish the app (Step 9), then redo [Step 10](#gmail-api-setup-email-sending) |
| `redirect_uri_mismatch` while generating the token | Use a **Desktop app** client, or add `http://localhost:53682/oauth2callback` as an authorized redirect URI on a Web client |
| `access_denied` / "app not verified" blocks sign-in | Click **Advanced → Go to … (unsafe)**. If there is no such link and the app is in Testing, publish it (Step 9) or add the sender under Test users at https://console.cloud.google.com/auth/audience |
| Script prints "No refresh_token was returned" | Revoke the app at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and run the script again |
| Port `53682` already in use | Close whatever is using it, then re-run the script |

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
