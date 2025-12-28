// src/repositories/user.repo.ts
import { PrismaClient, Prisma, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function createUser(data: Prisma.UserCreateInput) {
  const hash = await bcrypt.hash(data.password, 12);
  try {
    return await prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase().trim(),
        password: hash,
        name: data.name?.trim() ?? '',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        businessId: true,
        createdAt: true,
        updatedAt: true
      },
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      if (e.meta?.target?.includes('email')) throw new Error('EMAIL_ALREADY_EXISTS');
      if (e.meta?.target?.includes('mobile')) throw new Error('MOBILE_ALREADY_EXISTS');
    }
    throw e;
  }
}

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
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
      mobile: true,
      role: true,
      status: true,
      emailVerified: true,
      businessId: true,
      createdAt: true,
      updatedAt: true,
      businessUsers: {
        select: {
          id: true,
          business: {select: {id: true, instituteName: true}},
          role: true,
          isActive: true,
        }
      }
    }
  });
}

export function findByEmailWithBusinesses(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      business: true
    }
  });
}

export function findUsersByBusiness(businessId: number, role?: UserRole) {
  return prisma.user.findMany({
    where: {
      businessId,
      ...(role ? { role } : {})
    },
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      role: true,
      status: true,
      createdAt: true
    }
  });
}

export async function updateUser(id: number, data: Prisma.UserUpdateInput) {
  if (data.password && typeof data.password === 'string') {
    data.password = await bcrypt.hash(data.password, 12);
  }
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      role: true,
      status: true,
      updatedAt: true
    }
  });
}

export async function softDeleteUser(id: number) {
  return prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE }
  });
}