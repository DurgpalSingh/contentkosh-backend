import { Prisma, BusinessStatus } from '@prisma/client';
import { prisma, publicPrisma } from '../config/database';

export type BusinessCreateInput = Prisma.BusinessCreateInput;
export type BusinessUpdateInput = Prisma.BusinessUpdateInput;
export async function createBusiness(data: Prisma.BusinessCreateInput) {
  return await prisma.business.create({
    data
  });
}


export async function findBusinessById(id: number) {
  return prisma.business.findFirst({
    where: {
      id,
      isDeleted: false
    },
  });
}

export async function findBusinessBySlug(slug: string) {
  return prisma.business.findFirst({
    where: {
      slug,
      isDeleted: false
    },
  });
}

export async function findFirstBusiness() {
  return prisma.business.findFirst({
    where: {
      isDeleted: false
    }
  });
}

export async function updateBusiness(id: number, data: Prisma.BusinessUpdateInput) {
  return await prisma.business.update({
    where: { id },
    data,
  });
}

export async function tenantSchemaExists(schemaName: string): Promise<boolean> {
  const rows = await publicPrisma.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schemaName}
  `;
  return rows.length > 0;
}

/** Permanently removes the row (its verification tokens go with it); `deleteBusiness` is the soft delete. */
export function hardDeleteBusiness(id: number) {
  return publicPrisma.business.delete({ where: { id } });
}

export function createSlugHistory(businessId: number, slug: string) {
  return prisma.businessSlugHistory.create({ data: { businessId, slug } });
}

export async function deleteBusiness(id: number) {
  return prisma.business.update({
    where: { id },
    data: {
      isDeleted: true
    }
  });
}

export interface ListBusinessesForSuperAdminParams {
  skip: number;
  take: number;
  status?: BusinessStatus | undefined;
  search?: string | undefined;
}

export async function listBusinessesForSuperAdmin({ skip, take, status, search }: ListBusinessesForSuperAdminParams) {
  const where: Prisma.BusinessWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { instituteName: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.count({ where }),
  ]);

  return { items, total };
}

export interface UpdateBusinessStatusData {
  status: BusinessStatus;
  statusReason: string | null;
  statusChangedBy: number;
}

export async function updateBusinessStatus(id: number, data: UpdateBusinessStatusData) {
  return prisma.business.update({
    where: { id },
    data: {
      status: data.status,
      statusReason: data.statusReason,
      statusChangedBy: data.statusChangedBy,
      statusChangedAt: new Date(),
    },
  });
}

/** Which business uses an uploaded logo (stored as `/uploads/business/<file>`). */
export function findBusinessByLogoPath(logoPath: string) {
  return prisma.business.findFirst({
    where: { logo: logoPath },
    select: { id: true },
  });
}
