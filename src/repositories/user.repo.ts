import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

export async function createUser(data: Pick<Prisma.UserCreateInput, 'email' | 'password' | 'name'>) {
  const hash = await bcrypt.hash(data.password, 12);
  try {
    return await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        password: hash,
        name: data.name?.trim() ?? '',
      },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  } catch (e: any) {
    if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
      throw new Error('EMAIL_ALREADY_EXISTS');
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
      password: true,
      createdAt: true,
      updatedAt: true,
      businessUsers: {
        select: {
          id: true,
          business: { select: { id: true, instituteName: true } },
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
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      createdAt: true,
      updatedAt: true,
      businessUsers: {
        select: {
          id: true,
          business: { select: { id: true, instituteName: true } },
          role: true,
          isActive: true,
        }
      }
    }
  });
}