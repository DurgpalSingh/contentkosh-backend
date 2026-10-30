import { Prisma, Content } from '@prisma/client';
import { getTenantPrisma, prisma } from '../config/database';
import { ACTIVE_BATCH_WHERE } from '../constants/hierarchyFilters';
import { getTenantSchemaNameForBusiness, queryTenantPublic, userBasicFromRow } from './crossSchema.repo';

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
  subject: {
    select: {
      id: true,
      name: true
    }
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

export const createContent = async (data: Prisma.ContentCreateInput, businessId: number): Promise<Content> => {
  const schemaName = await getTenantSchemaNameForBusiness(businessId);
  const tenantPrisma = getTenantPrisma(schemaName);
  const created = await tenantPrisma.content.create({
    data: toUncheckedCreate(data) as any,
  });
  const rows = await findContentWithPublicRelations(businessId, 'c.id = $1', created.id);
  return rows[0] ?? created;
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
  
  if (options.include && options.include !== contentDefaultInclude) {
    return await prisma.content.findUnique({
      where: { id },
      include: options.include
    });
  }

  const businessId = await findContentBusinessId(id);
  if (!businessId) return null;
  const rows = await findContentWithPublicRelations(businessId, 'c.id = $1', id);
  return rows[0] ?? null;
};

export const findContentsByBatchId = async (
  batchId: number,
  options: ContentFindOptions = {}
): Promise<Content[]> => {
  const where: Prisma.ContentWhereInput = {
    batchId,
    batch: ACTIVE_BATCH_WHERE,
    ...options.where,
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

  if (options.include && options.include !== contentDefaultInclude) {
    return await prisma.content.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      include: options.include
    });
  }

  const businessId = await findBatchBusinessId(batchId);
  if (!businessId) return [];
  const matching = await prisma.content.findMany({
    where,
    orderBy: options.orderBy || { createdAt: 'desc' },
    ...(options.skip !== undefined && { skip: options.skip }),
    ...(options.take !== undefined && { take: options.take }),
    select: { id: true },
  });
  const ids = matching.map((item) => item.id);
  if (ids.length === 0) return [];
  return findContentWithPublicRelations(businessId, 'c.id = ANY($1::int[])', ids);
};

export const updateContent = async (
  id: number,
  data: Prisma.ContentUpdateInput
): Promise<Content> => {
  const updated = await prisma.content.update({
    where: { id },
    data: toUncheckedUpdate(data) as any,
  });
  return (await findContentById(id)) ?? updated;
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

function toUncheckedCreate(data: Prisma.ContentCreateInput): Prisma.ContentUncheckedCreateInput {
  const raw = data as any;
  return {
    batchId: raw.batch?.connect?.id,
    subjectId: raw.subject?.connect?.id ?? null,
    title: raw.title,
    type: raw.type,
    filePath: raw.filePath,
    fileSize: raw.fileSize,
    status: raw.status,
    uploadedBy: raw.uploader?.connect?.id,
    updatedBy: raw.updater?.connect?.id ?? null,
  };
}

function toUncheckedUpdate(data: Prisma.ContentUpdateInput): Prisma.ContentUncheckedUpdateInput {
  const raw = data as any;
  const next: Prisma.ContentUncheckedUpdateInput = { ...raw };
  if (raw.subject?.connect?.id !== undefined) next.subjectId = raw.subject.connect.id;
  if (raw.updater?.connect?.id !== undefined) next.updatedBy = raw.updater.connect.id;
  delete (next as any).batch;
  delete (next as any).subject;
  delete (next as any).uploader;
  delete (next as any).updater;
  return next;
}

function mapContentRow(row: any): Content {
  return {
    id: row.id,
    batchId: row.batch_id,
    subjectId: row.subject_id,
    title: row.title,
    type: row.type,
    filePath: row.file_path,
    fileSize: row.file_size,
    status: row.status,
    uploadedBy: row.uploaded_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    batch: row.batch_id ? { id: row.batch_id, codeName: row.batch_code_name, displayName: row.batch_display_name } : null,
    subject: row.subject_id ? { id: row.subject_id, name: row.subject_name } : null,
    uploader: userBasicFromRow(row, 'uploader'),
    updater: userBasicFromRow(row, 'updater'),
  } as any;
}

async function findContentBusinessId(id: number): Promise<number | null> {
  const content = await prisma.content.findUnique({
    where: { id },
    select: { batch: { select: { course: { select: { exam: { select: { businessId: true } } } } } } },
  });
  return content?.batch?.course?.exam?.businessId ?? null;
}

async function findBatchBusinessId(batchId: number): Promise<number | null> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { course: { select: { exam: { select: { businessId: true } } } } },
  });
  return batch?.course?.exam?.businessId ?? null;
}

async function findContentWithPublicRelations(
  businessId: number,
  whereSql: string,
  ...params: unknown[]
): Promise<Content[]> {
  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      SELECT
        c.*,
        b.code_name AS batch_code_name, b.display_name AS batch_display_name,
        s.name AS subject_name,
        up.id AS uploader_id, up.name AS uploader_name, up.email AS uploader_email,
        up.mobile AS uploader_mobile, up.role AS uploader_role, up.profile_picture AS uploader_profile_picture,
        uu.id AS updater_id, uu.name AS updater_name, uu.email AS updater_email,
        uu.mobile AS updater_mobile, uu.role AS updater_role, uu.profile_picture AS updater_profile_picture
      FROM ${schema}.contents c
      JOIN ${schema}.batches b ON b.id = c.batch_id
      LEFT JOIN ${schema}.subjects s ON s.id = c.subject_id
      JOIN public.users up ON up.id = c.uploaded_by
      LEFT JOIN public.users uu ON uu.id = c.updated_by
      WHERE ${whereSql}
      ORDER BY c.created_at DESC
    `,
    ...params,
  );
  return rows.map(mapContentRow);
}
