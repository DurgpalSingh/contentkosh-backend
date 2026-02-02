import { Teacher, Prisma, TeacherStatus } from '@prisma/client';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';

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

  /**
   * Transform API input DTO to Prisma create input
   */
  static toCreateInput(data: CreateTeacherDto, createdByUserId?: number): Prisma.TeacherCreateInput {
    return {
      user: { connect: { id: data.userId } },
      business: { connect: { id: data.businessId } },
      qualification: data.professional.qualification,
      experienceYears: data.professional.experienceYears,
      designation: data.professional.designation,
      bio: data.professional.bio ?? null,
      languages: data.professional.languages || [],
      gender: data.personal?.gender ?? null,
      dob: data.personal?.dob ? new Date(data.personal.dob) : null,
      address: data.personal?.address ?? null,
      status: TeacherStatus.ACTIVE,
      ...(createdByUserId && { createdByUser: { connect: { id: createdByUserId } } })
    };
  }

  /**
   * Transform API update DTO to Prisma update input
   */
  static toUpdateInput(data: UpdateTeacherDto, updatedByUserId?: number): Prisma.TeacherUpdateInput {
    return {
      ...(data.professional && {
        qualification: data.professional.qualification,
        experienceYears: data.professional.experienceYears,
        designation: data.professional.designation,
        bio: data.professional.bio ?? null,
        languages: data.professional.languages
      }),
      ...(data.personal && {
        gender: data.personal.gender ?? null,
        dob: data.personal.dob ? new Date(data.personal.dob) : null,
        address: data.personal.address ?? null
      }),
      ...(data.status && { status: data.status }),
      ...(updatedByUserId && { updatedByUser: { connect: { id: updatedByUserId } } }),
      updatedAt: new Date()
    };
  }
}
