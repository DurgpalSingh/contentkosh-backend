export const USER_UPDATE_FIELDS = ['name', 'mobile', 'profilePicture'] as const;
export const TEACHER_PROFESSIONAL_FIELDS = [
  'qualification',
  'experienceYears',
  'designation',
  'bio',
  'languages',
] as const;
export const TEACHER_PERSONAL_FIELDS = ['gender', 'dob', 'address'] as const;
export const STUDENT_UPDATE_FIELDS = ['gender', 'dob', 'languages', 'address', 'city', 'bio'] as const;
export const BUSINESS_UPDATE_FIELDS = ['instituteName', 'tagline', 'contactNumber', 'email', 'address', 'logo'] as const;

export type UserUpdateField = typeof USER_UPDATE_FIELDS[number];
export type TeacherProfessionalField = typeof TEACHER_PROFESSIONAL_FIELDS[number];
export type TeacherPersonalField = typeof TEACHER_PERSONAL_FIELDS[number];
export type StudentUpdateField = typeof STUDENT_UPDATE_FIELDS[number];
export type BusinessUpdateField = typeof BUSINESS_UPDATE_FIELDS[number];

export const MSG = {
  USER_PROFILE_NOT_FOUND: 'User profile not found',
  TEACHER_PROFILE_NOT_FOUND: 'Teacher profile not found',
  STUDENT_PROFILE_NOT_FOUND: 'Student profile not found',
  ONLY_ADMIN_CAN_UPDATE_BUSINESS: 'Only admin can update business details',
  ADMIN_USER_NO_BUSINESS: 'Admin user does not belong to a business',
} as const;
