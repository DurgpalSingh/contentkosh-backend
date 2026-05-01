import {  UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { UpdateSettingsProfileDto} from '../dtos/settingsProfile.dto';
import * as userRepo from '../repositories/user.repo';
import * as teacherRepo from '../repositories/teacher.repo';
import * as studentRepo from '../repositories/student.repo';
import * as settingsProfileRepo from '../repositories/settingsProfile.repo';
import { buildSettingsProfileUpdateInputs } from '../mappers/settingsProfile.mapper';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import logger from '../utils/logger';


export class SettingsProfileService {
  async getProfile(currentUser: IUser) {
    logger.info('Settings profile fetch requested', { userId: currentUser.id, role: currentUser.role });
    const profile = await userRepo.findSettingsProfileByUserId(currentUser.id);
    if (!profile) throw new NotFoundError('User profile not found');
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

    // Build update inputs via mapper (keeps Prisma types out of service)
    if (payload.businessDetails && currentUser.role !== UserRole.ADMIN) {
      logger.warn('Settings profile business update rejected for non-admin', { userId: currentUser.id, role: currentUser.role });
      throw new ForbiddenError('Only admin can update business details');
    }

    const { userUpdate, teacherUpdate, studentUpdate, businessUpdate } = buildSettingsProfileUpdateInputs(payload);

    // validate existence of teacher/student/business if updates requested (service-level checks only)
    let teacherId: number | undefined;
    let teacherUpdateToApply = teacherUpdate;
    if (teacherUpdate && currentUser.role === UserRole.TEACHER) {
      const teacher = await teacherRepo.findTeacherByUserId(currentUser.id);
      if (!teacher) {
        logger.warn('Settings profile teacher update rejected - teacher not found', { userId: currentUser.id });
        throw new NotFoundError('Teacher profile not found');
      }
      teacherId = teacher.id;
      logger.info('Settings profile teacher details prepared for update', { userId: currentUser.id, teacherId });
    } else {
      teacherUpdateToApply = undefined;
    }

    let studentId: number | undefined;
    let studentUpdateToApply = studentUpdate;
    if (studentUpdate && currentUser.role === UserRole.STUDENT) {
      const student = await studentRepo.findStudentByUserId(currentUser.id);
      if (!student) {
        logger.warn('Settings profile student update rejected - student not found', { userId: currentUser.id });
        throw new NotFoundError('Student profile not found');
      }
      studentId = student.id;
      logger.info('Settings profile student details prepared for update', { userId: currentUser.id, studentId });
    } else {
      studentUpdateToApply = undefined;
    }

    let businessId: number | undefined;
    let businessUpdateToApply = businessUpdate;
    if (businessUpdate) {
      businessId = Number(existing.businessId);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        logger.warn('Settings profile business update rejected due to missing business', { userId: currentUser.id });
        throw new BadRequestError('Admin user does not belong to a business');
      }
      logger.info('Settings profile business details prepared for update', { userId: currentUser.id, businessId });
    }

    // Execute all pending updates inside a single transaction
    try {
      await settingsProfileRepo.updateProfileTransaction({
        userId: currentUser.id,
        userUpdate: userUpdate ?? undefined,
        teacherId: teacherId ?? undefined,
        teacherUpdate: teacherUpdateToApply ?? undefined,
        studentId: studentId ?? undefined,
        studentUpdate: studentUpdateToApply ?? undefined,
        businessId: businessId ?? undefined,
        businessUpdate: businessUpdateToApply ?? undefined,
      });
    } catch (err) {
      logger.error('Settings profile transaction failed', { userId: currentUser.id, err });
      throw err;
    }

    // Log what actually ran
    if (userUpdate) logger.info('Settings profile user details updated', { userId: currentUser.id });

    logger.info('Settings profile update completed', { userId: currentUser.id });
    return this.getProfile(currentUser);
  }
}
