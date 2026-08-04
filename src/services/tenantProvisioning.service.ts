import { Client as PgClient } from 'pg';
import { getTenantPrisma } from '../config/database';
import logger from '../utils/logger';
import { PERMISSIONS } from '../constants/permission.constants';
import { provisionTenantSchema } from '../scripts/provision-tenant-schema';

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

type MissingTenantColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
  column_default: string | null;
  is_not_null: boolean;
};

const FIND_MISSING_TENANT_COLUMNS_SQL = `
  SELECT
    source_rel.relname AS table_name,
    source_attr.attname AS column_name,
    format_type(source_attr.atttypid, source_attr.atttypmod) AS data_type,
    pg_get_expr(source_def.adbin, source_def.adrelid) AS column_default,
    source_attr.attnotnull AS is_not_null
  FROM pg_attribute source_attr
  JOIN pg_class source_rel ON source_rel.oid = source_attr.attrelid
  JOIN pg_namespace source_ns ON source_ns.oid = source_rel.relnamespace
  JOIN pg_class tenant_rel ON tenant_rel.relname = source_rel.relname
  JOIN pg_namespace tenant_ns ON tenant_ns.oid = tenant_rel.relnamespace AND tenant_ns.nspname = $1
  LEFT JOIN pg_attribute tenant_attr
    ON tenant_attr.attrelid = tenant_rel.oid
   AND tenant_attr.attname = source_attr.attname
   AND tenant_attr.attnum > 0
   AND NOT tenant_attr.attisdropped
  LEFT JOIN pg_attrdef source_def
    ON source_def.adrelid = source_attr.attrelid
   AND source_def.adnum = source_attr.attnum
  WHERE source_ns.nspname = $2
    AND source_rel.relkind = 'r'
    AND tenant_rel.relkind = 'r'
    AND source_attr.attnum > 0
    AND NOT source_attr.attisdropped
    AND source_rel.relname <> ALL($3::text[])
    AND tenant_attr.attname IS NULL
  ORDER BY source_rel.relname, source_attr.attnum
`;

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

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getReferenceSchemaName(): string {
  return `tenant_migration_ref_${process.pid}`;
}

async function createReferenceTenantSchema(
  client: PgClient,
  referenceSchemaName: string,
): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(referenceSchemaName)} CASCADE`);
  await client.query(`CREATE SCHEMA ${quoteIdentifier(referenceSchemaName)}`);
  await provisionTenantSchema(client, referenceSchemaName);
}

async function dropSchemaIfExists(client: PgClient, schemaName: string): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
}

async function findMissingTenantColumns(
  client: PgClient,
  tenantSchemaName: string,
  referenceSchemaName: string,
): Promise<MissingTenantColumn[]> {
  const result = await client.query<MissingTenantColumn>(
    FIND_MISSING_TENANT_COLUMNS_SQL,
    [tenantSchemaName, referenceSchemaName, Array.from(PUBLIC_ONLY_TABLES)],
  );
  return result.rows;
}

async function addMissingTenantColumn(
  client: PgClient,
  schemaName: string,
  column: MissingTenantColumn,
): Promise<void> {
  if (column.is_not_null && !column.column_default) {
    throw new Error(
      `Cannot auto-add required column ${column.table_name}.${column.column_name} without a default`,
    );
  }

  const tableName = `${quoteIdentifier(schemaName)}.${quoteIdentifier(column.table_name)}`;
  const columnName = quoteIdentifier(column.column_name);
  const defaultClause = column.column_default ? ` DEFAULT ${column.column_default}` : '';

  await client.query(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${column.data_type}${defaultClause}`,
  );

  if (column.is_not_null) {
    await client.query(
      `UPDATE ${tableName} SET ${columnName} = ${column.column_default} WHERE ${columnName} IS NULL`,
    );
    await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET NOT NULL`);
  }

  logger.info('Added missing tenant column', {
    schemaName,
    tableName: column.table_name,
    columnName: column.column_name,
  });
}

async function syncMissingTenantColumns(
  client: PgClient,
  schemaName: string,
  referenceSchemaName: string,
): Promise<void> {
  const missingColumns = await findMissingTenantColumns(client, schemaName, referenceSchemaName);
  await client.query(`SET search_path = ${quoteIdentifier(schemaName)}, public`);

  for (const column of missingColumns) {
    // eslint-disable-next-line no-await-in-loop
    await addMissingTenantColumn(client, schemaName, column);
  }
}

export async function migrateTenantSchema(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const client = await openRawClient();
  const referenceSchemaName = getReferenceSchemaName();
  try {
    await provisionTenantSchema(client, schemaName);
    await createReferenceTenantSchema(client, referenceSchemaName);
    await syncMissingTenantColumns(client, schemaName, referenceSchemaName);
  } catch (error) {
    logger.error(`Tenant schema "${schemaName}" provisioning failed`, { schemaName, error });
    throw error;
  } finally {
    await dropSchemaIfExists(client, referenceSchemaName);
    await client.end();
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
