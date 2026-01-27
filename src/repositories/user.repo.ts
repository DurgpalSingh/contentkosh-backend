import { PrismaClient, Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AlreadyExistsError } from '../errors/api.errors';

export async function createUser(data: {
  email: string;
  password?: string | undefined;
  name: string;
  mobile?: string | undefined;
  role?: UserRole | undefined;
  businessId?: number | undefined;
  status?: UserStatus | undefined;
}) {
  try {
    return await prisma.user.create({
      data: {
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
  return prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
}

export function findByBusinessAndEmail(businessId: number, email: string) {
  return prisma.user.findUnique({
    where: {
      businessId_email: {
        businessId,
        email: email.toLowerCase().trim()
      }
    }
  });
}

export function findByMobile(mobile: string) {
  return prisma.user.findFirst({ where: { mobile } });
}

export async function exists(id: number): Promise<boolean> {
  if (!id) return false;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return user !== null;
}

export function findPublicById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      mobile: true,
      role: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { id: true, instituteName: true } }
    }
  });
}

export async function findByBusinessId(businessId: number, role?: UserRole) {
  const users = await prisma.user.findMany({
    where: {
      businessId,
      ...(role && { role })
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
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
      mobile: u.mobile
    }
  }));
}

export function updateUser(id: number, data: { name?: string; mobile?: string; role?: UserRole; status?: UserStatus; password?: string }) {
  return prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, mobile: true, role: true, businessId: true, status: true, updatedAt: true }
  });
}

export function softDeleteUser(id: number) {
  return prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE }
  });
}

export function findByEmailWithBusinesses(email: string) {
  return prisma.user.findFirst({
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
      business: { select: { id: true, instituteName: true } }
    }
  });
}