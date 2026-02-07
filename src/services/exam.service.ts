import { Exam, UserRole } from '@prisma/client';
import * as examRepo from '../repositories/exam.repo';
import { CreateExamDto, UpdateExamDto } from '../dtos/exam.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';
import { ExamMapper } from '../mappers/exam.mapper';

export class ExamService {

    async createExam(data: CreateExamDto, userId: number): Promise<Exam> {
        logger.info('ExamService: Creating new exam', { name: data.name, businessId: data.businessId });

        const createData = {
            name: data.name,
            code: data.code ?? null,
            description: data.description ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            businessId: data.businessId,
            createdBy: userId
        };

        try {
            const existing = await examRepo.findActiveExamByName(data.businessId, data.name);
            if (existing) {
                throw new BadRequestError('Exam with this name already exists for this business');
            }

            const exam = await examRepo.createExam(createData);
            return ExamMapper.toDomain(exam);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new BadRequestError('Exam with this name already exists for this business');
            }
            throw error;
        }
    }

    async getExam(id: number, options?: any): Promise<Exam> {
        logger.info('ExamService: Fetching exam', { examId: id });
        const exam = await examRepo.findExamById(id, options);
        if (!exam) {
            logger.error(`ExamService: Exam with ID ${id} not found`);
            throw new NotFoundError('Exam not found');
        }
        return ExamMapper.toDomain(exam);
    }

    async getExamsByBusiness(businessId: number, user: IUser, options: any = {}): Promise<Exam[]> {
        logger.info('ExamService: Fetching exams by business', { businessId, userId: user.id, role: user.role });

        if (user.role === UserRole.TEACHER) {
            options.where = {
                ...options.where,
                courses: {
                    some: {
                        batches: {
                            some: {
                                batchUsers: {
                                    some: {
                                        userId: user.id,
                                        isActive: true
                                    }
                                }
                            }
                        }
                    }
                }
            };
        }

        const exams = await examRepo.findActiveExamsByBusinessId(businessId, options);
        return exams.map(e => ExamMapper.toDomain(e));
    }

    async updateExam(id: number, data: UpdateExamDto, userId: number, businessId: number): Promise<Exam> {
        logger.info('ExamService: Updating exam', { examId: id });

        // Map DTO to Prisma input (clean undefineds)
        const updateData = {
            ...(data.name && { name: data.name }),
            ...(data.code !== undefined && { code: data.code }), // Allow null/empty string if passed, but typically optional in DTO means undefined
            ...(data.description !== undefined && { description: data.description }),
            ...(data.startDate !== undefined && { startDate: data.startDate }),
            ...(data.endDate !== undefined && { endDate: data.endDate }),
            ...(data.status && { status: data.status }),
            updatedBy: userId
        };

        try {
            if (data.name) {
                const existing = await examRepo.findActiveExamByName(businessId, data.name, id);
                if (existing) {
                    throw new BadRequestError('Exam with this name already exists for this business');
                }
            }

            const exam = await examRepo.updateExam(id, updateData);
            logger.info(`ExamService: Exam updated successfully: ${exam.name}`);
            return ExamMapper.toDomain(exam);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new BadRequestError('Exam with this name already exists for this business');
            }
            // Assuming updateExam might throw if not found, or returns null. 
            // Repo 'updateExam' usually throws if ID invalid in Prisma.
            // We can check existence first if needed, but Prisma will throw P2025.
            if (error.code === 'P2025') {
                throw new NotFoundError('Exam not found');
            }
            throw error;
        }
    }

    async deleteExam(id: number): Promise<void> {
        logger.info('ExamService: Deleting exam', { examId: id });
        try {
            await examRepo.deleteExam(id);
            logger.info(`ExamService: Exam deleted successfully: ID ${id}`);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundError('Exam not found');
            }
            throw error;
        }
    }

    async validateExamAccess(examId: number, user: IUser): Promise<void> {
        const exam = await examRepo.findExamById(examId);
        if (!exam) {
            throw new NotFoundError('Exam not found');
        }

        const isSuperAdmin = user.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === user.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            throw new ForbiddenError('You do not have access to this exam');
        }
    }
}

