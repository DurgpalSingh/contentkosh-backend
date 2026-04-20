import { Student, Prisma, StudentStatus, User } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';

export class StudentMapper {
  /**
   * Transform student data to response format
   */
  static toResponse(student: Student & { user?: User }): any {
    return {
      id: student.id,
      userId: student.userId,
      businessId: student.businessId,
      dob: student.dob,
      gender: student.gender,
      languages: student.languages,
      address: student.address,
      city: student.city,
      bio: student.bio,
      status: student.status,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      createdBy: student.createdBy,
      updatedBy: student.updatedBy,
      ...(student.user && {
        user: {
          id: student.user.id,
          name: student.user.name,
          email: student.user.email,
          mobile: student.user.mobile,
          role: student.user.role
        }
      })
    };
  }

  /**
   * Transform API input DTO to Prisma create input
   */
  static toCreateInput(data: CreateStudentDto, createdByUserId?: number): Prisma.StudentCreateInput {
    return {
      user: { connect: { id: data.userId } },
      business: { connect: { id: data.businessId } },
      dob: data.dob ? new Date(data.dob) : null,
      gender: data.gender ?? null,
      languages: data.languages || [],
      address: data.address ?? null,
      city: data.city ?? null,
      bio: data.bio ?? null,
      status: StudentStatus.ACTIVE,
      ...(createdByUserId && { createdByUser: { connect: { id: createdByUserId } } })
    };
  }

  /**
   * Transform API update DTO to Prisma update input
   */
  static toUpdateInput(data: UpdateStudentDto, updatedByUserId?: number): Prisma.StudentUpdateInput {
    return {
      ...('dob' in data && { dob: data.dob ? new Date(data.dob) : null }),
      ...('gender' in data && { gender: data.gender ?? null }),
      ...('languages' in data && { languages: data.languages }),
      ...('address' in data && { address: data.address ?? null }),
      ...('city' in data && { city: data.city ?? null }),
      ...('bio' in data && { bio: data.bio ?? null }),
      ...('status' in data && { status: data.status }),
      ...(updatedByUserId && { updatedByUser: { connect: { id: updatedByUserId } } }),
      updatedAt: new Date()
    };
  }
}
