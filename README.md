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
- `npm run db:migrate` — create/apply migrations
- `npm run db:push` — push schema to database (no migrations)
- `npm run db:studio` — open Prisma Studio
- `npm run db:reset-seed` — reset DB and run seed
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

- Schema: `prisma/schema.prisma` — models and relations live here.
- To generate the client: `npm run db:generate`
- To inspect data: `npm run db:studio`

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