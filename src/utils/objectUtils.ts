export function hasOwnProperties<T extends Record<string, unknown>>(obj?: T | null): obj is T {
  return !!obj && Object.keys(obj).length > 0;
}

/** `Pick<T, K>` where keys that may be `undefined` become optional (and never hold `undefined`). */
export type PickedDefined<T, K extends keyof T> = {
  [P in K as undefined extends T[P] ? never : P]: T[P];
} & {
  [P in K as undefined extends T[P] ? P : never]?: Exclude<T[P], undefined>;
};

/**
 * Copies only the listed keys whose value is not `undefined`. Required keys stay required in the type,
 * so a validated create DTO can go straight into a Prisma create (Prisma would otherwise need
 * `...(x !== undefined ? { x } : {})` per field under exactOptionalPropertyTypes).
 */
export function pickDefined<T extends Record<string, any>, K extends keyof T>(
  source: T,
  keys: ReadonlyArray<K>
): PickedDefined<T, K> {
  const out: Partial<Record<K, unknown>> = {};
  for (const k of keys) {
    if (k in source && source[k] !== undefined) out[k] = source[k];
  }
  return out as unknown as PickedDefined<T, K>;
}
