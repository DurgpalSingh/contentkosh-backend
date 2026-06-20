import fs from 'fs';
import path from 'path';
import { Client as PgClient } from 'pg';
import { getTenantPrisma } from '../config/database';
import logger from '../utils/logger';
import { PERMISSIONS } from '../constants/permission.constants';

const RESERVED_SCHEMA_PREFIXES = new Set(['public', 'pg_catalog', 'information_schema']);

/**
 * Tables that belong exclusively to the public schema and must NEVER be created in tenant schemas.
 *
 * These tables are shared across all tenants (global/platform-level data) and their rows
 * are referenced via cross-schema foreign keys from tenant-specific tables. For example:
 *   - `tenant.users` has a foreign key → `public.business("id")`
 *   - After migration, `users` lives in the tenant schema, but `business` stays in public.
 *   - Therefore, the FK constraint `REFERENCES "public"."business"("id")` must NOT be rewritten
 *     to the tenant schema — it must continue to point at the public schema.
 *
 * This set uses the actual PostgreSQL table names (snake_case) rather than Prisma model names.
 * The corresponding Prisma model names are defined in `PUBLIC_MODEL_NAMES` in `src/config/database.ts`.
 *
 * Any SQL statement that targets one of these tables (CREATE TABLE, ALTER TABLE, CREATE INDEX)
 * is skipped entirely when applying migrations to a tenant schema — the tables already exist
 * in public from the initial Prisma migration and must not be duplicated.
 */
const PUBLIC_ONLY_TABLES = new Set([
  'users',           // canonical user table lives exclusively in public schema
  'refresh_tokens',  // FK references public.users; must be co-located
  'business',
  'business_slug_history',
  'system_config',
  'api_audit_logs',
]);

export function normalizeTenantSchemaName(slug: string): string {
  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `tenant_${normalized}`.replace(/-+/g, '-');
}

export function assertValidTenantSchemaName(schemaName: string): void {
  if (!schemaName || schemaName.length < 3 || schemaName.length > 63) {
    throw new Error('Invalid tenant schema name');
  }
  if (RESERVED_SCHEMA_PREFIXES.has(schemaName.toLowerCase())) {
    throw new Error('Reserved schema name');
  }
}

/**
 * Opens a single raw pg.Client connection using DATABASE_URL.
 * The caller is responsible for calling client.end() when done.
 * Using pg.Client (not Pool) guarantees a dedicated connection — no connection
 * pool reassignment between sequential queries on the same client.
 */
async function openRawClient(): Promise<PgClient> {
  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

export async function ensureTenantSchema(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const client = await openRawClient();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  } finally {
    await client.end();
  }
}

export async function renameTenantSchema(oldSchemaName: string, newSchemaName: string): Promise<void> {
  assertValidTenantSchemaName(oldSchemaName);
  assertValidTenantSchemaName(newSchemaName);
  if (oldSchemaName === newSchemaName) return;
  const client = await openRawClient();
  try {
    await client.query(`ALTER SCHEMA "${oldSchemaName}" RENAME TO "${newSchemaName}"`);
  } finally {
    await client.end();
  }
}

export async function dropTenantSchema(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const client = await openRawClient();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await client.end();
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  // Track named dollar-quoting tags like $$ or $body$ etc.
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    // Dollar-quoting: capture $tag$ ... $tag$ blocks (including plain $$)
    if (!inSingleQuote && !inDoubleQuote && char === '$') {
      // Try to read a dollar-quote tag starting at position i
      const tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1); // e.g. '$$' or '$body$'
        if (/^\$[a-zA-Z0-9_]*\$$/.test(tag)) {
          if (dollarTag === null) {
            // Opening tag
            dollarTag = tag;
            buffer += tag;
            i = tagEnd;
            continue;
          } else if (tag === dollarTag) {
            // Closing tag
            dollarTag = null;
            buffer += tag;
            i = tagEnd;
            continue;
          }
        }
      }
    }

    if (!dollarTag && char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (!dollarTag && char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !dollarTag) {
      const trimmed = buffer.trim();
      if (trimmed) statements.push(trimmed);
      buffer = '';
      continue;
    }

    buffer += char;
  }

  const trimmed = buffer.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

