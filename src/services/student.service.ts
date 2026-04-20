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
            throw new ForbiddenError('You do not have permission to create students for this business');
        }

        const targetUser = await userRepo.findPublicById(data.userId);
        if (!targetUser) {
            throw new NotFoundError('User not found');
        }

        if (targetUser.businessId !== data.businessId) {
            throw new BadRequestError('User does not belong to the specified business');
        }

        const existingStudent = await studentRepo.findStudentByUserId(data.userId);
        if (existingStudent) {
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
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN && user.businessId !== student.businessId) {
            throw new ForbiddenError('You do not have access to this student profile');
        }

        return student;
    }

    /**
     * Get student profile by userId
     */
    async getStudentByUserId(userId: number, user: IUser): Promise<Student> {
        const student = await studentRepo.findStudentByUserId(userId);
        if (!student) {
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN && user.businessId !== student.businessId) {
            throw new ForbiddenError('You do not have access to this student profile');
        }

        return student;
    }

    /**
     * Update student profile
     */
    async updateStudent(studentId: number, data: UpdateStudentDto, user: IUser): Promise<Student> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            throw new NotFoundError('Student profile not found');
        }

        if (user.role !== UserRole.ADMIN &&
            user.businessId !== student.businessId &&
            user.id !== student.userId) {
            throw new ForbiddenError('You do not have permission to update this student profile');
        }

        const updateData = StudentMapper.toUpdateInput(data, user.id);
        return await studentRepo.updateStudent(studentId, updateData);
    }

    /**
     * Validate that the requesting user can create a student for the given business
     */
    async validateStudentCreationAuth(businessId: number, user: IUser): Promise<void> {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            throw new ForbiddenError('Only administrators can create student profiles');
        }

        if (user.role === UserRole.ADMIN && user.businessId !== businessId) {
            throw new ForbiddenError('You do not have access to this business');
        }
    }

    /**
     * Validate that the requesting user can access the given student profile
     */
    async validateStudentAccess(studentId: number, user: IUser): Promise<void> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            throw new NotFoundError('Student profile not found');
        }

        if (user.role === UserRole.SUPERADMIN || user.id === student.userId || user.businessId === student.businessId) {
            return;
        }

        throw new ForbiddenError('You do not have access to this student profile');
    }
}
