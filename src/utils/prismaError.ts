export function translatePrismaError(
  error: any,
  mapping: Partial<Record<string, () => Error>>,
): never {
  const buildError = error?.code ? mapping[error.code] : undefined;
  if (buildError) {
    throw buildError();
  }
  throw error;
}

/** True when `error` is a Prisma error with the given code (e.g. a unique-constraint race). */
export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}
