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
