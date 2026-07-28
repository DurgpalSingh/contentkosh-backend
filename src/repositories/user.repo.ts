import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma, publicPrisma } from '../config/database';
import { AlreadyExistsError } from '../errors/api.errors';

export async function createUser(data: {
  id?: number;
  email: string;
  password?: string | undefined;
  name: string;
  mobile?: string | undefined;
  role?: UserRole | undefined;
  businessId?: number | undefined;
  status?: UserStatus | undefined;
}) {
  try {
    return await publicPrisma.user.create({
      data: {
        ...(data.id !== undefined && { id: data.id }),
        email: data.email.toLowerCase().trim(),
        password: data.password!,

        name: data.name?.trim() ?? '',
        ...(data.mobile !== undefined && { mobile: data.mobile }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.businessId !== undefined && { businessId: data.businessId }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: { id: true, email: true, name: true, role: true, businessId: true, mobile: true, createdAt: true, updatedAt: true },
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      if (e.meta?.target?.includes('email')) throw new AlreadyExistsError('User with this email already exists');
      if (e.meta?.target?.includes('mobile')) throw new AlreadyExistsError('User with this mobile already exists');
    }
    throw e;
  }
}

export function findByEmail(email: string) {
  // Email is unique per business. without businessId, this is ambiguous.
  // We return the first one found.
  // Always use publicPrisma: users live exclusively in the public schema.
  return publicPrisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
}

export function findByBusinessAndEmail(businessId: number, email: string) {
  return publicPrisma.user.findUnique({
    where: {
      businessId_email: {
        businessId,
        email: email.toLowerCase().trim()
      }
    }
  });
}

export function findByMobile(mobile: string) {
  return publicPrisma.user.findFirst({ where: { mobile } });
}

export async function exists(id: number): Promise<boolean> {
  if (!id) return false;
  const user = await publicPrisma.user.findUnique({ where: { id }, select: { id: true } });
  return user !== null;
}

export function findPublicById(id: number) {
  // Always use publicPrisma: this function includes the `business` relation which only
  // exists in the public schema. The smart proxy would route `prisma.user` to the
  // tenant schema when a tenant context is active, causing a missing-table error.
  return publicPrisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      mobile: true,
      profilePicture: true,
      role: true,
      status: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { id: true, instituteName: true, slug: true, logo: true, schemaName: true } }
    }
  });
}

export async function findByBusinessId(businessId: number, role?: UserRole) {
  const users = await publicPrisma.user.findMany({
    where: {
      businessId,
      status: UserStatus.ACTIVE,
      ...(role && { role })
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      profilePicture: true,
      role: true,
      status: true,
      createdAt: true
    }
  });

  // Map to BusinessUser structure expected by frontend
  return users.map(u => ({
    id: u.id,
    role: u.role,
    createdAt: u.createdAt,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      profilePicture: u.profilePicture
    }
  }));
}

export function updateUser(id: number, data: { name?: string; mobile?: string; role?: UserRole; status?: UserStatus; password?: string; businessId?: number; profilePicture?: string | null }) {
  return publicPrisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, mobile: true, role: true, businessId: true, status: true, updatedAt: true }
  });
}

export function softDeleteUser(id: number) {
  return publicPrisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE }
  });
}

export function findByEmailWithBusinesses(email: string) {
  // Always use publicPrisma: includes the `business` relation which lives in public schema only.
  return publicPrisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      role: true,
      status: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { id: true, instituteName: true, slug: true, schemaName: true } }
    }
  });
}

export function findSettingsProfileByUserId(userId: number) {
  // Always use publicPrisma: includes business relation.
  // Business is in the public schema; using the smart proxy would cause tenant routing errors.
  return publicPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      profilePicture: true,
      role: true,
      status: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
      business: {
        select: {
          id: true,
          instituteName: true,
          slug: true,
          schemaName: true,
          logo: true,
          tagline: true,
          contactNumber: true,
          email: true,
          address: true,
          youtubeUrl: true,
          instagramUrl: true,
          linkedinUrl: true,
          facebookUrl: true
        }
      }
    } as any
  });
}
