import { Prisma, Batch } from '@prisma/client';
import * as batchRepo from '../repositories/batch.repo';
import * as courseRepo from '../repositories/course.repo';
import * as userRepo from '../repositories/user.repo';
import { CreateBatchDto, UpdateBatchDto } from '../dtos/batch.dto';
import { NotFoundError, BadRequestError, AlreadyExistsError } from '../errors/api.errors';
import logger from '../utils/logger';
import { BatchMapper } from '../mappers/batch.mapper';

export class BatchService {

    async createBatch(data: CreateBatchDto): Promise<Batch> {
        logger.info('BatchService: Creating new batch', { codeName: data.codeName, courseId: data.courseId });

        // Check course existence
        const course = await courseRepo.findCourseById(data.courseId);
        if (!course) {
            throw new NotFoundError('Course not found');
        }

        const createData: Prisma.BatchCreateInput = {
            codeName: data.codeName,
            displayName: data.displayName,
            startDate: data.startDate,
            endDate: data.endDate,
            course: {
                connect: { id: data.courseId }
            },
            ...(data.isActive !== undefined && { isActive: data.isActive })
        };

        try {
            const batch = await batchRepo.createBatch(createData);
            return BatchMapper.toDomain(batch);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new AlreadyExistsError('Batch with this code name already exists');
            }
            throw error;
        }
    }

    async getBatch(id: number): Promise<Batch> {
        logger.info('BatchService: Fetching batch', { batchId: id });
        const batch = await batchRepo.findBatchById(id);
        if (!batch) {
            throw new NotFoundError('Batch not found');
        }
        return BatchMapper.toDomain(batch);
    }

    async getBatchWithUsers(id: number) {
        logger.info('BatchService: Fetching batch with users', { batchId: id });
        const batch = await batchRepo.findBatchWithUsers(id);
        if (!batch) {
            throw new NotFoundError('Batch not found');
        }
        return batch;
    }

    async getBatchesByCourse(courseId: number, options?: any): Promise<Batch[]> {
        logger.info('BatchService: Fetching batches for course', { courseId });

        let batches;
        // Check if options has explicit active filter (from query params usually handled in controller)
        // But here we rely on repository options.
        // If options.where.isActive is true, we could use findActiveBatchesByCourseId or just pass it to generic find.

        if (options?.where?.isActive === true) {
            batches = await batchRepo.findActiveBatchesByCourseId(courseId, options);
        } else {
            batches = await batchRepo.findBatchesByCourseId(courseId, options);
        }

        return batches.map(b => BatchMapper.toDomain(b));
    }

    async updateBatch(id: number, data: UpdateBatchDto): Promise<Batch> {
        logger.info('BatchService: Updating batch', { batchId: id });

        // Check existence
        const existingBatch = await batchRepo.findBatchById(id);
        if (!existingBatch) {
            throw new NotFoundError('Batch not found');
        }

        const updateData: Prisma.BatchUpdateInput = {
            ...(data.codeName && { codeName: data.codeName }),
            ...(data.displayName && { displayName: data.displayName }),
            ...(data.startDate && { startDate: data.startDate }),
            ...(data.endDate && { endDate: data.endDate }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
        };

        try {
            const batch = await batchRepo.updateBatch(id, updateData);
            return BatchMapper.toDomain(batch);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new AlreadyExistsError('Batch with this code name already exists');
            }
            throw error;
        }
    }

    async deleteBatch(id: number): Promise<void> {
        logger.info('BatchService: Deleting batch', { batchId: id });
        try {
            await batchRepo.deleteBatch(id);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundError('Batch not found');
            }
            throw error;
        }
    }

    // Batch User Operations
    async addUserToBatch(userId: number, batchId: number) {
        logger.info('BatchService: Adding user to batch', { userId, batchId });

        const user = await userRepo.findPublicById(userId);
        if (!user) throw new NotFoundError('User not found');

        const batch = await batchRepo.findBatchById(batchId);
        if (!batch) throw new NotFoundError('Batch not found');

        const existing = await batchRepo.findBatchUser(userId, batchId);
        if (existing) throw new AlreadyExistsError('User is already in this batch');

        return await batchRepo.addUserToBatch(userId, batchId);
    }

    async removeUserFromBatch(userId: number, batchId: number) {
        logger.info('BatchService: Removing user from batch', { userId, batchId });

        const existing = await batchRepo.findBatchUser(userId, batchId);
        if (!existing) throw new NotFoundError('User is not in this batch');

        await batchRepo.removeUserFromBatch(userId, batchId);
    }

    async getBatchesByUser(userId: number) {
        logger.info('BatchService: Fetching batches for user', { userId });
        // Optionally map to domain?
        return await batchRepo.findBatchesByUserId(userId);
    }

    async getUsersByBatch(batchId: number, options?: any) {
        logger.info('BatchService: Fetching users for batch', { batchId });
        return await batchRepo.findUsersByBatchId(batchId);
    }

    async updateBatchUser(batchId: number, userId: number, data: any) {
        logger.info('BatchService: Updating batch user', { batchId, userId });

        const existing = await batchRepo.findBatchUser(userId, batchId);
        if (!existing) throw new NotFoundError('User is not in this batch');

        return await batchRepo.updateBatchUser(userId, batchId, data);
    }
}
