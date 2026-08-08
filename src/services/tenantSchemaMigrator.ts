import * as fs from 'fs';
import * as path from 'path';
import { Client as PgClient } from 'pg';
import { PUBLIC_ONLY_TABLES } from '../config/tenant-schema.constants';

/**
 * Replays the real Prisma migration files (each `prisma/migrations/<name>/migration.sql`) against
 * a tenant schema instead of maintaining a second, hand-written copy of the tenant table
 * structure. `schema.prisma` + `prisma/migrations` become the only place table structure
 * is defined; this module only decides, per statement, whether it belongs in a tenant
 * schema at all.
 *
 * Each migration file is applied on a single dedicated `pg` connection (never a pool) so
 * that `SET search_path` and the statements that follow it can never land on different
 * physical connections — a prior attempt at this exact mechanism (see
 * .kiro/specs/tenant-schema-provisioning-fix) broke on that exact pooling hazard.
 */

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations');
const BOOKKEEPING_TABLE = '_tenant_migrations';

// Words a keyword-anchored regex sweep can pick up that are never table names:
// FK action clauses ("ON UPDATE CASCADE"), and Postgres catalog/metadata relations
// referenced by hand-written idempotency guards (e.g. "SELECT 1 FROM pg_constraint").
const IGNORED_REFERENCE_WORDS = new Set([
  'information_schema', 'pg_catalog', 'pg_constraint', 'pg_class', 'pg_namespace',
  'pg_attribute', 'pg_type', 'pg_index', 'pg_indexes',
  'cascade', 'restrict', 'no', 'action', 'null', 'default', 'set', 'exists', 'not', 'only',
]);

export interface TenantMigration {
  name: string;
  /** Pre-filtered SQL ready to replay against a tenant schema; empty if this migration has nothing tenant-relevant. */
  tenantSql: string;
}

let cachedMigrations: TenantMigration[] | null = null;

function readMigrationFolders(): { name: string; rawSql: string }[] {
  const entries = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return entries.map((name) => ({
    name,
    rawSql: fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'),
  }));
}

/**
 * Splits a migration.sql file into top-level statements. Dollar-quoted blocks
 * (`$$ ... $$` / `$tag$ ... $tag$`, used by hand-written `DO` blocks) and single-quoted
 * string literals are treated as atomic so a `;` inside them never causes a false split.
 * Line comments (`-- ...`) are dropped.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    if (ch === '-' && sql[i + 1] === '-') {
      const newlineIdx = sql.indexOf('\n', i);
      i = newlineIdx === -1 ? n : newlineIdx + 1;
      current += '\n';
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    if (ch === '$') {
      const tagMatch = /^\$([A-Za-z0-9_]*)\$/.exec(sql.slice(i));
      if (tagMatch) {
        const delimiter = tagMatch[0];
        const closeIdx = sql.indexOf(delimiter, i + delimiter.length);
        const end = closeIdx === -1 ? n : closeIdx + delimiter.length;
        current += sql.slice(i, end);
        i = end;
        continue;
      }
    }

    if (ch === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmedTail = current.trim();
  if (trimmedTail.length > 0) statements.push(trimmedTail);

  return statements;
}

/** Removes explicit `public.` qualifiers (quoted `"public".` or bare `public.`, both appear
 * across the migration history) so unqualified identifiers resolve via the tenant session's
 * `search_path = "<tenant>", public` instead of being pinned to `public`. */
