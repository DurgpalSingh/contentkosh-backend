import { Prisma, Content } from '@prisma/client';
import { prisma } from '../config/database';

const userBasicSelect: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true
};

const batchBasicSelect: Prisma.BatchSelect = {
  id: true,
  codeName: true,
  displayName: true
};

const contentDefaultInclude: Prisma.ContentInclude = {
  batch: {
    select: batchBasicSelect
  },
  uploader: {
    select: userBasicSelect
  },
  updater: {
    select: userBasicSelect
  }
};


export interface ContentFindOptions {
  where?: Prisma.ContentWhereInput;
  orderBy?: Prisma.ContentOrderByWithRelationInput;
  skip?: number;
  take?: number;
  include?: Prisma.ContentInclude;
  select?: Prisma.ContentSelect;
}

export const createContent = async (data: Prisma.ContentCreateInput): Promise<Content> => {
  return await prisma.content.create({
    data,
    include: {
      batch: { select: batchBasicSelect },
      uploader: { select: userBasicSelect }
    }
  });
};

export const findContentById = async (
  id: number,
  options: Pick<ContentFindOptions, 'include' | 'select'> = {}
): Promise<Content | null> => {
  // If select is provided, use it; otherwise use include
  if (options.select) {
    return await prisma.content.findUnique({
      where: { id },
      select: options.select
    });
  }
  
  return await prisma.content.findUnique({
    where: { id },
    include: options.include || contentDefaultInclude
  });
};

export const findContentsByBatchId = async (
  batchId: number,
  options: ContentFindOptions = {}
): Promise<Content[]> => {
  const where: Prisma.ContentWhereInput = {
    batchId,
    ...options.where
  };

  // If select is provided, use it; otherwise use include
  if (options.select) {
    return await prisma.content.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      select: options.select
    });
  }

  return await prisma.content.findMany({
    where,
    orderBy: options.orderBy || { createdAt: 'desc' },
    ...(options.skip !== undefined && { skip: options.skip }),
    ...(options.take !== undefined && { take: options.take }),
    include: options.include || {
      uploader: { select: userBasicSelect },
      updater: { select: userBasicSelect }
    }
  });
};

export const updateContent = async (
  id: number,
  data: Prisma.ContentUpdateInput
): Promise<Content> => {
  return await prisma.content.update({
    where: { id },
    data,
    include: contentDefaultInclude
  });
};

export const deleteContent = async (id: number): Promise<Content> => {
  return await prisma.content.update({
    where: { id },
    data: {
      status: 'INACTIVE',
    },
  });
};

export const findContentWithBatchRelations = async (
  id: number
): Promise<Content | null> => {
  return await prisma.content.findUnique({
    where: { id },
    include: {
      batch: {
        include: {
          course: {
            include: {
              exam: {
                select: {
                  businessId: true
                }
              }
            }
          }
        }
      }
    }
  });
};

export const countContentsByBatch = async (
  batchId: number,
  where?: Prisma.ContentWhereInput
): Promise<number> => {
  return await prisma.content.count({
    where: {
      batchId,
      ...where
    }
  });
};