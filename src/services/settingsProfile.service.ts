import { Gender, UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { UpdateSettingsProfileDto, SettingsUserDetailsDto, SettingsProfileDetailsDto, BusinessDetailsDto } from '../dtos/settingsProfile.dto';
import * as userRepo from '../repositories/user.repo';
import * as teacherRepo from '../repositories/teacher.repo';
import * as studentRepo from '../repositories/student.repo';
import * as businessRepo from '../repositories/business.repo';
import * as settingsProfileRepo from '../repositories/settingsProfile.repo';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import logger from '../utils/logger';
import { TeacherMapper } from '../mappers/teacher.mapper';
import { StudentMapper } from '../mappers/student.mapper';
import { UpdateTeacherDto } from '../dtos/teacher.dto';
import { UpdateStudentDto } from '../dtos/student.dto';


export class SettingsProfileService {
  async getProfile(currentUser: IUser) {
    logger.info('Settings profile fetch requested', { userId: currentUser.id, role: currentUser.role });

    // Reuse existing repo/service functions rather than a custom combined repo call
    const user = await userRepo.findPublicById(currentUser.id);
    if (!user) {
      logger.warn('Settings profile fetch failed - user not found', { userId: currentUser.id });
      throw new NotFoundError('User profile not found');
    }

    // Attach full business / teacher / student details where applicable
    let business = null;
    let teacher = null;
    let student = null;

    if (user.businessId) {
      business = await businessRepo.findBusinessById(Number(user.businessId));
    }

    if (currentUser.role === UserRole.TEACHER) {
      teacher = await teacherRepo.findTeacherByUserId(currentUser.id);
    }

    if (currentUser.role === UserRole.STUDENT) {
      student = await studentRepo.findStudentByUserId(currentUser.id);
    }

    const profile = {
      ...user,
      business,
      teacher,
      student
    };

    logger.info('Settings profile fetch success', { userId: currentUser.id });
    return profile;
  }

  async updateProfile(
    currentUser: IUser,
    payload: UpdateSettingsProfileDto
  ) {
    logger.info('Settings profile update requested', {
      userId: currentUser.id,
      role: currentUser.role,
      hasUserDetails: Boolean(payload.userDetails),
      hasProfileDetails: Boolean(payload.profileDetails),
      hasBusinessDetails: Boolean(payload.businessDetails),
    });

    const existing = await userRepo.findPublicById(currentUser.id);
    if (!existing) {
      logger.warn('Settings profile update rejected - user not found', { userId: currentUser.id });
      throw new NotFoundError('User profile not found');
    }

    if (payload.userDetails) {
      const details = payload.userDetails as SettingsUserDetailsDto;
      // DTO validation is handled in route middleware; directly map allowed fields
      const userUpdate: Record<string, unknown> = {};
      if (details.name !== undefined) userUpdate.name = details.name;
      if (details.mobile !== undefined) userUpdate.mobile = details.mobile;
      if (details.profilePicture !== undefined) userUpdate.profilePicture = details.profilePicture;
      if (Object.keys(userUpdate).length > 0) {
        await userRepo.updateUser(currentUser.id, userUpdate);
        logger.info('Settings profile user details updated', { userId: currentUser.id });
      }
    }

    // Collect updates to run in a single transaction
    let userUpdateData: Record<string, unknown> | null = null;
    if (payload.userDetails) {
      const details = payload.userDetails as SettingsUserDetailsDto;
      userUpdateData = {};
      if (details.name !== undefined) userUpdateData.name = details.name;
      if (details.mobile !== undefined) userUpdateData.mobile = details.mobile;
      if (details.profilePicture !== undefined) userUpdateData.profilePicture = details.profilePicture;
      if (Object.keys(userUpdateData).length === 0) userUpdateData = null;
    }

    let teacherId: number | undefined;
    let teacherUpdateData: any | undefined;
    if (payload.profileDetails && currentUser.role === UserRole.TEACHER) {
      const teacher = await teacherRepo.findTeacherByUserId(currentUser.id);
      if (!teacher) {
        logger.warn('Settings profile teacher update rejected - teacher not found', { userId: currentUser.id });
        throw new NotFoundError('Teacher profile not found');
      }

      const details = payload.profileDetails as SettingsProfileDetailsDto;
      const updateTeacherDto: UpdateTeacherDto = {} as any;
      const professional: Record<string, any> = {};
      const personal: Record<string, any> = {};
      if (details.qualification !== undefined) professional.qualification = details.qualification;
      if (details.experienceYears !== undefined) professional.experienceYears = details.experienceYears;
      if (details.designation !== undefined) professional.designation = details.designation;
      if (details.bio !== undefined) professional.bio = details.bio;
      if (details.languages !== undefined) professional.languages = details.languages;

      if (details.gender !== undefined) personal.gender = details.gender;
      if (details.dob !== undefined) personal.dob = details.dob;
      if (details.address !== undefined) personal.address = details.address;

      if (Object.keys(professional).length > 0) (updateTeacherDto as any).professional = professional;
      if (Object.keys(personal).length > 0) (updateTeacherDto as any).personal = personal;

      const updateData = TeacherMapper.toUpdateInput(updateTeacherDto, currentUser.id);
      await teacherRepo.updateTeacher(teacher.id, updateData);
      logger.info('Settings profile teacher details updated', { userId: currentUser.id, teacherId: teacher.id });
    }

    let studentId: number | undefined;
    let studentUpdateData: any | undefined;
    if (payload.profileDetails && currentUser.role === UserRole.STUDENT) {
      const student = await studentRepo.findStudentByUserId(currentUser.id);
      if (!student) {
        logger.warn('Settings profile student update rejected - student not found', { userId: currentUser.id });
        throw new NotFoundError('Student profile not found');
      }

      const details = payload.profileDetails as SettingsProfileDetailsDto;
      const updateStudentDto: UpdateStudentDto = {} as any;
      if (details.gender !== undefined) (updateStudentDto as any).gender = details.gender;
      if (details.dob !== undefined) (updateStudentDto as any).dob = details.dob;
      if (details.languages !== undefined) (updateStudentDto as any).languages = details.languages;
      if (details.address !== undefined) (updateStudentDto as any).address = details.address;
      if (details.city !== undefined) (updateStudentDto as any).city = details.city;
      if (details.bio !== undefined) (updateStudentDto as any).bio = details.bio;

      const updateData = StudentMapper.toUpdateInput(updateStudentDto, currentUser.id);
      await studentRepo.updateStudent(student.id, updateData);
      logger.info('Settings profile student details updated', { userId: currentUser.id, studentId: student.id });
    }

    let businessId: number | undefined;
    let businessUpdateData: Record<string, unknown> | undefined;
    if (payload.businessDetails) {
      if (currentUser.role !== UserRole.ADMIN) {
        logger.warn('Settings profile business update rejected for non-admin', { userId: currentUser.id, role: currentUser.role });
        throw new ForbiddenError('Only admin can update business details');
      }
      businessId = Number(existing.businessId);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        logger.warn('Settings profile business update rejected due to missing business', { userId: currentUser.id });
        throw new BadRequestError('Admin user does not belong to a business');
      }

      const details = payload.businessDetails as BusinessDetailsDto;
      // Directly map allowed business fields (validation done by DTO middleware)
      const businessUpdate: Record<string, unknown> = {};
      if (details.instituteName !== undefined) businessUpdate.instituteName = details.instituteName;
      if (details.tagline !== undefined) businessUpdate.tagline = details.tagline ?? null;
      if (details.contactNumber !== undefined) businessUpdate.contactNumber = details.contactNumber ?? null;
      if (details.email !== undefined) businessUpdate.email = details.email ?? null;
      if (details.address !== undefined) businessUpdate.address = details.address ?? null;
      if (details.logo !== undefined) businessUpdate.logo = details.logo ?? null;

      if (Object.keys(businessUpdate).length > 0) {
        await businessRepo.updateBusiness(businessId, businessUpdate as any);
        logger.info('Settings profile business details updated', { userId: currentUser.id, businessId });
      }
    }

    // Execute all pending updates inside a single transaction
    try {
      await settingsProfileRepo.updateProfileTransaction({
        userId: currentUser.id,
        userUpdate: userUpdateData ?? undefined,
        teacherId: teacherId ?? undefined,
        teacherUpdate: teacherUpdateData ?? undefined,
        studentId: studentId ?? undefined,
        studentUpdate: studentUpdateData ?? undefined,
        businessId: businessId ?? undefined,
        businessUpdate: businessUpdateData ?? undefined,
      });
    } catch (err) {
      logger.error('Settings profile transaction failed', { userId: currentUser.id, err });
      throw err;
    }

    // Log what actually ran
    if (userUpdateData) logger.info('Settings profile user details updated', { userId: currentUser.id });
    if (teacherUpdateData) logger.info('Settings profile teacher details updated', { userId: currentUser.id, teacherId });
    if (studentUpdateData) logger.info('Settings profile student details updated', { userId: currentUser.id, studentId });
    if (businessUpdateData) logger.info('Settings profile business details updated', { userId: currentUser.id, businessId });

    logger.info('Settings profile update completed', { userId: currentUser.id });
    return this.getProfile(currentUser);
  }
}