export function stripPublicQualifier(statement: string): string {
  return statement.replace(/"public"\./g, '').replace(/\bpublic\.(?=[a-zA-Z_"])/g, '');
}

const TABLE_REF_PATTERNS = [
  /\bTABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?"?([a-zA-Z_]\w*)"?/gi,
  // Requires a trailing "(" so "ON DELETE/UPDATE CASCADE" FK-action clauses never match;
  // real index/table targets are always followed by a column list.
  /\bON\s+"?([a-zA-Z_]\w*)"?\s*\(/gi,
  /\bINTO\s+"?([a-zA-Z_]\w*)"?/gi,
  /\bUPDATE\s+"?([a-zA-Z_]\w*)"?/gi,
  /\bFROM\s+"?([a-zA-Z_]\w*)"?/gi,
  /\bJOIN\s+"?([a-zA-Z_]\w*)"?/gi,
  /\bREFERENCES\s+"?([a-zA-Z_]\w*)"?/gi,
];

function findTableReferences(statement: string): Set<string> {
  const found = new Set<string>();
  for (const pattern of TABLE_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(statement);
    while (match !== null) {
      const name = match[1]!.toLowerCase();
      if (!IGNORED_REFERENCE_WORDS.has(name)) found.add(name);
      match = pattern.exec(statement);
    }
  }
  return found;
}

/**
 * A statement must be skipped for tenant schemas when every table it references belongs
 * to `PUBLIC_ONLY_TABLES` (e.g. `UPDATE "public"."business" SET ...`). Statements with no
 * recognizable table reference at all (`CREATE TYPE`, `ALTER TYPE ... ADD VALUE`, ...) are
 * always kept — a handful of unused enum types inside a tenant schema is harmless, and it
 * avoids having to separately track which enums belong to which side of the split.
 */
export function isPublicOnlyStatement(statement: string): boolean {
  // Strip qualifiers first: otherwise `"public"."users"` reads as table name "public".
  const refs = findTableReferences(stripPublicQualifier(statement));
  if (refs.size === 0) return false;
  for (const ref of refs) {
    if (!PUBLIC_ONLY_TABLES.has(ref)) return false;
  }
  return true;
}

/** Builds the SQL that should be replayed against a tenant schema for one migration file. */
export function buildTenantMigrationSql(rawSql: string): string {
  const kept: string[] = [];
  for (const statement of splitSqlStatements(rawSql)) {
    const stripped = stripPublicQualifier(statement);
    if (isPublicOnlyStatement(stripped)) continue;
    kept.push(stripped);
  }
  return kept.join('\n\n');
}

function assertMigrationFilteringInvariants(migrations: TenantMigration[]): void {
  const combined = migrations.map((m) => m.tenantSql).join('\n');

  if (/"public"\./.test(combined) || /\bpublic\.(?=[a-zA-Z_"])/.test(combined)) {
    throw new Error(
      'Tenant migration filtering left a residual public. qualifier in the SQL that would ' +
      'be replayed against tenant schemas — check stripPublicQualifier/isPublicOnlyStatement.',
    );
  }

  for (const table of PUBLIC_ONLY_TABLES) {
    const createRe = new RegExp(`CREATE TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${table}"?\\s*\\(`, 'i');
    if (createRe.test(combined)) {
      throw new Error(
        `Tenant migration filtering kept a CREATE TABLE for public-only table "${table}" — ` +
        'it must never be created inside a tenant schema.',
      );
    }
  }
}

/** Loads, filters and caches every migration file, keyed by folder name in chronological order. */
export function loadTenantMigrations(): TenantMigration[] {
  if (cachedMigrations) return cachedMigrations;

  const migrations = readMigrationFolders().map(({ name, rawSql }) => ({
    name,
    tenantSql: buildTenantMigrationSql(rawSql),
  }));

  assertMigrationFilteringInvariants(migrations);
  cachedMigrations = migrations;
  return migrations;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureBookkeepingTable(client: PgClient, schemaName: string): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(schemaName)}.${quoteIdentifier(BOOKKEEPING_TABLE)} (
      "migration_name" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
}

async function getAppliedMigrationNames(client: PgClient, schemaName: string): Promise<Set<string>> {
  const result = await client.query<{ migration_name: string }>(
    `SELECT "migration_name" FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(BOOKKEEPING_TABLE)}`,
  );
  return new Set(result.rows.map((row) => row.migration_name));
}

async function recordMigrationApplied(client: PgClient, schemaName: string, migrationName: string): Promise<void> {
  await client.query(
    `INSERT INTO ${quoteIdentifier(schemaName)}.${quoteIdentifier(BOOKKEEPING_TABLE)} ("migration_name")
     VALUES ($1) ON CONFLICT ("migration_name") DO NOTHING`,
    [migrationName],
  );
}

/**
 * Applies every migration not yet recorded for this tenant schema, in order, on the given
 * connection. Used both to provision a brand-new schema (bookkeeping starts empty, so every
 * migration applies) and to bring an existing tenant schema up to date (only new migrations
 * apply) — there is no longer a separate "provision" vs. "migrate" code path.
 */
export async function applyPendingTenantMigrations(client: PgClient, schemaName: string): Promise<string[]> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`);
  await ensureBookkeepingTable(client, schemaName);
  await client.query(`SET search_path = ${quoteIdentifier(schemaName)}, public`);

  const applied = await getAppliedMigrationNames(client, schemaName);
  const appliedNow: string[] = [];

  for (const migration of loadTenantMigrations()) {
    if (applied.has(migration.name)) continue;
    if (migration.tenantSql.trim().length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(migration.tenantSql);
    }
    // eslint-disable-next-line no-await-in-loop
    await recordMigrationApplied(client, schemaName, migration.name);
    appliedNow.push(migration.name);
  }

  return appliedNow;
}

/**
 * Marks every currently-known migration as applied for a tenant schema WITHOUT executing
 * any SQL. Used once, during the cutover to bookkeeping-based migration tracking, for tenant
 * schemas that already have the current structure (built by the old hand-written script).
 */
export async function baselineTenantMigrations(client: PgClient, schemaName: string): Promise<string[]> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`);
  await ensureBookkeepingTable(client, schemaName);

  const names: string[] = [];
  for (const migration of loadTenantMigrations()) {
    // eslint-disable-next-line no-await-in-loop
    await recordMigrationApplied(client, schemaName, migration.name);
    names.push(migration.name);
  }
  return names;
}
