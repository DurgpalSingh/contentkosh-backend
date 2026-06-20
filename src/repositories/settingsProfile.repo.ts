import { Prisma } from '@prisma/client';
import { publicPrisma } from '../config/database';
import { commitAndClose, openTenantTransaction, rollbackAndClose } from './crossSchema.repo';

const USER_COLUMNS: Record<string, string> = {
  name: 'name',
  mobile: 'mobile',
  profilePicture: 'profile_picture',
};

const BUSINESS_COLUMNS: Record<string, string> = {
  instituteName: 'institute_name',
  tagline: 'tagline',
  contactNumber: 'contact_number',
  email: 'email',
  address: 'address',
  logo: 'logo',
};

const TEACHER_COLUMNS: Record<string, string> = {
  qualification: 'qualification',
  experienceYears: 'experience_years',
  designation: 'designation',
  bio: 'bio',
  languages: 'languages',
  gender: 'gender',
  dob: 'date_of_birth',
  address: 'address',
  status: 'status',
  updatedAt: 'updated_at',
};

const STUDENT_COLUMNS: Record<string, string> = {
  dob: 'date_of_birth',
  gender: 'gender',
  languages: 'languages',
  address: 'address',
  city: 'city',
  bio: 'bio',
  status: 'status',
  updatedAt: 'updated_at',
};

function normalizeUpdate(input: Record<string, unknown> | null | undefined, columnMap: Record<string, string>) {
  if (!input) return [];
  return Object.entries(input).flatMap(([key, value]) => {
    const column = columnMap[key];
    if (!column || value === undefined) return [];
    return [{ column, value }];
  });
}

function buildUpdateSql(
  tableSql: string,
  idColumn: string,
  id: number,
  updates: Array<{ column: string; value: unknown }>,
  params: unknown[],
) {
  if (updates.length === 0) return null;
  const assignments = updates.map(({ column, value }) => {
    params.push(value);
    return `"${column}" = $${params.length}`;
  });
  params.push(id);
  return `UPDATE ${tableSql} SET ${assignments.join(', ')} WHERE "${idColumn}" = $${params.length}`;
}

export async function updateProfileTransaction(params: {
  userId: number;
  userUpdate?: Prisma.UserUpdateInput | Record<string, unknown> | null | undefined;
  teacherId?: number | null | undefined;
  teacherUpdate?: Prisma.TeacherUpdateInput | Record<string, unknown> | null | undefined;
  studentId?: number | null | undefined;
  studentUpdate?: Prisma.StudentUpdateInput | Record<string, unknown> | null | undefined;
  businessId?: number | null | undefined;
  businessUpdate?: Prisma.BusinessUpdateInput | Record<string, unknown> | null | undefined;
}) {
  const userUpdates = normalizeUpdate(params.userUpdate as any, USER_COLUMNS);
  const businessUpdates = normalizeUpdate(params.businessUpdate as any, BUSINESS_COLUMNS);
  const teacherUpdates = normalizeUpdate(params.teacherUpdate as any, TEACHER_COLUMNS);
  const studentUpdates = normalizeUpdate(params.studentUpdate as any, STUDENT_COLUMNS);

  const hasTenantUpdates = teacherUpdates.length > 0 || studentUpdates.length > 0;
  const hasPublicUpdates = userUpdates.length > 0 || businessUpdates.length > 0;
  if (!hasTenantUpdates && !hasPublicUpdates) return null;

  let businessId = params.businessId ?? null;
  if (!businessId && hasTenantUpdates) {
    const user = await publicPrisma.user.findUnique({
      where: { id: params.userId },
      select: { businessId: true },
    });
    businessId = user?.businessId ?? null;
  }

  if (!hasTenantUpdates) {
    return publicPrisma.$transaction(async (tx) => {
      if (userUpdates.length > 0) {
        await tx.user.update({ where: { id: params.userId }, data: params.userUpdate as Prisma.UserUpdateInput });
      }
      if (params.businessId && businessUpdates.length > 0) {
        await tx.business.update({ where: { id: params.businessId }, data: params.businessUpdate as Prisma.BusinessUpdateInput });
      }
    });
  }

  if (!businessId) {
    throw new Error('Business is required for tenant profile updates');
  }

  const { client, schemaSql } = await openTenantTransaction(businessId);
  try {
    const sqlStatements: Array<{ sql: string; params: unknown[] }> = [];

    const publicParams: unknown[] = [];
    const userSql = buildUpdateSql('public.users', 'id', params.userId, userUpdates, publicParams);
    if (userSql) sqlStatements.push({ sql: userSql, params: publicParams });

    if (params.businessId && businessUpdates.length > 0) {
      const updateParams: unknown[] = [];
      const businessSql = buildUpdateSql('public.business', 'id', params.businessId, businessUpdates, updateParams);
      if (businessSql) sqlStatements.push({ sql: businessSql, params: updateParams });
    }

    if (params.teacherId && teacherUpdates.length > 0) {
      const updateParams: unknown[] = [];
      const teacherSql = buildUpdateSql(`${schemaSql}.teachers`, 'id', params.teacherId, teacherUpdates, updateParams);
      if (teacherSql) sqlStatements.push({ sql: teacherSql, params: updateParams });
    }

    if (params.studentId && studentUpdates.length > 0) {
      const updateParams: unknown[] = [];
      const studentSql = buildUpdateSql(`${schemaSql}.students`, 'id', params.studentId, studentUpdates, updateParams);
      if (studentSql) sqlStatements.push({ sql: studentSql, params: updateParams });
    }

    for (const statement of sqlStatements) {
      await client.query(statement.sql, statement.params);
    }

    await commitAndClose(client);
    return null;
  } catch (error) {
    await rollbackAndClose(client);
    throw error;
  }
}

export default updateProfileTransaction;
