import { Student, UserRole } from '@prisma/client';
import * as studentRepo from '../repositories/student.repo';
import * as userRepo from '../repositories/user.repo';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';
import { StudentMapper } from '../mappers/student.mapper';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';

export class StudentService {
    /**
     * Create a new student profile
     */
    async createStudent(data: CreateStudentDto, user: IUser): Promise<Student> {
        logger.info('StudentService: Creating new student profile', {
            userId: data.userId,
            businessId: data.businessId,
            createdBy: user.id
        });

        if (user.role !== UserRole.ADMIN && user.businessId !== data.businessId) {
            logger.warn('StudentService: Forbidden to create student for different business', {
                userId: user.id,
                userRole: user.role,
                userBusinessId: user.businessId,
                targetBusinessId: data.businessId
            });
            throw new ForbiddenError('You do not have permission to create students for this business');
        }

        const targetUser = await userRepo.findPublicById(data.userId);
        if (!targetUser) {
            logger.warn('StudentService: User not found for student creation', {
                userId: data.userId,
                requestedBy: user.id
            });
            throw new NotFoundError('User not found');
        }

        if (targetUser.businessId !== data.businessId) {
            logger.warn('StudentService: User business mismatch', {
                userId: data.userId,
                userBusinessId: targetUser.businessId,
                targetBusinessId: data.businessId,
                requestedBy: user.id
            });
            throw new BadRequestError('User does not belong to the specified business');
        }

        const existingStudent = await studentRepo.findStudentByUserId(data.userId);
        if (existingStudent) {
            logger.warn('StudentService: Student profile already exists', {
                userId: data.userId,
                existingStudentId: existingStudent.id,
                requestedBy: user.id
            });
            throw new BadRequestError('Student profile already exists for this user');
        }

        const createData = StudentMapper.toCreateInput(data, user.id);
        const student = await studentRepo.createStudent(createData);

        logger.info('Student profile created successfully', {
            studentId: student.id,
            userId: data.userId
        });

        return student;
    }

    /**
     * Get student profile by ID
     */
    async getStudentById(studentId: number, user: IUser): Promise<Student> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            logger.warn('StudentService: Student profile not found by ID', {
                studentId,
                requestedBy: user.id
            });
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN && user.businessId !== student.businessId) {
            logger.warn('StudentService: Forbidden access to student profile', {
                studentId,
                userId: user.id,
                userRole: user.role,
            });
            throw new ForbiddenError('You do not have access to this student profile');
        }

        logger.info('StudentService: Retrieved student profile by ID', {
            studentId,
            userId: user.id
        });

        return student;
    }

    /**
     * Get student profile by userId
     */
    async getStudentByUserId(userId: number, user: IUser): Promise<Student> {
        const student = await studentRepo.findStudentByUserId(userId);
        if (!student) {
            logger.warn('StudentService: Student profile not found by user ID', {
                userId,
                requestedBy: user.id
            });
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN && user.businessId !== student.businessId) {
            logger.warn('StudentService: Forbidden access to student profile by user ID', {
                userId,
                studentId: student.id,
                requestedBy: user.id,
                userRole: user.role,
            });
            throw new ForbiddenError('You do not have access to this student profile');
        }

        logger.info('StudentService: Retrieved student profile by user ID', {
            userId,
            studentId: student.id,
            requestedBy: user.id
        });

        return student;
    }

    /**
     * Update student profile
     */
    async updateStudent(studentId: number, data: UpdateStudentDto, user: IUser): Promise<Student> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            logger.warn('StudentService: Student profile not found for update', {
                studentId,
                requestedBy: user.id
            });
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN &&
            user.businessId !== student.businessId &&
            user.id !== student.userId) {
            logger.warn('StudentService: Forbidden to update student profile', {
                studentId,
                userId: user.id,
                userRole: user.role,
            });
            throw new ForbiddenError('You do not have permission to update this student profile');
        }

        const updateData = StudentMapper.toUpdateInput(data, user.id);
        const updatedStudent = await studentRepo.updateStudent(studentId, updateData);

        logger.info('StudentService: Student profile updated successfully', {
            studentId,
            updatedBy: user.id
        });

        return updatedStudent;
    }

    /**
     * Validate that the requesting user can create a student for the given business
     */
    async validateStudentCreationAuth(businessId: number, user: IUser): Promise<void> {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            logger.warn('StudentService: Insufficient role for student creation', {
                userId: user.id,
                userRole: user.role,
                businessId
            });
            throw new ForbiddenError('Only administrators can create student profiles');
        }

        if (user.role === UserRole.ADMIN && user.businessId !== businessId) {
            logger.warn('StudentService: Admin access denied for business', {
                userId: user.id,
                userRole: user.role,
                userBusinessId: user.businessId,
                targetBusinessId: businessId
            });
            throw new ForbiddenError('You do not have access to this business');
        }

        logger.info('StudentService: Student creation authorization validated', {
            userId: user.id,
            businessId
        });
    }

    /**
     * Validate that the requesting user can access the given student profile
     */
    async validateStudentAccess(studentId: number, user: IUser): Promise<void> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            logger.warn('StudentService: Student profile not found for access validation', {
                studentId,
                requestedBy: user.id
            });
            throw new NotFoundError('Student profile not found');
        }

        if (user.role === UserRole.SUPERADMIN || user.id === student.userId || user.businessId === student.businessId) {
            logger.info('StudentService: Student access validated', {
                studentId,
                userId: user.id,
                userRole: user.role
            });
            return;
        }

        logger.warn('StudentService: Forbidden access to student profile', {
            studentId,
            userId: user.id,
            userRole: user.role,
        });
        throw new ForbiddenError('You do not have access to this student profile');
    }
}
