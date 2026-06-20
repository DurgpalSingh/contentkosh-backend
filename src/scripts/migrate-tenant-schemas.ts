import 'dotenv/config';
import { BusinessProvisioningStatus } from '@prisma/client';
import { publicPrisma } from '../config/database';
import { migrateTenantSchema } from '../services/tenantProvisioning.service';
import logger from '../utils/logger';

async function main() {
  const businesses = await publicPrisma.business.findMany({
    where: {
      isDeleted: false,
      provisioningStatus: BusinessProvisioningStatus.ACTIVE,
      schemaName: { not: null },
    },
    select: {
      id: true,
      instituteName: true,
      schemaName: true,
    },
    orderBy: { id: 'asc' },
  });

  for (const business of businesses) {
    if (!business.schemaName) continue;
    logger.info('Migrating tenant schema', {
      businessId: business.id,
      instituteName: business.instituteName,
      schemaName: business.schemaName,
    });
    await migrateTenantSchema(business.schemaName);
  }

  logger.info('Tenant schema migration complete', { count: businesses.length });
}

main()
  .catch((error) => {
    logger.error('Tenant schema migration failed', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await publicPrisma.$disconnect();
  });
