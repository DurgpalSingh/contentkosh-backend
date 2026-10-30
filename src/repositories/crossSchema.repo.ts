import { Client as PgClient } from 'pg';
import { publicPrisma } from '../config/database';
import { requestContext } from '../contexts/request-context';

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_-]{0,62}$/;

export function assertValidDbIdentifier(identifier: string): void {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid database identifier: ${identifier}`);
  }
}

export function quoteIdentifier(identifier: string): string {
  assertValidDbIdentifier(identifier);
  return `"${identifier.replace(/"/g, '""')}"`;
}

export async function getTenantSchemaNameForBusiness(businessId: number): Promise<string> {
  const tenant = requestContext.getTenant();
  if (tenant?.schemaName && tenant.businessId === businessId) {
    return tenant.schemaName;
  }

  const business = await publicPrisma.business.findFirst({
    where: { id: businessId, isDeleted: false },
    select: { schemaName: true },
  });

  if (!business?.schemaName) {
    throw new Error(`Tenant schema not found for business ${businessId}`);
  }

  return business.schemaName;
}

export async function getActiveTenantSchemaName(): Promise<string> {
  const tenant = requestContext.getTenant();
  if (tenant?.schemaName) return tenant.schemaName;
  throw new Error('Tenant context is required for this operation');
}

export async function queryTenantPublic<T>(
  businessId: number,
  sqlFactory: (schemaSql: string) => string,
  ...params: unknown[]
): Promise<T[]> {
  const schemaName = await getTenantSchemaNameForBusiness(businessId);
  return publicPrisma.$queryRawUnsafe<T[]>(sqlFactory(quoteIdentifier(schemaName)), ...params);
}

export async function openTenantTransaction(
  businessId: number,
): Promise<{ client: PgClient; schemaSql: string }> {
  const schemaName = await getTenantSchemaNameForBusiness(businessId);
  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('BEGIN');
  return { client, schemaSql: quoteIdentifier(schemaName) };
}

export async function commitAndClose(client: PgClient): Promise<void> {
  try {
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

export async function rollbackAndClose(client: PgClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

export function userBasicFromRow(row: any, prefix = 'user') {
  const id = row[`${prefix}_id`];
  if (id === null || id === undefined) return null;
  return {
    id,
    name: row[`${prefix}_name`],
    email: row[`${prefix}_email`],
    mobile: row[`${prefix}_mobile`] ?? null,
    role: row[`${prefix}_role`],
    profilePicture: row[`${prefix}_profile_picture`] ?? null,
  };
}

export function businessBasicFromRow(row: any) {
  const id = row.business_id;
  if (id === null || id === undefined) return null;
  return {
    id,
    instituteName: row.business_institute_name,
  };
}
