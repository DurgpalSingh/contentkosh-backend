import { Gender, UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { UpdateSettingsProfileDto } from '../dtos/settingsProfile.dto';
import * as userRepo from '../repositories/user.repo';
import * as teacherRepo from '../repositories/teacher.repo';
import * as studentRepo from '../repositories/student.repo';
import * as businessRepo from '../repositories/business.repo';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import logger from '../utils/logger';

const parseLanguages = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return undefined;
};

const parseGender = (value: unknown): Gender | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value === Gender.male || value === Gender.female || value === Gender.other) {
    return value as Gender;
  }
  throw new BadRequestError('Gender must be one of: male, female, other');
};

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

    const existing = await userRepo.findSettingsProfileByUserId(currentUser.id);
    if (!existing) throw new NotFoundError('User profile not found');

    if (payload.userDetails) {
      const userUpdate: Record<string, unknown> = {};
      if (typeof payload.userDetails.name === 'string') userUpdate.name = payload.userDetails.name;
      if (typeof payload.userDetails.mobile === 'string') userUpdate.mobile = payload.userDetails.mobile;
      if (payload.userDetails.profilePicture === null || typeof payload.userDetails.profilePicture === 'string') {
        userUpdate.profilePicture = payload.userDetails.profilePicture;
      }
      if (Object.keys(userUpdate).length > 0) {
        await userRepo.updateUser(currentUser.id, userUpdate);
        logger.info('Settings profile user details updated', { userId: currentUser.id });
      }
    }

    if (payload.profileDetails && currentUser.role === UserRole.TEACHER) {
      const teacher = await teacherRepo.findTeacherByUserId(currentUser.id);
      if (!teacher) throw new NotFoundError('Teacher profile not found');

      const teacherUpdate: Record<string, unknown> = {};
      const details = payload.profileDetails;
      if (details.qualification !== undefined) teacherUpdate.qualification = details.qualification;
      if (details.experienceYears !== undefined) teacherUpdate.experienceYears = Number(details.experienceYears);
      if (details.designation !== undefined) teacherUpdate.designation = details.designation;
      if (details.bio !== undefined) teacherUpdate.bio = details.bio || null;
      const languages = parseLanguages(details.languages);
      if (languages !== undefined) teacherUpdate.languages = languages;
      if (details.gender !== undefined) teacherUpdate.gender = parseGender(details.gender);
      if (details.dob !== undefined) teacherUpdate.dob = details.dob ? new Date(String(details.dob)) : null;
      if (details.address !== undefined) teacherUpdate.address = details.address || null;

      if (Object.keys(teacherUpdate).length > 0) {
        await teacherRepo.updateTeacher(teacher.id, teacherUpdate);
        logger.info('Settings profile teacher details updated', { userId: currentUser.id, teacherId: teacher.id });
      }
    }

    if (payload.profileDetails && currentUser.role === UserRole.STUDENT) {
      const student = await studentRepo.findStudentByUserId(currentUser.id);
      if (!student) throw new NotFoundError('Student profile not found');

      const studentUpdate: Record<string, unknown> = {};
      const details = payload.profileDetails;
      if (details.gender !== undefined) studentUpdate.gender = parseGender(details.gender);
      if (details.dob !== undefined) studentUpdate.dob = details.dob ? new Date(String(details.dob)) : null;
      const languages = parseLanguages(details.languages);
      if (languages !== undefined) studentUpdate.languages = languages;
      if (details.address !== undefined) studentUpdate.address = details.address || null;
      if (details.city !== undefined) studentUpdate.city = details.city || null;
      if (details.bio !== undefined) studentUpdate.bio = details.bio || null;

      if (Object.keys(studentUpdate).length > 0) {
        await studentRepo.updateStudent(student.id, studentUpdate);
        logger.info('Settings profile student details updated', { userId: currentUser.id, studentId: student.id });
      }
    }

    if (payload.businessDetails) {
      if (currentUser.role !== UserRole.ADMIN) {
        logger.warn('Settings profile business update rejected for non-admin', { userId: currentUser.id, role: currentUser.role });
        throw new ForbiddenError('Only admin can update business details');
      }
      const businessId = Number(existing.businessId);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        logger.warn('Settings profile business update rejected due to missing business', { userId: currentUser.id });
        throw new BadRequestError('Admin user does not belong to a business');
      }

      const businessUpdate: Record<string, unknown> = {};
      const details = payload.businessDetails;
      if (details?.instituteName !== undefined) businessUpdate.instituteName = details.instituteName;
      if (details?.tagline !== undefined) businessUpdate.tagline = details.tagline || null;
      if (details?.contactNumber !== undefined) businessUpdate.contactNumber = details.contactNumber || null;
      if (details?.email !== undefined) businessUpdate.email = details.email || null;
      if (details?.address !== undefined) businessUpdate.address = details.address || null;
      if (details?.logo !== undefined) businessUpdate.logo = details.logo || null;

      if (Object.keys(businessUpdate).length > 0) {
        await businessRepo.updateBusiness(businessId, businessUpdate);
        logger.info('Settings profile business details updated', { userId: currentUser.id, businessId });
      }
    }

    logger.info('Settings profile update completed', { userId: currentUser.id });
    return this.getProfile(currentUser);
  }
}
