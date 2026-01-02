import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient();

const announcementSelect = {
  id: true,
  heading: true,
  content: true,
  startDate: true,
  endDate: true,
  isActive: true,
  businessId: true,
  visibleToAdmins: true,
  visibleToTeachers: true,
  visibleToStudents: true,
  createdAt: true,
  updatedAt: true,
};

const businessSelect = {
  id: true,
  instituteName: true,
};

export async function createAnnouncement(data: Prisma.AnnouncementCreateInput) {
  try {
    return await prisma.announcement.create({
      data,
      select: {
        ...announcementSelect,
        business: { select: businessSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function findAnnouncementById(id: number) {
  return prisma.announcement.findUnique({
    where: { id },
    select: {
      ...announcementSelect,
      business: { select: businessSelect }
    },
  });
}

export async function findAnnouncementsByBusinessId(businessId: number) {
  return prisma.announcement.findMany({
    where: { businessId },
    select: {
      ...announcementSelect,
      business: { select: businessSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findActiveAnnouncementsByBusinessId(businessId: number) {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      businessId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now }
    },
    select: {
      ...announcementSelect,
      business: { select: businessSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findAnnouncementsByRole(businessId: number, role: string) {
  const now = new Date();
  const roleVisibilityMap = {
    'ADMIN': 'visibleToAdmins',
    'SUPERADMIN': 'visibleToAdmins',
    'TEACHER': 'visibleToTeachers',
    'STUDENT': 'visibleToStudents'
  };

  const visibilityField = roleVisibilityMap[role as keyof typeof roleVisibilityMap];
  if (!visibilityField) {
    return [];
  }

  return prisma.announcement.findMany({
    where: {
      businessId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      [visibilityField]: true
    },
    select: {
      ...announcementSelect,
      business: { select: businessSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findAnnouncementsByDateRange(businessId: number, startDate: Date, endDate: Date) {
  return prisma.announcement.findMany({
    where: {
      businessId,
      isActive: true,
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: {
      ...announcementSelect,
      business: { select: businessSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAnnouncement(id: number, data: Prisma.AnnouncementUpdateInput) {
  try {
    return await prisma.announcement.update({
      where: { id },
      data,
      select: {
        ...announcementSelect,
        business: { select: businessSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteAnnouncement(id: number) {
  return prisma.announcement.delete({
    where: { id },
  });
}
