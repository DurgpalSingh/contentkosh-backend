import { Teacher } from '@prisma/client';

export class TeacherMapper {
  /**
   * Transform teacher data to response format
   */
  static toResponse(teacher: Teacher): any {
    return {
      id: teacher.id,
      userId: teacher.userId,
      businessId: teacher.businessId,
      qualification: teacher.qualification,
      experienceYears: teacher.experienceYears,
      designation: teacher.designation,
      bio: teacher.bio,
      languages: teacher.languages,
      gender: teacher.gender,
      dob: teacher.dob,
      address: teacher.address,
      status: teacher.status,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
      createdBy: teacher.createdBy,
      updatedBy: teacher.updatedBy
    };
  }

  /**
   * Transform multiple teachers to response format
   */
  static toResponseArray(teachers: Teacher[]): any[] {
    return teachers.map(teacher => this.toResponse(teacher));
  }
}
