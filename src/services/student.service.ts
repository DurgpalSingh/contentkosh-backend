import { Student } from '@prisma/client';
import * as studentRepo from '../repositories/student.repo';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';
import { StudentMapper } from '../mappers/student.mapper';
import { NotFoundError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { ProfileAuthorizationService } from './profile-authorization.service';
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

        // Single authorization check for creation
        ProfileAuthorizationService.validateAccess(user, data.businessId, 'create');

        // Validate user exists and belongs to business
        await ProfileAuthorizationService.validateUserBelongsToBusiness(data.userId, data.businessId);

        // Check if student already exists
        const existingStudent = await studentRepo.findStudentByUserId(data.userId);
        ProfileAuthorizationService.ensureProfileDoesNotExist(existingStudent, data.userId, 'Student');

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

        ProfileAuthorizationService.validateAccess(user, student.businessId, 'read', student.userId);

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
            throw new NotFoundError('Student profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, student.businessId, 'read', student.userId);

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
            throw new NotFoundError('Student profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, student.businessId, 'write', student.userId);

        const updateData = StudentMapper.toUpdateInput(data, user.id);
        const updatedStudent = await studentRepo.updateStudent(studentId, updateData);

        logger.info('StudentService: Student profile updated successfully', {
            studentId,
            updatedBy: user.id
        });

        return updatedStudent;
    }

    /**
     * Validate user can create a student for the given business
     */
    async validateStudentCreationAuth(businessId: number, user: IUser): Promise<void> {
        ProfileAuthorizationService.validateAccess(user, businessId, 'create');
        logger.info('StudentService: Student creation authorization validated', {
            userId: user.id,
            businessId
        });
    }

    /**
     * Validate user can access the given student profile
     */
    async validateStudentAccess(studentId: number, user: IUser): Promise<void> {
        const student = await studentRepo.findStudentById(studentId);
        if (!student) {
            throw new NotFoundError('Student profile not found');
        }

        ProfileAuthorizationService.validateAccess(user, student.businessId, 'read', student.userId);
        logger.info('StudentService: Student access validated', {
            studentId,
            userId: user.id
        });
    }
}
