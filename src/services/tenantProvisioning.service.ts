import { Client as PgClient } from 'pg';
import { getTenantPrisma } from '../config/database';
import logger from '../utils/logger';
import { PERMISSIONS } from '../constants/permission.constants';
import { applyPendingTenantMigrations } from './tenantSchemaMigrator';

const RESERVED_SCHEMA_PREFIXES = new Set(['public', 'pg_catalog', 'information_schema']);

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

/**
 * Brings a tenant schema fully up to date by replaying whichever migration files
 * under `prisma/migrations/` haven't been applied to it yet (see `tenantSchemaMigrator.ts`).
 * Used both for brand-new tenants (provisioning) and to backfill existing ones after a
 * `schema.prisma` change (via `npm run db:tenants:migrate`).
 */
export async function migrateTenantSchema(schemaName: string): Promise<void> {
  assertValidTenantSchemaName(schemaName);
  const client = await openRawClient();
  try {
    await applyPendingTenantMigrations(client, schemaName);
  } catch (error) {
    logger.error(`Tenant schema "${schemaName}" provisioning failed`, { schemaName, error });
    throw error;
  } finally {
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
