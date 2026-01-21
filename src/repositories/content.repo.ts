import { PrismaClient, Prisma, Content, ContentType, ContentStatus } from '@prisma/client';
import { prisma } from '../config/database';

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
      batch: {
        select: {
          id: true,
          codeName: true,
          displayName: true
        }
      },
      uploader: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
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
    include: options.include || {
      batch: {
        select: {
          id: true,
          codeName: true,
          displayName: true
        }
      },
      uploader: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      updater: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
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
      uploader: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      updater: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
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
    include: {
      batch: {
        select: {
          id: true,
          codeName: true,
          displayName: true
        }
      },
      uploader: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      updater: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
};

export const deleteContent = async (id: number): Promise<Content> => {
  return await prisma.content.delete({
    where: { id }
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