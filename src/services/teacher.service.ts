import { Teacher } from '@prisma/client';
import * as teacherRepo from '../repositories/teacher.repo';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';
import { TeacherMapper } from '../mappers/teacher.mapper';
import { NotFoundError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { ProfileAuthorizationService, ACCESS_LEVEL } from './profileAuthorization.service';
import logger from '../utils/logger';

export class TeacherService {

    /**
     * Create a new teacher profile
     */
    async createTeacher(data: CreateTeacherDto, user: IUser): Promise<Teacher> {
        logger.info('TeacherService: Creating new teacher profile', {
            userId: data.userId,
            businessId: data.businessId,
            createdBy: user.id
        });

        // Single authorization check for creation
        ProfileAuthorizationService.validateAccess(user, data.businessId, ACCESS_LEVEL.CREATE);

        // Validate user exists and belongs to business
        await ProfileAuthorizationService.validateUserBelongsToBusiness(data.userId, data.businessId);

        // Check if teacher already exists
        const existingTeacher = await teacherRepo.findTeacherByUserId(data.userId);
        ProfileAuthorizationService.ensureProfileDoesNotExist(existingTeacher, data.userId, 'Teacher');

        try {
            const createData = TeacherMapper.toCreateInput(data, user.id);
            const teacher = await teacherRepo.createTeacher(createData);

            logger.info('Teacher profile created successfully', {
                teacherId: teacher.id,
                userId: data.userId
            });

            return teacher;
        } catch (error: any) {
            logger.error('Error creating teacher profile', {
                error: error.message,
                userId: data.userId
            });
            throw error;
        }
    }

    /**
     * Get teacher profile by ID
     */
    async getTeacherById(teacherId: number, user: IUser): Promise<Teacher> {
        logger.info('TeacherService: Fetching teacher profile', {
            teacherId,
            userId: user.id
        });

        const teacher = await teacherRepo.findTeacherById(teacherId);
        if (!teacher) {
            throw new NotFoundError('Teacher profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, teacher.businessId, ACCESS_LEVEL.READ, teacher.userId);

        return teacher;
    }

    /**
     * Update teacher profile
     */
    async updateTeacher(
        teacherId: number,
        data: UpdateTeacherDto,
        user: IUser
    ): Promise<Teacher> {
        logger.info('TeacherService: Updating teacher profile', {
            teacherId,
            updatedBy: user.id
        });

        const teacher = await teacherRepo.findTeacherById(teacherId);
        if (!teacher) {
            throw new NotFoundError('Teacher profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, teacher.businessId, ACCESS_LEVEL.WRITE, teacher.userId);


        try {
            const updateData = TeacherMapper.toUpdateInput(data, user.id);
            const updatedTeacher = await teacherRepo.updateTeacher(teacherId, updateData);

            logger.info('Teacher profile updated successfully', {
                teacherId,
                updatedBy: user.id
            });

            return updatedTeacher;
        } catch (error: any) {
            logger.error('Error updating teacher profile', {
                error: error.message,
                teacherId
            });
            throw error;
        }
    }

    /**
     * Get teacher profile by userId
     */
    async getTeacherByUserId(userId: number, user: IUser): Promise<Teacher> {
        logger.info('TeacherService: Fetching teacher profile by userId', {
            userId,
            requestedBy: user.id
        });

        const teacher = await teacherRepo.findTeacherByUserId(userId);
        if (!teacher) {
            throw new NotFoundError('Teacher profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, teacher.businessId, ACCESS_LEVEL.READ, teacher.userId);

        return teacher;
    }

    /**
     * Validate user can create a teacher for the given business
     */
    async validateTeacherCreationAuth(businessId: number, user: IUser): Promise<void> {
        ProfileAuthorizationService.validateAccess(user, businessId, ACCESS_LEVEL.CREATE);
        logger.info('TeacherService: Teacher creation authorization validated', {
            userId: user.id,
            businessId
        });
    }

    /**
     * Validate user can access the given teacher profile
     */
    async validateTeacherAccess(teacherId: number, user: IUser): Promise<void> {
        const teacher = await teacherRepo.findTeacherById(teacherId);
        if (!teacher) {
            throw new NotFoundError('Teacher profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, teacher.businessId, ACCESS_LEVEL.READ, teacher.userId);
        logger.info('TeacherService: Teacher access validated', {
            teacherId,
            userId: user.id
        });
    }
}
