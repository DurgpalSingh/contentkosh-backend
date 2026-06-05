import { PrismaClient } from '@prisma/client';
import { requestContext } from '../contexts/request-context';

type PrismaLikeClient = PrismaClient & Record<string, any>;

const PUBLIC_SCHEMA = 'public';

const globalForPrisma = global as unknown as {
  publicPrisma?: PrismaClient;
  tenantPrismaBySchema?: Map<string, PrismaClient>;
};

export const publicPrisma =
  globalForPrisma.publicPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.publicPrisma = publicPrisma;

globalForPrisma.tenantPrismaBySchema = globalForPrisma.tenantPrismaBySchema || new Map<string, PrismaClient>();

export function buildSchemaUrl(databaseUrl: string | undefined, schemaName: string): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const url = new URL(databaseUrl);
  // Set the default schema for Prisma's query routing
  url.searchParams.set('schema', schemaName);
  // Override search_path to include both tenant schema AND public so that
  // shared enum types (UserRole, UserStatus, etc.) defined in the public schema
  // are visible when Prisma executes queries against the tenant schema.
  // Without this, Prisma qualifies enum lookups as "tenant_x.UserRole" which fails
  // because enums live only in the public schema.
  url.searchParams.set('options', `--search_path="${schemaName}",public`);
  return url.toString();
}

export function getTenantPrisma(schemaName?: string): PrismaClient {
  const normalizedSchema = schemaName?.trim();
  if (!normalizedSchema) return publicPrisma;

  const cache = globalForPrisma.tenantPrismaBySchema!;
  const existing = cache.get(normalizedSchema);
  if (existing) return existing;

  const client = new PrismaClient({
    datasources: {
      db: {
        url: buildSchemaUrl(process.env.DATABASE_URL, normalizedSchema),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  cache.set(normalizedSchema, client);
  return client;
}

/**
 * Evicts a tenant Prisma client from the cache and disconnects it.
 * Call this if the schema URL needs to change (e.g. after a schema rename).
 */
export async function evictTenantPrisma(schemaName: string): Promise<void> {
  const cache = globalForPrisma.tenantPrismaBySchema;
  if (!cache) return;
  const client = cache.get(schemaName);
  if (client) {
    cache.delete(schemaName);
    await client.$disconnect().catch(() => {/* ignore disconnect errors */});
  }
}

const PUBLIC_MODEL_NAMES = new Set([
  'user',         // always in public schema
  'refreshToken', // FK references public.users; must stay co-located
  'business',
  'businessSlugHistory',
  'systemConfig',
  'apiAuditLog',
]);

export function resolveActiveClientForModel(modelName: string): PrismaLikeClient {
  const tenant = requestContext.getTenant();
  if (PUBLIC_MODEL_NAMES.has(modelName)) {
    return publicPrisma as PrismaLikeClient;
  }

  if (tenant?.schemaName) {
    return getTenantPrisma(tenant.schemaName) as PrismaLikeClient;
  }

  return publicPrisma as PrismaLikeClient;
}

function pickBaseClient(prop: PropertyKey): PrismaLikeClient {
  if (typeof prop !== 'string') {
    return publicPrisma as PrismaLikeClient;
  }

  if (prop === '$connect' || prop === '$disconnect' || prop === '$transaction' || prop === '$use' || prop === '$extends' || prop === '$on' || prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
    const tenant = requestContext.getTenant();
    if (tenant?.schemaName) {
      return getTenantPrisma(tenant.schemaName) as PrismaLikeClient;
    }
    return publicPrisma as PrismaLikeClient;
  }

  return resolveActiveClientForModel(prop);
}

export const prisma = new Proxy({} as PrismaLikeClient, {
  get(_target, prop) {
    if (prop === Symbol.toStringTag) return 'PrismaClient';
    const base = pickBaseClient(prop);
    const value = base[prop as keyof PrismaLikeClient];
    if (typeof value === 'function') {
      return value.bind(base);
    }
    return value;
  },
}) as PrismaLikeClient;

// Graceful shutdown
process.on('beforeExit', async () => {
  console.log('Disconnecting from database');
  await publicPrisma.$disconnect();

  const cache = globalForPrisma.tenantPrismaBySchema || new Map<string, PrismaClient>();
  await Promise.all(Array.from(cache.values()).map((client) => client.$disconnect()));
});
