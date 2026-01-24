import { Prisma, Content, ContentType, ContentStatus, UserRole } from '@prisma/client';
import * as contentRepo from '../repositories/content.repo';
import * as batchRepo from '../repositories/batch.repo';
import { CreateContentDto, UpdateContentDto, ContentQueryDto } from '../dtos/content.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';
import { ContentMapper } from '../mappers/content.mapper';
import * as fs from 'fs';
import * as path from 'path';

export class ContentService {

  async createContent(
    batchId: number,
    data: CreateContentDto,
    user: IUser
  ): Promise<Content> {
    logger.info('ContentService: Creating new content', {
      batchId,
      title: data.title,
      type: data.type,
      userId: user.id
    });

    // Validate batch exists and user has access
    await this.validateBatchAccess(batchId, user);

    this.validateFileUpload(data.type, data.fileSize);

    const createData: Prisma.ContentCreateInput = {
      title: data.title,
      type: data.type,
      filePath: data.filePath,
      fileSize: data.fileSize,
      status: data.status || ContentStatus.ACTIVE,
      batch: {
        connect: { id: batchId }
      },
      uploader: {
        connect: { id: user.id }
      }
    };

    const content = await contentRepo.createContent(createData);
    return ContentMapper.toResponse(content);

  }

  async getContent(id: number, user: IUser): Promise<Content> {
    logger.info('ContentService: Fetching content', { contentId: id, userId: user.id });

    const content = await contentRepo.findContentById(id);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

    // Validate user has access to the batch
    await this.validateBatchAccess(content.batchId, user);

    return ContentMapper.toResponse(content);
  }

  async getContentsByBatch(
    batchId: number,
    query: ContentQueryDto,
    user: IUser
  ): Promise<Content[]> {
    logger.info('ContentService: Fetching contents for batch', {
      batchId,
      userId: user.id,
      query
    });

    // Validate batch access
    await this.validateBatchAccess(batchId, user);

    const where: Prisma.ContentWhereInput = {
      batchId,
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        title: {
          contains: query.search,
          mode: 'insensitive'
        }
      })
    };

    const contents = await contentRepo.findContentsByBatchId(batchId, {
      where,
      orderBy: { createdAt: 'desc' }
    });

    return contents.map(content => ContentMapper.toResponse(content));
  }

  async updateContent(id: number, data: UpdateContentDto, user: IUser): Promise<Content> {
    logger.info('ContentService: Updating content', { contentId: id, userId: user.id });

    const existingContent = await contentRepo.findContentById(id);
    if (!existingContent) {
      throw new NotFoundError('Content not found');
    }

    // Validate user has access to the batch
    await this.validateBatchAccess(existingContent.batchId, user);

    // Only allow admins/teachers or the original uploader to update
    if (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.TEACHER &&
      existingContent.uploadedBy !== user.id) {
      throw new ForbiddenError('You can only update content you uploaded');
    }

    const updateData: Prisma.ContentUpdateInput = {
      ...(data.title && { title: data.title }),
      ...(data.status !== undefined && { status: data.status }),
      updater: {
        connect: { id: user.id }
      },
      updatedAt: new Date()
    };

    const content = await contentRepo.updateContent(id, updateData);
    return ContentMapper.toResponse(content);
  }

  async deleteContent(id: number, user: IUser): Promise<void> {
    logger.info('ContentService: Deleting content', { contentId: id, userId: user.id });

    const existingContent = await contentRepo.findContentById(id);
    if (!existingContent) {
      throw new NotFoundError('Content not found');
    }

    // Validate user has access to the batch
    await this.validateBatchAccess(existingContent.batchId, user);

    // Only allow admins/teachers or the original uploader to delete
    if (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.TEACHER &&
      existingContent.uploadedBy !== user.id) {
      throw new ForbiddenError('You can only delete content you uploaded');
    }

    // Delete the physical file
    try {
      if (fs.existsSync(existingContent.filePath)) {
        fs.unlinkSync(existingContent.filePath);
        logger.info('Physical file deleted', { filePath: existingContent.filePath });
      }
    } catch (error: any) {
      logger.warn('Failed to delete physical file', {
        filePath: existingContent.filePath,
        error: error.message
      });
    }

    await contentRepo.deleteContent(id);
  }

  async getContentFile(id: number, user: IUser): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    logger.info('ContentService: Getting content file', { contentId: id, userId: user.id });

    const content = await contentRepo.findContentById(id);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

    // Validate user has access to the batch
    await this.validateBatchAccess(content.batchId, user);

    if (!fs.existsSync(content.filePath)) {
      throw new NotFoundError('File not found on server');
    }

    const fileName = path.basename(content.filePath);
    const mimeType = this.getMimeType(content.type, fileName);

    return {
      filePath: content.filePath,
      fileName: `${content.title}${path.extname(fileName)}`,
      mimeType
    };
  }

  private async validateBatchAccess(batchId: number, user: IUser): Promise<void> {
    const batchWithRelations = await batchRepo.findBatchById(batchId, {
      include: {
        course: {
          include: {
            exam: {
              select: { businessId: true }
            }
          }
        }
      }
    }) as any;

    if (!batchWithRelations) {
      throw new NotFoundError('Batch not found');
    }

    const exam = batchWithRelations.course?.exam;
    if (!exam) {
      throw new BadRequestError('Batch is not correctly associated with an exam');
    }

    const isSuperAdmin = user.role === UserRole.SUPERADMIN;
    const hasBusinessAccess = exam.businessId === user.businessId;

    if (!isSuperAdmin && !hasBusinessAccess) {
      throw new ForbiddenError('You do not have access to this batch');
    }

    // Additional role-based validation for content operations
    if (user.role === UserRole.STUDENT) {
      // Students can only view content, not create/update/delete
      // This check should be done at the controller level for specific operations
    }
  }

  private validateFileUpload(type: ContentType, fileSize: number): void {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['pdf', 'jpg', 'jpeg', 'png'];
    const maxPdfSizeMB = parseInt(process.env.MAX_PDF_SIZE_MB || '10');
    const maxImageSizeMB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5');

    const maxPdfSizeBytes = maxPdfSizeMB * 1024 * 1024;
    const maxImageSizeBytes = maxImageSizeMB * 1024 * 1024;

    if (type === ContentType.PDF) {
      if (!allowedTypes.includes('pdf')) {
        throw new BadRequestError('PDF files are not allowed');
      }
      if (fileSize > maxPdfSizeBytes) {
        throw new BadRequestError(`PDF file size cannot exceed ${maxPdfSizeMB}MB`);
      }
    } else if (type === ContentType.IMAGE) {
      const imageTypes = allowedTypes.filter(t => ['jpg', 'jpeg', 'png'].includes(t));
      if (imageTypes.length === 0) {
        throw new BadRequestError('Image files are not allowed');
      }
      if (fileSize > maxImageSizeBytes) {
        throw new BadRequestError(`Image file size cannot exceed ${maxImageSizeMB}MB`);
      }
    } else {
      throw new BadRequestError('Invalid file type');
    }
  }

  private getMimeType(type: ContentType, fileName: string): string {
    if (type === ContentType.PDF) {
      return 'application/pdf';
    }

    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }
}