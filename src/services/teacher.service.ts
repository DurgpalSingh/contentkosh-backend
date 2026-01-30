import { Prisma, Teacher, TeacherStatus, UserRole, Gender } from '@prisma/client';
import * as teacherRepo from '../repositories/teacher.repo';
import * as userRepo from '../repositories/user.repo';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
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

        // Verify user has permission to create teacher (must be admin or from the same business)
        if (user.role !== UserRole.ADMIN && user.businessId !== data.businessId) {
            throw new ForbiddenError('You do not have permission to create teachers for this business');
        }

        // Verify the user exists and belongs to the business
        const targetUser = await userRepo.findPublicById(data.userId);
        if (!targetUser) {
            throw new NotFoundError('User not found');
        }

        if (targetUser.businessId !== data.businessId) {
            throw new BadRequestError('User does not belong to the specified business');
        }

        // Check if teacher profile already exists for this user
        const existingTeacher = await teacherRepo.findTeacherByUserId(data.userId);
        if (existingTeacher) {
            throw new BadRequestError('Teacher profile already exists for this user');
        }

        // Validate experience years
        if (data.professional.experienceYears < 0) {
            throw new BadRequestError('Experience years cannot be negative');
        }

        try {
            const createData: Prisma.TeacherCreateInput = {
                user: { connect: { id: data.userId } },
                business: { connect: { id: data.businessId } },
                qualification: data.professional.qualification,
                experienceYears: data.professional.experienceYears,
                designation: data.professional.designation,
                bio: data.professional.bio ?? null,
                languages: data.professional.languages || [],
                gender: data.personal?.gender ?? null,
                dob: data.personal?.dob ? new Date(data.personal.dob) : null,
                address: data.personal?.address ?? null,
                status: TeacherStatus.ACTIVE,
                ...(user.id && { createdByUser: { connect: { id: user.id } } })
            };

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

        // Check if user has access (admin or same business)
        if (user.role !== UserRole.ADMIN && user.businessId !== teacher.businessId) {
            throw new ForbiddenError('You do not have access to this teacher profile');
        }

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

        // Check if user has permission to update (admin, same business, or own profile)
        if (user.role !== UserRole.ADMIN &&
            user.businessId !== teacher.businessId &&
            user.id !== teacher.userId) {
            throw new ForbiddenError('You do not have permission to update this teacher profile');
        }

        // Validate experience years if being updated
        if (data.professional?.experienceYears !== undefined && data.professional.experienceYears < 0) {
            throw new BadRequestError('Experience years cannot be negative');
        }

        try {
            const updateData: Prisma.TeacherUpdateInput = {
                ...(data.professional && {
                    qualification: data.professional.qualification,
                    experienceYears: data.professional.experienceYears,
                    designation: data.professional.designation,
                    bio: data.professional.bio ?? null,
                    languages: data.professional.languages
                }),
                ...(data.personal && {
                    gender: data.personal.gender ?? null,
                    dob: data.personal.dob ? new Date(data.personal.dob) : null,
                    address: data.personal.address ?? null
                }),
                ...(data.status && { status: data.status }),
                ...(user.id && { updatedByUser: { connect: { id: user.id } } }),
                updatedAt: new Date()
            };

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

    async validateTeacherCreationAuth(businessId: number, user: IUser): Promise<void> {

        // Only ADMIN or SUPERADMIN can create teachers
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            throw new ForbiddenError('Only administrators can create teacher profiles');
        }

        // Check if user belongs to the business (except SUPERADMIN)
        if (user.role === UserRole.ADMIN && user.businessId !== businessId) {
            throw new ForbiddenError('You do not have access to this business');
        }
    }

    async validateTeacherAccess(teacherId: number, user: IUser): Promise<void> {

        const teacher = await teacherRepo.findTeacherById(teacherId);
        if (!teacher) {
            throw new NotFoundError('Teacher profile not found');
        }

        if (user.role === UserRole.SUPERADMIN || user.id === teacher.userId || user.businessId === teacher.businessId) {
            return;
        }

        throw new ForbiddenError('You do not have access to this teacher profile');
    }
}
