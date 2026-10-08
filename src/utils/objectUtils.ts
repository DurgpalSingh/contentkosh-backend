export function hasOwnProperties<T extends Record<string, unknown>>(obj?: T | null): obj is T {
  return !!obj && Object.keys(obj).length > 0;
}

/**
 * Copies only the listed keys whose value is not `undefined`. Useful for PATCH-style updates
 * (Prisma would otherwise need `...(x !== undefined ? { x } : {})` per field under exactOptionalPropertyTypes).
 */
export function pickDefined<T extends Record<string, any>, K extends keyof T>(
  source: T,
  keys: ReadonlyArray<K>
): { [P in K]?: Exclude<T[P], undefined> } {
  const out: { [P in K]?: Exclude<T[P], undefined> } = {};
  for (const k of keys) {
    if (k in source && source[k] !== undefined) out[k] = source[k];
  }
  return out;
}
