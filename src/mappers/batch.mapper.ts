import { Batch } from '@prisma/client';

export class BatchMapper {
    static toDomain(data: any): Batch {
        return data as Batch;
    }
}