/**
 * Preprocesses a migration SQL file to make it safe for statement-by-statement execution:
 *
 * 1. Strips `--` single-line comments entirely. These are documentation-only in Prisma
 *    migrations and can contain semicolons (e.g. `-- store batch_id; eligible batch...`)
 *    or non-ASCII Unicode characters (e.g. ∩ U+2229) that confuse the statement splitter
 *    or the pg driver parser.
 *
 * 2. Preserves dollar-quoted blocks (`$$ ... $$`) untouched — comments inside them are
 *    part of the SQL syntax and must not be stripped.
 *
 * Block comments (`/* ... *\/`) are left for the pg driver to handle natively.
 */
function preprocessSql(sql: string): string {
  const lines = sql.split('\n');
  const result: string[] = [];
  let inDollarQuote = false;

  for (const line of lines) {
    // Track dollar-quoting so we don't strip comments inside $$ blocks
    if (line.includes('$$')) {
      const count = (line.match(/\$\$/g) || []).length;
      // Odd count of $$ on this line toggles the state
      if (count % 2 !== 0) {
        inDollarQuote = !inDollarQuote;
      }
    }

    if (inDollarQuote) {
      // Inside a dollar-quoted block — preserve everything as-is
      result.push(line);
      continue;
    }

    const trimmed = line.trimStart();

    // Strip pure comment lines entirely (lines that start with --)
    if (trimmed.startsWith('--')) {
      result.push(''); // keep blank line to preserve line numbers for debugging
      continue;
    }

    // Strip inline trailing comments (-- ...) from non-comment lines.
    // Only strip outside of quoted strings — use a simple heuristic: find '--'
    // that is not inside single-quoted or double-quoted strings.
    const cleanLine = stripInlineComment(line);
    result.push(cleanLine);
  }

  return result.join('\n');
}

/**
 * Strips an inline `--` comment from a single SQL line, respecting quoted strings.
 * Returns the line unchanged if no unquoted `--` is found.
 */
