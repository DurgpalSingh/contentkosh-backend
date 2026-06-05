import { Prisma, Teacher } from '@prisma/client';
import { prisma } from '../config/database';
import { USER_BASIC_SELECT } from '../dtos/user.dto';
import { businessBasicFromRow, queryTenantPublic, userBasicFromRow } from './crossSchema.repo';

const teacherDefaultInclude: Prisma.TeacherInclude = {
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

function toUncheckedCreate(data: Prisma.TeacherCreateInput): Prisma.TeacherUncheckedCreateInput {
  const raw = data as any;
  return {
    userId: raw.user?.connect?.id,
    businessId: raw.business?.connect?.id,
    qualification: raw.qualification,
    experienceYears: raw.experienceYears,
    designation: raw.designation,
    bio: raw.bio ?? null,
    languages: raw.languages ?? [],
    gender: raw.gender ?? null,
    dob: raw.dob ?? null,
    address: raw.address ?? null,
    status: raw.status,
    createdBy: raw.createdByUser?.connect?.id ?? null,
    updatedBy: raw.updatedByUser?.connect?.id ?? null,
  };
}

function toUncheckedUpdate(data: Prisma.TeacherUpdateInput): Prisma.TeacherUncheckedUpdateInput {
  const raw = data as any;
  const next: Prisma.TeacherUncheckedUpdateInput = { ...raw };
  if (raw.updatedByUser?.connect?.id) next.updatedBy = raw.updatedByUser.connect.id;
  delete (next as any).user;
  delete (next as any).business;
  delete (next as any).createdByUser;
  delete (next as any).updatedByUser;
  return next;
}

function mapTeacherRow(row: any): Teacher {
  return {
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id,
    qualification: row.qualification,
    experienceYears: row.experience_years,
    designation: row.designation,
    bio: row.bio,
    languages: row.languages ?? [],
    gender: row.gender,
    dob: row.date_of_birth,
    address: row.address,
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

async function findTeacherWithPublicRelations(whereSql: string, businessId: number, ...params: unknown[]) {
  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      SELECT
        t.*,
        u.id AS user_id, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
        u.role AS user_role, u.profile_picture AS user_profile_picture,
        b.id AS business_id, b.institute_name AS business_institute_name,
        cu.id AS created_by_user_id, cu.name AS created_by_user_name, cu.email AS created_by_user_email,
        cu.mobile AS created_by_user_mobile, cu.role AS created_by_user_role, cu.profile_picture AS created_by_user_profile_picture,
        uu.id AS updated_by_user_id, uu.name AS updated_by_user_name, uu.email AS updated_by_user_email,
        uu.mobile AS updated_by_user_mobile, uu.role AS updated_by_user_role, uu.profile_picture AS updated_by_user_profile_picture
      FROM ${schema}.teachers t
      JOIN public.users u ON u.id = t.user_id
      JOIN public.business b ON b.id = t.business_id
      LEFT JOIN public.users cu ON cu.id = t.created_by
      LEFT JOIN public.users uu ON uu.id = t.updated_by
      WHERE ${whereSql}
      ORDER BY t.created_at DESC
    `,
    ...params,
  );
  return rows.map(mapTeacherRow);
}

export interface TeacherFindOptions {
  where?: Prisma.TeacherWhereInput;
  orderBy?: Prisma.TeacherOrderByWithRelationInput;
  skip?: number;
  take?: number;
  include?: Prisma.TeacherInclude;
  select?: Prisma.TeacherSelect;
}

export const createTeacher = async (
  data: Prisma.TeacherCreateInput,
  options: { include?: Prisma.TeacherInclude; select?: Prisma.TeacherSelect } = {}
): Promise<Teacher> => {
  const created = await prisma.teacher.create({
    data: toUncheckedCreate(data) as any,
    ...(options.select ? { select: options.select } : {}),
  });
  if (options.select) return created as Teacher;
  return (await findTeacherById((created as Teacher).id, options)) ?? (created as Teacher);
};

export const findTeacherById = async (
  id: number,
  options: Pick<TeacherFindOptions, 'include' | 'select'> = {}
): Promise<Teacher | null> => {
  if (options.select) {
    return await prisma.teacher.findUnique({
      where: { id },
      select: options.select
    });
  }

  if (options.include && options.include !== teacherDefaultInclude) {
    return await prisma.teacher.findUnique({ where: { id }, include: options.include });
  }

  const base = await prisma.teacher.findUnique({ where: { id }, select: { businessId: true } });
  if (!base) return null;
  const rows = await findTeacherWithPublicRelations('t.id = $1', base.businessId, id);
  return rows[0] ?? null;
};

export const findTeacherByUserId = async (
  userId: number,
  options: Pick<TeacherFindOptions, 'include' | 'select'> = {}
): Promise<Teacher | null> => {
  if (options.select) {
    return await prisma.teacher.findUnique({
      where: { userId },
      select: options.select
    });
  }

  if (options.include && options.include !== teacherDefaultInclude) {
    return await prisma.teacher.findUnique({ where: { userId }, include: options.include });
  }

  const user = await prisma.teacher.findUnique({ where: { userId }, select: { businessId: true } });
  if (!user) return null;
  const rows = await findTeacherWithPublicRelations('t.user_id = $1', user.businessId, userId);
  return rows[0] ?? null;
};

export const findTeachersByBusinessId = async (
  businessId: number,
  options: TeacherFindOptions = {}
): Promise<Teacher[]> => {
  const where: Prisma.TeacherWhereInput = {
    businessId,
    ...options.where
  };

  if (options.select) {
    return await prisma.teacher.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      select: options.select
    });
  }

  if (options.include && options.include !== teacherDefaultInclude) {
    return await prisma.teacher.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      include: options.include
    });
  }

  const rows = await findTeacherWithPublicRelations('t.business_id = $1', businessId, businessId);
  return rows.slice(options.skip ?? 0, options.take !== undefined ? (options.skip ?? 0) + options.take : undefined);
};

export const updateTeacher = async (
  id: number,
  data: Prisma.TeacherUpdateInput,
  options: { include?: Prisma.TeacherInclude; select?: Prisma.TeacherSelect } = {}
): Promise<Teacher> => {
  const updated = await prisma.teacher.update({
    where: { id },
    data: toUncheckedUpdate(data) as any,
    ...(options.select ? { select: options.select } : {}),
  });
  if (options.select) return updated as Teacher;
  return (await findTeacherById(id, options)) ?? (updated as Teacher);
};

export const deleteTeacher = async (id: number): Promise<void> => {
  await prisma.teacher.delete({
    where: { id }
  });
};

export const checkTeacherExists = async (teacherId: number): Promise<boolean> => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId }
  });
  return !!teacher;
};
