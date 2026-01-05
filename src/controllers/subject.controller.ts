import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as subjectRepo from '../repositories/subject.repo';
import * as courseRepo from '../repositories/course.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';
import { ValidationUtils } from '../utils/validation';

export const createSubject = async (req: Request, res: Response) => {
    const subjectData: Prisma.SubjectUncheckedCreateInput = req.body;

    // Validate input
    ValidationUtils.validateNonEmptyString(subjectData.name, 'Subject name');
    ValidationUtils.validateRequired(subjectData.courseId, 'Course ID');

    const course = await courseRepo.findCourseById(subjectData.courseId);
    if (!course) {
        throw new NotFoundError('Course not found');
    }

    const createInput: Prisma.SubjectCreateInput = {
        name: subjectData.name,
        course: {
            connect: {
                id: subjectData.courseId
            }
        }
    };

    if (subjectData.description !== undefined) {
        createInput.description = subjectData.description;
    }
    if (subjectData.isActive !== undefined) {
        createInput.isActive = subjectData.isActive;
    }

    const subject = await subjectRepo.createSubject(createInput);

    logger.info(`Subject created successfully: ${subjectData.name}`);

    ApiResponseHandler.success(res, subject, 'Subject created successfully', 201);
};

function getSubjectIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
}

export const getSubject = async (req: Request, res: Response) => {
    const id = getSubjectIdFromRequest(req);

    const subject = await subjectRepo.findSubjectById(id);
    if (!subject) {
        throw new NotFoundError('Subject not found');
    }

    logger.info(`Subject fetched successfully: ${subject.name}`);

    ApiResponseHandler.success(res, subject, 'Subject fetched successfully');
};

export const getSubjectsByCourse = async (req: Request, res: Response) => {
    const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');

    const activeOnly = req.query.active === 'true';
    const subjects = await subjectRepo.findSubjectsByCourseId(courseId);
    
    logger.info(`Subjects fetched for course ${courseId}`);

    ApiResponseHandler.success(res, subjects, 'Subjects fetched successfully');
};

export const updateSubject = async (req: Request, res: Response) => {
    const id = getSubjectIdFromRequest(req);
    const subjectData: Prisma.SubjectUncheckedUpdateInput = req.body;

    // Validate input
    if (subjectData.name !== undefined) {
        ValidationUtils.validateNonEmptyString(subjectData.name as string, 'Subject name');
    }

    const subject = await subjectRepo.updateSubject(id, subjectData);
    
    logger.info(`Subject updated successfully: ${subject.name}`);

    ApiResponseHandler.success(res, subject, 'Subject updated successfully');
};

export const deleteSubject = async (req: Request, res: Response) => {
    const id = getSubjectIdFromRequest(req);
    
    await subjectRepo.deleteSubject(id);
    
    logger.info(`Subject deleted successfully: ID ${id}`);

    ApiResponseHandler.success(res, null, 'Subject deleted successfully');
};
