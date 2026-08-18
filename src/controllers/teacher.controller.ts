import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { ForbiddenError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';
import { TeacherService } from '../services/teacher.service';
import { TeacherMapper } from '../mappers/teacher.mapper';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';

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

      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      const user = req.user;
      const teacher = await this.teacherService.createTeacher(teacherData, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile created successfully', 201);
    } catch (error) {
      handleControllerError(res, error, 'Failed to create teacher profile', 'Error creating teacher profile');
    }
  };

  /**
   * GET /teachers/{teacherId}
   * Get teacher profile by ID
   */
  public getTeacher = async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = ValidationUtils.validateId(req.params.teacherId, 'Teacher ID');
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      const user = req.user;

      const teacher = await this.teacherService.getTeacherById(teacherId, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch teacher profile', 'Error fetching teacher profile');
    }
  };

  /**
   * GET /teachers/user/{userId}
   * Get teacher profile by user ID
   */
  public getTeacherByUserId = async (req: AuthRequest, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      const user = req.user;

      const teacher = await this.teacherService.getTeacherByUserId(userId, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch teacher profile', 'Error fetching teacher profile by userId');
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
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      const user = req.user;
      const teacher = await this.teacherService.updateTeacher(teacherId, teacherData, user);
      ApiResponseHandler.success(res, TeacherMapper.toResponse(teacher), 'Teacher profile updated successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to update teacher profile', 'Error updating teacher profile');
    }
  };

}
