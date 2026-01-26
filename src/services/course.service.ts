import { Prisma, Course, UserRole } from '@prisma/client';
import * as courseRepo from '../repositories/course.repo';
import { CreateCourseDto, UpdateCourseDto } from '../dtos/course.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';
import { CourseMapper } from '../mappers/course.mapper';

export class CourseService {

    async createCourse(data: CreateCourseDto): Promise<Course> {
        logger.info('CourseService: Creating new course', { name: data.name, examId: data.examId });

        // Map DTO to Prisma input
        const createData: Prisma.CourseUncheckedCreateInput = {
            name: data.name,
            description: data.description ?? null,
            examId: data.examId,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            ...(data.status && { status: data.status }),
        };

        // Check for duplicate course name
        const existingCourse = await courseRepo.findCourseByName(data.name, data.examId);
        if (existingCourse) {
            throw new BadRequestError('Course with this name already exists for this exam');
        }

        const course = await courseRepo.createCourse(createData);
        return CourseMapper.toDomain(course);
    }

    async getCourse(id: number, options?: any): Promise<Course> {
        logger.info('CourseService: Fetching course', { courseId: id });
        const course = await courseRepo.findCourseById(id, options);
        if (!course) {
            logger.error(`CourseService: Course with ID ${id} not found`);
            throw new NotFoundError('Course not found');
        }
        return CourseMapper.toDomain(course);
    }

    async getCoursesByExam(examId: number, user: IUser, options: any = {}): Promise<Course[]> {
        logger.info('CourseService: Fetching courses by exam', { examId, userId: user.id, role: user.role });

        if (user.role === UserRole.TEACHER) {
            options.where = {
                ...options.where,
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
            };
        }

        const courses = await courseRepo.findCoursesByExamId(examId, options);
        return courses.map(c => CourseMapper.toDomain(c));
    }

    async updateCourse(id: number, data: UpdateCourseDto): Promise<Course> {
        logger.info('CourseService: Updating course', { courseId: id });

        const updateData: Prisma.CourseUncheckedUpdateInput = {
            ...(data.name && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.startDate !== undefined && { startDate: data.startDate }),
            ...(data.endDate !== undefined && { endDate: data.endDate }),
            ...(data.status && { status: data.status }),
        };

        // Check for duplicate name if name is being updated
        if (data.name) {
            const existingCourse = await courseRepo.findCourseById(id);
            if (!existingCourse) {
                throw new NotFoundError('Course not found');
            }

            const duplicateCourse = await courseRepo.findCourseByName(data.name, existingCourse.examId);
            if (duplicateCourse && duplicateCourse.id !== id) {
                throw new BadRequestError('Course with this name already exists for this exam');
            }
        }

        try {
            const course = await courseRepo.updateCourse(id, updateData);
            logger.info(`CourseService: Course updated successfully: ${course.name}`);
            return CourseMapper.toDomain(course);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundError('Course not found');
            }
            throw error;
        }
    }

    async deleteCourse(id: number): Promise<void> {
        logger.info('CourseService: Deleting course', { courseId: id });
        try {
            await courseRepo.deleteCourse(id);
            logger.info(`CourseService: Course deleted successfully: ID ${id}`);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundError('Course not found');
            }
            throw error;
        }
    }

    async validateCourseAccess(courseId: number, user: IUser): Promise<void> {
        const course = await courseRepo.findCourseById(courseId);

        if (!course) {
            throw new NotFoundError('Course not found');
        }

        const { findExamById } = await import('../repositories/exam.repo');
        const exam = await findExamById(course.examId);

        if (!exam) {
            throw new ForbiddenError('Course is not linked to a valid exam');
        }

        const isSuperAdmin = user.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === user.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            throw new ForbiddenError('You do not have access to this course');
        }
    }
}
