import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';
import { TeacherService } from '../services/teacher.service';
import { TeacherMapper } from '../mappers/teacher.mapper';
import { AuthRequest } from '../dtos/auth.dto';

export class TeacherController {
  private teacherService: TeacherService;

  constructor(teacherService: TeacherService) {
    this.teacherService = teacherService;
  }

  /**
   * POST /teachers/profile
   * Create a new teacher profile
   */
  public createTeacher = async (req: AuthRequest, res: Response) => {
    try {
      const teacherData = plainToInstance(CreateTeacherDto, req.body);
      const user = req.user!;

      const teacher = await this.teacherService.createTeacher(teacherData, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile created successfully', 201);
    } catch (error: any) {
      if (error instanceof BadRequestError) {
        return ApiResponseHandler.error(res, error.message, 400);
      }
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.error(res, error.message, 404);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error creating teacher profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to create teacher profile');
    }
  };

  /**
   * GET /teachers/{teacherId}
   * Get teacher profile by ID
   */
  public getTeacher = async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = ValidationUtils.validateId(req.params.teacherId, 'Teacher ID');
      const user = req.user!;

      const teacher = await this.teacherService.getTeacherById(teacherId, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching teacher profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch teacher profile');
    }
  };

  /**
   * PUT /teachers/{teacherId}
   * Update teacher profile
   */
  public updateTeacher = async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = ValidationUtils.validateId(req.params.teacherId, 'Teacher ID');
      const teacherData = plainToInstance(UpdateTeacherDto, req.body);
      const user = req.user!;

      const teacher = await this.teacherService.updateTeacher(teacherId, teacherData, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile updated successfully');
    } catch (error: any) {
      if (error instanceof BadRequestError) {
        return ApiResponseHandler.error(res, error.message, 400);
      }
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error updating teacher profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to update teacher profile');
    }
  };
  
}
