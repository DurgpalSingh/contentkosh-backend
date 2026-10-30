import { Prisma, Student } from '@prisma/client';
import { prisma } from '../config/database';
import { USER_BASIC_SELECT } from '../dtos/user.dto';
import { businessBasicFromRow, queryTenantPublic, userBasicFromRow } from './crossSchema.repo';

const studentDefaultInclude: Prisma.StudentInclude = {
  user: {
    select: USER_BASIC_SELECT
  },
  business: {
    select: {
      id: true,
      instituteName: true
    }
  },
  createdByUser: {
    select: USER_BASIC_SELECT
  },
  updatedByUser: {
    select: USER_BASIC_SELECT
  }
};

function toUncheckedCreate(data: Prisma.StudentCreateInput): Prisma.StudentUncheckedCreateInput {
  const raw = data as any;
  return {
    userId: raw.user?.connect?.id,
    businessId: raw.business?.connect?.id,
    dob: raw.dob ?? null,
    gender: raw.gender ?? null,
    languages: raw.languages ?? [],
    address: raw.address ?? null,
    city: raw.city ?? null,
    bio: raw.bio ?? null,
    status: raw.status,
    createdBy: raw.createdByUser?.connect?.id ?? null,
    updatedBy: raw.updatedByUser?.connect?.id ?? null,
  };
}

function toUncheckedUpdate(data: Prisma.StudentUpdateInput): Prisma.StudentUncheckedUpdateInput {
  const raw = data as any;
  const next: Prisma.StudentUncheckedUpdateInput = { ...raw };
  if (raw.updatedByUser?.connect?.id) next.updatedBy = raw.updatedByUser.connect.id;
  delete (next as any).user;
  delete (next as any).business;
  delete (next as any).createdByUser;
  delete (next as any).updatedByUser;
  return next;
}

function mapStudentRow(row: any): Student {
  return {
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id,
    dob: row.date_of_birth,
    gender: row.gender,
    languages: row.languages ?? [],
    address: row.address,
    city: row.city,
    bio: row.bio,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: userBasicFromRow(row, 'user'),
    business: businessBasicFromRow(row),
    createdByUser: userBasicFromRow(row, 'created_by_user'),
    updatedByUser: userBasicFromRow(row, 'updated_by_user'),
  } as any;
}

async function findStudentWithPublicRelations(whereSql: string, businessId: number, ...params: unknown[]) {
  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      SELECT
        s.*,
        u.id AS user_id, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
        u.role AS user_role, u.profile_picture AS user_profile_picture,
        b.id AS business_id, b.institute_name AS business_institute_name,
        cu.id AS created_by_user_id, cu.name AS created_by_user_name, cu.email AS created_by_user_email,
        cu.mobile AS created_by_user_mobile, cu.role AS created_by_user_role, cu.profile_picture AS created_by_user_profile_picture,
        uu.id AS updated_by_user_id, uu.name AS updated_by_user_name, uu.email AS updated_by_user_email,
        uu.mobile AS updated_by_user_mobile, uu.role AS updated_by_user_role, uu.profile_picture AS updated_by_user_profile_picture
      FROM ${schema}.students s
      JOIN public.users u ON u.id = s.user_id
      JOIN public.business b ON b.id = s.business_id
      LEFT JOIN public.users cu ON cu.id = s.created_by
      LEFT JOIN public.users uu ON uu.id = s.updated_by
      WHERE ${whereSql}
      ORDER BY s.created_at DESC
    `,
    ...params,
  );
  return rows.map(mapStudentRow);
}

export interface StudentFindOptions {
  where?: Prisma.StudentWhereInput;
  orderBy?: Prisma.StudentOrderByWithRelationInput;
  skip?: number;
  take?: number;
  include?: Prisma.StudentInclude;
  select?: Prisma.StudentSelect;
}

export const createStudent = async (
  data: Prisma.StudentCreateInput,
  options: { include?: Prisma.StudentInclude; select?: Prisma.StudentSelect } = {}
): Promise<Student> => {
  const created = await prisma.student.create({
    data: toUncheckedCreate(data) as any,
    ...(options.select ? { select: options.select } : {}),
  });
  if (options.select) return created as Student;
  return (await findStudentById((created as Student).id, options)) ?? (created as Student);
};

export const findStudentById = async (
  id: number,
  options: Pick<StudentFindOptions, 'include' | 'select'> = {}
): Promise<Student | null> => {
  if (options.select) {
    return await prisma.student.findUnique({
      where: { id },
      select: options.select
    });
  }

  if (options.include && options.include !== studentDefaultInclude) {
    return await prisma.student.findUnique({ where: { id }, include: options.include });
  }

  const base = await prisma.student.findUnique({ where: { id }, select: { businessId: true } });
  if (!base) return null;
  const rows = await findStudentWithPublicRelations('s.id = $1', base.businessId, id);
  return rows[0] ?? null;
};

export const findStudentByUserId = async (
  userId: number,
  options: Pick<StudentFindOptions, 'include' | 'select'> = {}
): Promise<Student | null> => {
  if (options.select) {
    return await prisma.student.findUnique({
      where: { userId },
      select: options.select
    });
  }

  if (options.include && options.include !== studentDefaultInclude) {
    return await prisma.student.findUnique({ where: { userId }, include: options.include });
  }

  const base = await prisma.student.findUnique({ where: { userId }, select: { businessId: true } });
  if (!base) return null;
  const rows = await findStudentWithPublicRelations('s.user_id = $1', base.businessId, userId);
  return rows[0] ?? null;
};

export const findStudentsByBusinessId = async (
  businessId: number,
  options: StudentFindOptions = {}
): Promise<Student[]> => {
  const where: Prisma.StudentWhereInput = {
    businessId,
    ...options.where
  };

  if (options.select) {
    return await prisma.student.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      select: options.select
    });
  }

  if (options.include && options.include !== studentDefaultInclude) {
    return await prisma.student.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      include: options.include
    });
  }

  const rows = await findStudentWithPublicRelations('s.business_id = $1', businessId, businessId);
  return rows.slice(options.skip ?? 0, options.take !== undefined ? (options.skip ?? 0) + options.take : undefined);
};

export const updateStudent = async (
  id: number,
  data: Prisma.StudentUpdateInput,
  options: { include?: Prisma.StudentInclude; select?: Prisma.StudentSelect } = {}
): Promise<Student> => {
  const updated = await prisma.student.update({
    where: { id },
    data: toUncheckedUpdate(data) as any,
    ...(options.select ? { select: options.select } : {}),
  });
  if (options.select) return updated as Student;
  return (await findStudentById(id, options)) ?? (updated as Student);
};

export const checkStudentExists = async (studentId: number): Promise<boolean> => {
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });
  return !!student;
};
