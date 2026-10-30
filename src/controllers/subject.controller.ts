import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { subjectService } from '../services/subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from '../dtos/subject.dto';
import { plainToInstance } from 'class-transformer';
import { ValidationUtils } from '../utils/validation';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';

export const createSubject = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');

        const subjectDataInput = plainToInstance(CreateSubjectDto, req.body);
        subjectDataInput.courseId = courseId; // Assign courseId from params

        const subject = await subjectService.createSubject(subjectDataInput);

        ApiResponseHandler.success(res, subject, 'Subject created successfully', 201);
    } catch (error) {
        handleControllerError(res, error, 'Failed to create subject', 'Error creating subject');
    }
};

export const getSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        const subject = await subjectService.getSubject(id);
        ApiResponseHandler.success(res, subject, 'Subject fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch subject', 'Error fetching subject');
    }
};

export const getSubjectsByCourse = async (req: Request, res: Response) => {
    try {
        const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');
        const activeOnly = req.query.active === 'true';

        const subjects = await subjectService.getSubjectsByCourse(courseId, { active: activeOnly });
        ApiResponseHandler.success(res, subjects, 'Subjects fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch subjects', 'Error fetching subjects');
    }
};

export const getSubjectsByUserId = async (req: AuthRequest, res: Response) => {
    try {
        const subjects = await subjectService.getSubjectsByUserId(req.user!);
        ApiResponseHandler.success(res, subjects, 'Subjects fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch subjects', 'Error fetching subjects by user');
    }
};

export const updateSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        const subjectDataInput = plainToInstance(UpdateSubjectDto, req.body);

        const subject = await subjectService.updateSubject(id, subjectDataInput);
        ApiResponseHandler.success(res, subject, 'Subject updated successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to update subject', 'Error updating subject');
    }
};

export const deleteSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        await subjectService.deleteSubject(id);
        ApiResponseHandler.success(res, null, 'Subject deleted successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to delete subject', 'Error deleting subject');
    }
};
