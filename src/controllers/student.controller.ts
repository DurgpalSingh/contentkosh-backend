import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';
import { StudentService } from '../services/student.service';
import { StudentMapper } from '../mappers/student.mapper';
import { AuthRequest } from '../dtos/auth.dto';

export class StudentController {
  private studentService: StudentService;

  constructor(studentService: StudentService) {
    this.studentService = studentService;
  }

  /**
   * POST /students/profile
   * Create a new student profile
   */
  public createStudent = async (req: AuthRequest, res: Response) => {
    try {
      const studentData = plainToInstance(CreateStudentDto, req.body);


      const user = req.user!;
      const student = await this.studentService.createStudent(studentData, user);
      ApiResponseHandler.success(res, StudentMapper.toResponse(student), 'Student profile created successfully', 201);
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
      logger.error(`Error creating student profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to create student profile');
    }
  };

  /**
   * GET /students/:studentId
   * Get student profile by ID
   */
  public getStudent = async (req: AuthRequest, res: Response) => {
    try {
      const studentId = ValidationUtils.validateId(req.params.studentId, 'Student ID');

      const user = req.user!;

      const student = await this.studentService.getStudentById(studentId, user);
      ApiResponseHandler.success(res, StudentMapper.toResponse(student), 'Student profile fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching student profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch student profile');
    }
  };

  /**
   * GET /students/user/:userId
   * Get student profile by user ID
   */
  public getStudentByUserId = async (req: AuthRequest, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');

      const user = req.user!;

      const student = await this.studentService.getStudentByUserId(userId, user);
      ApiResponseHandler.success(res, StudentMapper.toResponse(student), 'Student profile fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching student profile by userId: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch student profile');
    }
  };

  /**
   * PUT /students/:studentId
   * Update student profile
   */
  public updateStudent = async (req: AuthRequest, res: Response) => {
    try {
      const studentId = ValidationUtils.validateId(req.params.studentId, 'Student ID');
      const studentData = plainToInstance(UpdateStudentDto, req.body);

      const user = req.user!;
      const student = await this.studentService.updateStudent(studentId, studentData, user);
      ApiResponseHandler.success(res, StudentMapper.toResponse(student), 'Student profile updated successfully');
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
      logger.error(`Error updating student profile: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to update student profile');
    }
  };
}
