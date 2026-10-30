import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';
import { StudentService } from '../services/student.service';
import { StudentMapper } from '../mappers/student.mapper';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';

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
    } catch (error) {
      handleControllerError(res, error, 'Failed to create student profile', 'Error creating student profile');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch student profile', 'Error fetching student profile');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch student profile', 'Error fetching student profile by userId');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to update student profile', 'Error updating student profile');
    }
  };
}
