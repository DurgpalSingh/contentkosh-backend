/**
 * baseline-tenant-migrations.ts
 *
 * One-time cutover script: run ONCE when adopting bookkeeping-based tenant migrations
 * (see tenantSchemaMigrator.ts). Every tenant schema that already exists today was built
 * by the old hand-written provisioning script and already has the current table structure
 * — this script does NOT touch table structure at all. It only records every currently
 * committed migration as "already applied" in each tenant schema's `_tenant_migrations`
 * bookkeeping table, so `npm run db:tenants:migrate` treats them as up to date and only
 * applies genuinely new migrations from this point forward.
 *
 * Usage:
 *   npx tsx src/scripts/baseline-tenant-migrations.ts [--dry-run]
 *
 * Safe to re-run: recording an already-recorded migration name is a no-op (ON CONFLICT DO NOTHING).
 */

import 'dotenv/config';
import { Client as PgClient } from 'pg';
import { BusinessProvisioningStatus } from '@prisma/client';
import { publicPrisma } from '../config/database';
import { assertValidTenantSchemaName } from '../services/tenantProvisioning.service';
import { baselineTenantMigrations, loadTenantMigrations } from '../services/tenantSchemaMigrator';
import logger from '../utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const migrationNames = loadTenantMigrations().map((m) => m.name);
  logger.info('Baselining tenant schemas against current migration history', {
    migrationCount: migrationNames.length,
    migrations: migrationNames,
    dryRun: DRY_RUN,
  });

  const businesses = await publicPrisma.business.findMany({
    where: {
      isDeleted: false,
      provisioningStatus: BusinessProvisioningStatus.ACTIVE,
      schemaName: { not: null },
    },
    select: { id: true, instituteName: true, schemaName: true },
    orderBy: { id: 'asc' },
  });

  for (const business of businesses) {
    if (!business.schemaName) continue;
    assertValidTenantSchemaName(business.schemaName);

    if (DRY_RUN) {
      logger.info('[dry-run] Would baseline tenant schema', {
        businessId: business.id,
        schemaName: business.schemaName,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const client = new PgClient({ connectionString: process.env.DATABASE_URL });
    // eslint-disable-next-line no-await-in-loop
    await client.connect();
    try {
      // eslint-disable-next-line no-await-in-loop
      const applied = await baselineTenantMigrations(client, business.schemaName);
      logger.info('Baselined tenant schema', {
        businessId: business.id,
        schemaName: business.schemaName,
        migrationsRecorded: applied.length,
      });
    } finally {
      // eslint-disable-next-line no-await-in-loop
      await client.end();
    }
  }

  logger.info('Tenant schema baseline complete', { count: businesses.length, dryRun: DRY_RUN });
}

main()
  .catch((error) => {
    logger.error('Tenant schema baseline failed', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await publicPrisma.$disconnect();
  });
