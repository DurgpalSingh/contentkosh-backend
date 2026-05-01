export function hasOwnProperties<T extends Record<string, unknown>>(obj?: T | null): obj is T {
  return !!obj && Object.keys(obj).length > 0;
}

export function pickDefined<T extends Record<string, any>, K extends readonly (keyof T)[]>(
  source: T,
  keys: ReadonlyArray<K[number]>
): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (k in source && (source as any)[k] !== undefined) out[k] = (source as any)[k];
  }
  return out;
}
