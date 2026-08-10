/**
 * Single source of truth for which tables/models live exclusively in the `public`
 * schema (shared across all tenants) rather than inside each tenant's own schema.
 *
 * Both `database.ts` (Prisma model routing) and `tenantSchemaMigrator.ts` (raw SQL
 * table filtering) import from here so the two representations of the same split
 * (camelCase Prisma model name vs. snake_case Postgres table name) can never drift
 * apart the way `PUBLIC_MODEL_NAMES`/`PUBLIC_ONLY_TABLES` used to.
 */
export const PUBLIC_ONLY_MODELS = [
  { modelName: 'user', tableName: 'users' },
  { modelName: 'refreshToken', tableName: 'refresh_tokens' },
  { modelName: 'business', tableName: 'business' },
  { modelName: 'businessSlugHistory', tableName: 'business_slug_history' },
  { modelName: 'systemConfig', tableName: 'system_config' },
  { modelName: 'apiAuditLog', tableName: 'api_audit_logs' },
] as const;

export const PUBLIC_ONLY_TABLES: ReadonlySet<string> = new Set(
  PUBLIC_ONLY_MODELS.map((m) => m.tableName),
);

export const PUBLIC_MODEL_NAMES: ReadonlySet<string> = new Set(
  PUBLIC_ONLY_MODELS.map((m) => m.modelName),
);
