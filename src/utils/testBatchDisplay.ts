import * as batchRepo from '../repositories/batch.repo';
import { primaryBatchDisplayName } from '../mappers/test.mapper';

export function collectBatchIdsFromTests(tests: Array<{ batchIds: number[] }>): number[] {
  const set = new Set<number>();
  for (const t of tests) {
    for (const id of t.batchIds ?? []) set.add(id);
  }
  return [...set];
}

export async function attachPrimaryBatchDisplayName<T extends { batchIds: number[] }>(
  record: T,
): Promise<T & { batchName?: string }> {
  const ids = record.batchIds ?? [];
  if (!ids.length) {
    return { ...record };
  }
  const displayMap = await batchRepo.findBatchesDisplayByIds(ids);
  const batchName = primaryBatchDisplayName(ids, displayMap);
  return { ...record, ...(batchName !== undefined ? { batchName } : {}) };
}