function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && c === '-' && line[i + 1] === '-') {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

/**
 * Selectively rewrites schema references from "public" to tenant schema.
 *
 * Handles all forms of table references emitted by Prisma migrations:
 * 1. Qualified quoted:   `"public"."tablename"` → `"schemaName"."tablename"`
 * 2. Unqualified bare:   `public.tablename`     → `"schemaName"."tablename"`
 *
 * Public-only table references (e.g. `"public"."business"`) are preserved for cross-schema FK integrity.
 * PascalCase type references (e.g. `"public"."UserRole"`) are preserved automatically — the
 * character class `[a-z0-9_]+` never matches uppercase-starting identifiers.
 *
 * @internal Exported for unit testing purposes only; not part of the public service API.
 */
export function transformStatement(sql: string, schemaName: string): string {
  // Pass 1: Qualified form "public"."tablename" or "public"."TypeName" — rewrite tenant tables/types, preserve public-only
  let out = sql.replace(/"public"\."([a-zA-Z0-9_]+)"/g, (_match, tableNameOrType) => {
    if (PUBLIC_ONLY_TABLES.has(tableNameOrType.toLowerCase())) {
      return `"public"."${tableNameOrType}"`;
    }
    return `"${schemaName}"."${tableNameOrType}"`;
  });

  // Pass 2: Unqualified bare form public.tablename or public.TypeName — same selective logic
  out = out.replace(/\bpublic\.([a-zA-Z0-9_]+)\b/g, (_match, tableNameOrType) => {
    if (PUBLIC_ONLY_TABLES.has(tableNameOrType.toLowerCase())) {
      return `"public"."${tableNameOrType}"`;
    }
    return `"${schemaName}"."${tableNameOrType}"`;
  });

  return out;
}

/**
 * Extracts the primary table name from a SQL statement.
 * Handles CREATE TABLE, ALTER TABLE, CREATE [UNIQUE] INDEX ... ON, UPDATE, and DROP TABLE patterns,
 * with or without explicit "public". schema qualification.
 * Returns null if the statement type is not recognized or has no extractable table name.
 *
 * @internal Exported for testing purposes
 */
export function extractTableName(sql: string): string | null {
  const patterns = [
    // CREATE TABLE "public"."tablename" or CREATE TABLE "tablename" or CREATE TABLE tablename
    /CREATE\s+TABLE\s+(?:"public"\.)?"?([a-z0-9_]+)"?/i,
    // ALTER TABLE "public"."tablename" or ALTER TABLE "tablename" or ALTER TABLE tablename
    /ALTER\s+TABLE\s+(?:"public"\.)?"?([a-z0-9_]+)"?/i,
    // CREATE [UNIQUE] INDEX indexname ON "public"."tablename" or ON tablename
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\S+\s+ON\s+(?:"public"\.)?"?([a-z0-9_]+)"?/i,
    // UPDATE "public"."tablename" or UPDATE "tablename" or UPDATE tablename
    /UPDATE\s+(?:"public"\.)?"?([a-z0-9_]+)"?/i,
    // DROP TABLE "public"."tablename" or DROP TABLE "tablename" or DROP TABLE tablename (with optional IF EXISTS)
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"public"\.)?"?([a-z0-9_]+)"?/i,
  ];
  for (const pattern of patterns) {
    const match = sql.match(pattern);
    if (match && match[1]) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Returns true for PostgreSQL error codes that are safe to ignore when running
 * tenant migrations idempotently (i.e. the object already exists).
 *
 * - 42P07: relation already exists
 * - 42710: type/extension already exists
 * - 42701: column already exists
 * - 42P16: constraint already exists
 * - 42723: function already exists
 */
function isAlreadyExistsError(err: any): boolean {
  const pgCode: string = err?.code || err?.meta?.code || '';
  const msg: string = err?.message || err?.meta?.message || '';
  return (
    ['42P07', '42710', '42701', '42P16', '42723'].includes(pgCode) ||
    /already exists/i.test(msg)
  );
}

/**
 * Returns true for statements that define or alter shared database-global types/extensions.
 * These must be executed on the public schema and are idempotent (already-exists errors ignored).
 *
 * NOTE: DO $$ blocks that contain IF NOT EXISTS FK guard logic are NOT global type statements
 * even though they use $$ quoting — they operate on tenant tables and must run in the tenant schema.
 */
function isGlobalTypeStatement(sql: string): boolean {
  const normalized = sql.trim();
  // CREATE EXTENSION — shared extensions (must run database-wide)
  if (/^CREATE\s+EXTENSION\b/i.test(normalized)) return true;
  return false;
}

async function executeTenantMigrationSql(schemaName: string, sql: string): Promise<void> {
  // Open a dedicated pg.Client (simple query protocol) so we can:
  //  1. SET search_path once for the entire session — no connection pool re-assignment risk.
  //  2. Execute each statement individually without Prisma's prepared-statement wrapping
  //     (which rejects multi-command strings with error 42601).
  const client = await openRawClient();

  try {
    // Set search_path once for this connection: tenant schema first, then public so that
    // shared enum types defined in the public schema are visible during CREATE TABLE.
    // Unqualified table names in later migrations (e.g. "practice_tests") resolve to
    // the tenant schema because it is first in the search path.
    await client.query(`SET search_path = "${schemaName}", public`);

    // Preprocess SQL: strip all -- comments (including those containing semicolons
    // or non-ASCII Unicode characters like ∩) before splitting into statements.
    const cleanSql = preprocessSql(sql);
    const statements = splitSqlStatements(cleanSql);

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;

      // Skip CREATE SCHEMA IF NOT EXISTS "public" — only valid for initial DB setup.
      if (/^\s*CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+"?public"?/i.test(trimmed)) {
        continue;
      }

      // Global type/extension statements must run against the public schema (shared across tenants).
      // "Already exists" errors (42710) are silently ignored — idempotent for 2nd+ tenant.
      if (isGlobalTypeStatement(trimmed)) {
        try {
          await client.query(trimmed);
        } catch (err: any) {
          if (!isAlreadyExistsError(err)) throw err;
          // silently ignore: type already exists — expected when provisioning 2nd+ tenant
        }
        continue;
      }

      // Skip statements that exclusively target public-only tables (business, system_config, etc.).
      // These already exist in the public schema and must never be recreated in tenant schemas.
      const tableName = extractTableName(trimmed);
      if (tableName && PUBLIC_ONLY_TABLES.has(tableName)) {
        logger.debug(`Skipping public-only table statement for "${tableName}" in tenant migration`);
        continue;
      }

      // Rewrite "public"."tablename" → "schemaName"."tablename" for tenant tables.
      // Public-only table references (cross-schema FKs) and PascalCase type references are preserved.
      // Unqualified statements (no schema prefix) already resolve correctly via search_path.
      const transformed = transformStatement(trimmed, schemaName);

      try {
        await client.query(transformed);
      } catch (err: any) {
        // Idempotency: ignore "already exists" errors. This allows re-provisioning a partially
        // created schema (e.g. after a previous failure) to complete cleanly.
        if (!isAlreadyExistsError(err)) {
          logger.error(`Tenant migration statement failed in schema "${schemaName}"`, {
            statement: transformed.slice(0, 300),
            pgCode: err?.code,
            error: err?.message,
          });
          throw err;
        }
        logger.debug(
          `Idempotent skip — object already exists in "${schemaName}": ${err?.message}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

export async function migrateTenantSchema(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('No migrations directory found — skipping tenant migration', { schemaName });
    return;
  }

  const migrationFolders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(); // chronological order

  for (const folder of migrationFolders) {
    const migrationSqlPath = path.join(migrationsDir, folder, 'migration.sql');
    if (!fs.existsSync(migrationSqlPath)) continue;

    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    logger.debug(`Applying migration "${folder}" to tenant schema "${schemaName}"`);
    await executeTenantMigrationSql(schemaName, sql);
  }

  logger.info(`Tenant schema "${schemaName}" migrated successfully`);
}

export async function seedTenantDefaults(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const tenantPrisma = getTenantPrisma(schemaName);

  try {
    // Seed permissions (idempotent via upsert)
    for (const p of PERMISSIONS) {
      // Ensure permission exists in tenant schema
      // Use upsert to be idempotent
      // eslint-disable-next-line no-await-in-loop
      await tenantPrisma.permission.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      });
    }
  } catch (error) {
    logger.error('Failed to seed tenant defaults', { schemaName, error });
    throw error;
  }
}

/**
 * @deprecated No longer called during provisioning. Users live exclusively in
 * public.users and are never copied to tenant schemas. Will be removed after
 * the data migration (migrate-users-to-public.ts) is confirmed complete.
 *
 * Upserts the initial admin user into the tenant schema.
 *
 * Uses a raw pg.Client with explicit search_path rather than the Prisma tenant client.
 * Prisma's `?schema=` URL parameter sets search_path to only the tenant schema, which causes
 * enum type resolution to fail (e.g. "tenant_x.UserRole" does not exist — enums live in public).
 * By using a raw client with search_path = "tenant_x", public, both the tenant tables and the
 * shared public enums are visible within the same session.
 */
export async function syncAdminToTenantSchema(params: {
  tenantSchema: string;
  userId: number;
  email: string;
  name: string;
  password: string;
  mobile: string | null;
  profilePicture: string | null;
  role: string;
  status: string;
  businessId: number;
}): Promise<void> {
  assertValidTenantSchemaName(params.tenantSchema);
  const client = await openRawClient();
  try {
    await client.query(`SET search_path = "${params.tenantSchema}", public`);
    // Upsert by id — if user already exists in tenant schema update it, otherwise insert.
    await client.query(
      `INSERT INTO "users" (
        "id", "email", "name", "mobile", "profile_picture", "password_hash",
        "role", "status", "business_id", "email_verified",
        "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::\"UserRole\", $8::\"UserStatus\", $9, true, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "email"           = EXCLUDED."email",
        "name"            = EXCLUDED."name",
        "mobile"          = EXCLUDED."mobile",
        "profile_picture" = EXCLUDED."profile_picture",
        "password_hash"   = EXCLUDED."password_hash",
        "role"            = EXCLUDED."role",
        "status"          = EXCLUDED."status",
        "business_id"     = EXCLUDED."business_id",
        "updated_at"      = NOW()`,
      [
        params.userId,
        params.email,
        params.name,
        params.mobile,
        params.profilePicture,
        params.password,
        params.role,
        params.status,
        params.businessId,
      ],
    );
  } finally {
    await client.end();
  }
}
