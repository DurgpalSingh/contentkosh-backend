/**
 * migrate-users-to-public.ts
 *
 * One-time data migration script: moves all User and RefreshToken rows from per-tenant
 * PostgreSQL schemas into the canonical public schema.
 *
 * IMPORTANT: Run BEFORE deploying application code changes (tasks 3.1–3.6).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-users-to-public.ts [--dry-run]
 *   node -r ts-node/register src/scripts/migrate-users-to-public.ts [--dry-run]
 *
 * --dry-run  Log all intended actions without executing any DML or DDL.
 *
 * Idempotency: Safe to re-run. The upsert on `id` is a no-op for already-migrated rows.
 */

import 'dotenv/config';
import { Client } from 'pg';
import { BusinessProvisioningStatus, UserRole, UserStatus } from '@prisma/client';
import { publicPrisma, getTenantPrisma } from '../config/database';

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('[migrate-users-to-public] DRY-RUN mode — no DML/DDL will be executed.\n');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by getTenantPrisma().user.findMany({}) */
interface TenantUser {
  id: number;
  businessId: number | null;
  name: string;
  email: string;
  mobile: string | null;
  profilePicture: string | null;
  password: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Main migration logic
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  let totalUsersMigrated = 0;
  let totalSchemasProcessed = 0;

  // -----------------------------------------------------------------------
  // Pre-flight check: Verify public.users table exists
  // -----------------------------------------------------------------------
  const publicUsersTable = await publicPrisma.$queryRaw<Array<{ to_regclass: string }>>`
    SELECT to_regclass('public.users')
  `;
  if (!publicUsersTable[0]?.to_regclass) {
    throw new Error('public.users does not exist — run prisma migrate deploy first');
  }

  // -----------------------------------------------------------------------
  // Step 1: Fetch all active, non-deleted businesses with a non-null schemaName
  // -----------------------------------------------------------------------
  const businesses = await publicPrisma.business.findMany({
    where: {
      schemaName: { not: null },
      provisioningStatus: BusinessProvisioningStatus.ACTIVE,
      isDeleted: false,
    },
    select: {
      id: true,
      instituteName: true,
      schemaName: true,
    },
  });

  console.log(`[migrate-users-to-public] Found ${businesses.length} active tenant schema(s) to process.\n`);

  // -----------------------------------------------------------------------
  // Step 2–3: For each tenant schema, migrate users to public schema
  // -----------------------------------------------------------------------
  for (const business of businesses) {
    // schemaName is non-null here due to the WHERE filter above
    const schemaName = business.schemaName!;
    console.log(`[migrate-users-to-public] Processing schema "${schemaName}" (businessId=${business.id}, name="${business.instituteName}")...`);

    let tenantUsers: TenantUser[];
    try {
      tenantUsers = (await getTenantPrisma(schemaName).user.findMany({})) as TenantUser[];
    } catch (err: unknown) {
      // The users table may not exist in this schema if it was provisioned after the fix
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  [SKIP] Cannot read users from "${schemaName}": ${message}`);
      continue;
    }

    if (tenantUsers.length === 0) {
      console.log(`  [SKIP] No users found in schema "${schemaName}".`);
      totalSchemasProcessed++;
      continue;
    }

    console.log(`  Found ${tenantUsers.length} user(s) in tenant schema.`);
    let schemaMigrated = 0;

    for (const tenantUser of tenantUsers) {
      // Step 3a: Check if a matching public-schema user exists by (businessId, email)
      const existingPublicUser = await publicPrisma.user.findFirst({
        where: {
          businessId: business.id,
          email: tenantUser.email.toLowerCase().trim(),
        },
        select: { id: true, email: true },
      });

      if (existingPublicUser === null) {
        // No matching user in public schema — upsert by id
        console.log(`  [UPSERT] businessId=${business.id}, email=${tenantUser.email}, sourceSchema="${schemaName}"`);

        if (!DRY_RUN) {
          await publicPrisma.user.upsert({
            where: { id: tenantUser.id },
            create: {
              id: tenantUser.id,
              businessId: business.id,
              name: tenantUser.name,
              email: tenantUser.email.toLowerCase().trim(),
              ...(tenantUser.mobile !== null && { mobile: tenantUser.mobile }),
              ...(tenantUser.profilePicture !== null && { profilePicture: tenantUser.profilePicture }),
              password: tenantUser.password,
              role: tenantUser.role,
              status: tenantUser.status,
              emailVerified: tenantUser.emailVerified,
              ...(tenantUser.createdBy !== null && { createdBy: tenantUser.createdBy }),
              ...(tenantUser.updatedBy !== null && { updatedBy: tenantUser.updatedBy }),
              createdAt: tenantUser.createdAt,
              updatedAt: tenantUser.updatedAt,
            },
            // Already migrated on a prior run — no-op
            update: {},
          });
        }

        schemaMigrated++;
        totalUsersMigrated++;
      } else if (existingPublicUser.id !== tenantUser.id) {
        // ID mismatch — a public-schema user exists with a different id.
        // Update any refresh_tokens pointing at the tenant user's id to point at the
        // canonical public user id, preventing FK violations.
        console.log(
          `  [ID-MISMATCH] email=${tenantUser.email}: tenant id=${tenantUser.id}, public id=${existingPublicUser.id}` +
          ` — repointing refresh_tokens to publicId=${existingPublicUser.id}`,
        );

        if (!DRY_RUN) {
          await publicPrisma.refreshToken.updateMany({
            where: { userId: tenantUser.id },
            data: { userId: existingPublicUser.id },
          });
        }
      } else {
        // IDs match — user is already correctly present in public schema (idempotent)
        console.log(`  [SKIP] Already in public schema: businessId=${business.id}, email=${tenantUser.email}`);
      }
    }

    console.log(`  Migrated ${schemaMigrated} user(s) from schema "${schemaName}".\n`);
    totalSchemasProcessed++;
  }

  // -----------------------------------------------------------------------
  // Step 4: Drop users and refresh_tokens tables from each tenant schema
  //         using a raw pg Client (Prisma does not support cross-schema DDL)
  // -----------------------------------------------------------------------
  if (businesses.length > 0) {
    console.log('[migrate-users-to-public] Dropping users/refresh_tokens from tenant schemas...\n');

    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });

    if (!DRY_RUN) {
      await pgClient.connect();
    }

    try {
      for (const business of businesses) {
        const schemaName = business.schemaName!;
        // Escape identifiers to guard against schema names with special characters
        const dropRefreshTokens = `DROP TABLE IF EXISTS "${schemaName}"."refresh_tokens" CASCADE`;
        const dropUsers = `DROP TABLE IF EXISTS "${schemaName}"."users" CASCADE`;

        console.log(`  [DDL] ${dropRefreshTokens}`);
        console.log(`  [DDL] ${dropUsers}`);

        if (!DRY_RUN) {
          await pgClient.query(dropRefreshTokens);
          await pgClient.query(dropUsers);
        }
      }
    } finally {
      if (!DRY_RUN) {
        await pgClient.end();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Step 5: Summary
  // -----------------------------------------------------------------------
  const dryLabel = DRY_RUN ? ' [DRY-RUN — nothing was written]' : '';
  console.log(
    `\n[migrate-users-to-public] Migration complete${dryLabel} — ` +
    `${totalUsersMigrated} users migrated from ${totalSchemasProcessed} tenant schema(s).`,
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
run()
  .then(() => {
    void publicPrisma.$disconnect();
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('[migrate-users-to-public] Fatal error:', err);
    void publicPrisma.$disconnect();
    process.exit(1);
  });
