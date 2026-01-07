import { Subject, Prisma, SubjectStatus } from '@prisma/client';
import { CreateSubjectDto, UpdateSubjectDto } from '../dtos/subject.dto';
import * as subjectRepo from '../repositories/subject.repo';
import * as courseRepo from '../repositories/course.repo';
import { SubjectMapper } from '../mappers/subject.mapper';
import { NotFoundError, BadRequestError } from '../errors/api.errors';
import logger from '../utils/logger';

export class SubjectService {
    async createSubject(data: CreateSubjectDto): Promise<Subject> {
        logger.info('SubjectService: Creating new subject', { name: data.name, courseId: data.courseId });

        // Validate Course ID existence
        const course = await courseRepo.findCourseById(data.courseId);
        if (!course) {
            throw new NotFoundError('Course not found');
        }

        // Map DTO to Prisma input
        const createData: Prisma.SubjectUncheckedCreateInput = {
            name: data.name,
            description: data.description ?? null,
            courseId: data.courseId,
            ...(data.status && { status: data.status }),
        };

        try {
            const subject = await subjectRepo.createSubject(createData);
            return SubjectMapper.toDomain(subject);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new BadRequestError('Subject with this name already exists for this course');
            }
            throw error;
        }
    }

    async getSubject(id: number): Promise<Subject> {
        const subject = await subjectRepo.findSubjectById(id);
        if (!subject) {
            throw new NotFoundError('Subject not found');
        }
        return SubjectMapper.toDomain(subject);
    }

    async getSubjectsByCourse(courseId: number, options: { active?: boolean } = {}): Promise<Subject[]> {
        const findOptions: subjectRepo.SubjectFindOptions = {};

        if (options.active) {
            findOptions.where = { status: SubjectStatus.ACTIVE };
        }

        const subjects = await subjectRepo.findSubjectsByCourseId(courseId, findOptions);
        return subjects.map(SubjectMapper.toDomain);
    }

    async updateSubject(id: number, data: UpdateSubjectDto): Promise<Subject> {
        logger.info('SubjectService: Updating subject', { id });

        const existingSubject = await subjectRepo.findSubjectById(id);
        if (!existingSubject) {
            throw new NotFoundError('Subject not found');
        }

        const updateData: Prisma.SubjectUpdateInput = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.status !== undefined) updateData.status = data.status;

        try {
            const subject = await subjectRepo.updateSubject(id, updateData);
            return SubjectMapper.toDomain(subject);
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new BadRequestError('Subject with this name already exists for this course');
            }
            throw error;
        }
    }

    async deleteSubject(id: number): Promise<void> {
        logger.info('SubjectService: Deleting subject', { id });

        // Check existence
        const subject = await subjectRepo.findSubjectById(id);
        if (!subject) {
            throw new NotFoundError('Subject not found');
        }

        try {
            await subjectRepo.deleteSubject(id);
        } catch (error: any) {
            // Handle specific errors if needed, e.g. FK constraints if any (topics?)
            throw error;
        }
    }
}

export const subjectService = new SubjectService();
