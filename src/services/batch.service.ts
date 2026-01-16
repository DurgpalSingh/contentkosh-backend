import { Prisma, Batch, UserRole } from '@prisma/client';
import * as batchRepo from '../repositories/batch.repo';
import * as courseRepo from '../repositories/course.repo';
import * as userRepo from '../repositories/user.repo';
import { CreateBatchDto, UpdateBatchDto } from '../dtos/batch.dto';
import { NotFoundError, BadRequestError, AlreadyExistsError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
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


    async getBatchesByCourse(courseId: number, options?: any): Promise<Batch[]> {
        logger.info('BatchService: Fetching batches for course', { courseId });

        if (options?.include?.students) {
            delete options.include.students;
            options.include.batchUsers = {
                where: {
                    user: {
                        role: UserRole.STUDENT
                    }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            mobile: true,
                            role: true
                        }
                    }
                }
            };
        }

        let batches;
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

        // 1. Fetch Batch with Business Context
        const batch = await batchRepo.findBatchById(batchId, {
            select: {
                id: true,
                course: {
                    select: {
                        exam: {
                            select: { businessId: true }
                        }
                    }
                }
            }
        }) as any; // Cast to any because custom select changes return type structure

        if (!batch) throw new NotFoundError('Batch not found');

        const businessId = batch.course?.exam?.businessId;
        if (!businessId) throw new BadRequestError('Batch is not associated with a valid business');

        // 2. Fetch User
        const user = await userRepo.findPublicById(userId);
        if (!user) throw new NotFoundError('User not found');

        // 3. Validate User belongs to this business
        if (user.businessId !== businessId) {
            throw new BadRequestError('User is not part of this business');
        }

        // 4. Validate Role - only Teachers and Students can be added to a batch
        if (user.role !== 'TEACHER' && user.role !== 'STUDENT') {
            throw new BadRequestError('Only Teachers and Students can be added to a batch');
        }

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

    async getUsersByBatch(batchId: number, role?: UserRole) {
        logger.info('BatchService: Fetching users for batch', { batchId, role });
        return await batchRepo.findUsersByBatchId(batchId, role);
    }

    async updateBatchUser(batchId: number, userId: number, data: any) {
        logger.info('BatchService: Updating batch user', { batchId, userId });

        const existing = await batchRepo.findBatchUser(userId, batchId);
        if (!existing) throw new NotFoundError('User is not in this batch');

        return await batchRepo.updateBatchUser(userId, batchId, data);
    }

    async validateBatchAccess(batchId: number, user: IUser): Promise<void> {
        // Batch -> Course -> Exam -> Business
        const batch = await batchRepo.findBatchById(batchId, {
            include: {
                course: {
                    include: {
                        exam: true
                    }
                }
            }
        });

        if (!batch) {
            throw new NotFoundError('Batch not found');
        }

        // Using safe navigation, though with our schema and repo, structure should be intact
        // We cast to any or define a type because standard Batch return type might not show the deep includes unless typed
        // However, Prisma client types usually handle includes if we use the generic correctly, but here we used `findBatchById` which returns `Batch | null`.
        // Let's re-fetch or use a specific query if `findBatchById` doesn't support generic inclusion well in the repo signature.
        // Actually the repo method `findBatchById` implementation might just return `prisma.batch.findUnique`.
        // If the repo doesn't support custom includes via arguments easily, we might need a specific repo method or rely on what we can get.
        // The middleware gathered it manually. Let's do it cleanly.

        // Re-fetch using repo if possible, or assume the repo method allows options.
        // The repo signature seen in previous turn: findBatchById(id, options?)
        // So we can pass include.

        const batchWithRelations = await batchRepo.findBatchById(batchId, {
            include: { course: { include: { exam: true } } }
        }) as any; // Cast for simplified access

        if (!batchWithRelations) throw new NotFoundError('Batch not found');

        const exam = batchWithRelations.course?.exam;
        if (!exam) {
            throw new ForbiddenError('Batch is not correctly associated with an exam');
        }

        const isSuperAdmin = user.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === user.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            throw new ForbiddenError('You do not have access to this batch');
        }
    }
}
