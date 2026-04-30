import { Prisma } from '@prisma/client';
import { UpdateSettingsProfileDto } from '../dtos/settingsProfile.dto';
import { pickDefined } from '../utils/objectUtils';
import { TEACHER_PROFESSIONAL_FIELDS, TEACHER_PERSONAL_FIELDS, STUDENT_UPDATE_FIELDS, USER_UPDATE_FIELDS, BUSINESS_UPDATE_FIELDS } from '../constants/fields';
import { UpdateTeacherDto } from '../dtos/teacher.dto';
import { UpdateStudentDto } from '../dtos/student.dto';
import { TeacherMapper } from './teacher.mapper';
import { StudentMapper } from './student.mapper';

export interface SettingsProfileUpdatePayload {
  userUpdate?: Record<string, unknown> | null;
  teacherUpdate?: Prisma.TeacherUpdateInput | null;
  studentUpdate?: Prisma.StudentUpdateInput | null;
  businessUpdate?: Prisma.BusinessUpdateInput | null;
}

export function buildSettingsProfileUpdateInputs(payload: UpdateSettingsProfileDto): SettingsProfileUpdatePayload {
  const result: SettingsProfileUpdatePayload = {};

  if (payload.userDetails) {
    const userPicked = pickDefined(payload.userDetails as any, USER_UPDATE_FIELDS as readonly (keyof typeof payload.userDetails)[]);
    if (userPicked && Object.keys(userPicked).length > 0) result.userUpdate = userPicked as Record<string, unknown>;
  }

  if (payload.profileDetails) {
    const prof = pickDefined(payload.profileDetails as any, TEACHER_PROFESSIONAL_FIELDS as readonly (keyof typeof payload.profileDetails)[]);
    const personal = pickDefined(payload.profileDetails as any, TEACHER_PERSONAL_FIELDS as readonly (keyof typeof payload.profileDetails)[]);
    const updateTeacherDto: UpdateTeacherDto = {};
    if (prof && Object.keys(prof).length > 0) updateTeacherDto.professional = prof as any;
    if (personal && Object.keys(personal).length > 0) updateTeacherDto.personal = personal as any;
    if (Object.keys(updateTeacherDto).length > 0) {
      result.teacherUpdate = TeacherMapper.toUpdateInput(updateTeacherDto);
    }

    // student update inputs (same payload structure used for students)
    const studentPicked = pickDefined(payload.profileDetails as any, STUDENT_UPDATE_FIELDS as readonly (keyof typeof payload.profileDetails)[]);
    if (studentPicked && Object.keys(studentPicked).length > 0) {
      const updateStudentDto: UpdateStudentDto = studentPicked as unknown as UpdateStudentDto;
      result.studentUpdate = StudentMapper.toUpdateInput(updateStudentDto);
    }
  }

  if (payload.businessDetails) {
    const businessPicked = pickDefined(payload.businessDetails as any, BUSINESS_UPDATE_FIELDS as readonly (keyof typeof payload.businessDetails)[]);
    if (businessPicked && Object.keys(businessPicked).length > 0) result.businessUpdate = businessPicked as Prisma.BusinessUpdateInput;
  }

  return result;
}

export default buildSettingsProfileUpdateInputs;
