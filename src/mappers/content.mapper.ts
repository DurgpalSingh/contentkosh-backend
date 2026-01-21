import { Content } from '@prisma/client';

export class ContentMapper {
  static toDomain(content: any): Content {
    return {
      id: content.id,
      batchId: content.batchId,
      title: content.title,
      type: content.type,
      filePath: content.filePath,
      fileSize: content.fileSize,
      status: content.status,
      uploadedBy: content.uploadedBy,
      updatedBy: content.updatedBy,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt
    };
  }

  static toResponse(content: any) {
    return {
      id: content.id,
      batchId: content.batchId,
      title: content.title,
      type: content.type,
      filePath: content.filePath,
      fileSize: content.fileSize,
      status: content.status,
      uploadedBy: content.uploadedBy,
      updatedBy: content.updatedBy,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      batch: content.batch ? {
        id: content.batch.id,
        codeName: content.batch.codeName,
        displayName: content.batch.displayName
      } : undefined,
      uploader: content.uploader ? {
        id: content.uploader.id,
        name: content.uploader.name,
        email: content.uploader.email
      } : undefined,
      updater: content.updater ? {
        id: content.updater.id,
        name: content.updater.name,
        email: content.updater.email
      } : undefined
    };
  }
}