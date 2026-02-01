import { Prisma, Content, ContentType, ContentStatus, UserRole } from '@prisma/client';
import * as contentRepo from '../repositories/content.repo';
import * as batchRepo from '../repositories/batch.repo';
import { CreateContentDto, UpdateContentDto, ContentQueryDto } from '../dtos/content.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';
import { ContentMapper } from '../mappers/content.mapper';
import { promises as fs } from 'fs';
import * as path from 'path';
import { FILE_TYPE_CONFIG } from '../config/file-type';
import { FILE_EXTENSIONS, MIME_TYPES } from '../constants/file.constants';

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

    this.validateFileUpload(data.type, data.fileSize);
    this.validateFilePath(data.filePath, data.type);

    try {
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
    } catch (error: any) {
      if (data.filePath) { // If DB creation fails, delete the uploaded file
        fs.unlink(data.filePath);
      }
      throw error;
    }

  }

  async getContent(id: number, user: IUser): Promise<Content> {
    logger.info('ContentService: Fetching content', { contentId: id, userId: user.id });

    const content = await contentRepo.findContentById(id);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

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

    const contents = await contentRepo.findContentsByBatchId(batchId, { where });

    return contents.map(content => ContentMapper.toResponse(content));
  }

  async updateContent(id: number, data: UpdateContentDto, user: IUser): Promise<Content> {
    logger.info('ContentService: Updating content', { contentId: id, userId: user.id });

    const existingContent = await contentRepo.findContentById(id);
    if (!existingContent) {
      throw new NotFoundError('Content not found');
    }

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

    // Only allow admins/teachers or the original uploader to delete
    if (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.TEACHER &&
      existingContent.uploadedBy !== user.id) {
      throw new ForbiddenError('You can only delete content you uploaded');
    }

    // Delete the physical file
    try {
      await fs.access(existingContent.filePath);
      await contentRepo.deleteContent(id);
      // fs.unlinkSync(existingContent.filePath);
      logger.info('soft deleted', { filePath: existingContent.filePath });
    } catch (error: any) {
      logger.warn('Failed to delete physical file', {
        filePath: existingContent.filePath,
        error: error.message
      });
    }
  }

  async getContentFile(id: number, user: IUser): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    logger.info('ContentService: Getting content file', { contentId: id, userId: user.id });

    const content = await contentRepo.findContentById(id);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

    try {
      await fs.access(content.filePath);
    } catch {
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

  private validateFileUpload(
    type: ContentType,
    fileSize: number
  ): void {
    const config = FILE_TYPE_CONFIG[type];

    if (!config || !config.allowed) {
      throw new BadRequestError('File type is not allowed');
    }

    if (fileSize > config.maxSizeBytes) {
      throw new BadRequestError(
        `File size exceeds allowed limit`
      );
    }
  }

  private validateFilePath(
    filePath: string,
    type: ContentType
  ): void {
    if (!filePath) {
      throw new BadRequestError('File path is required');
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads/content');
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(uploadDir + path.sep)) {
      throw new BadRequestError('Invalid file path');
    }

    const config = FILE_TYPE_CONFIG[type];
    if (!config) {
      throw new BadRequestError('Invalid content type');
    }

    const ext = path.extname(resolvedPath).toLowerCase();

    if (!config.extensions.includes(ext)) {
      throw new BadRequestError(
        'File extension does not match content type'
      );
    }
  }


  private getMimeType(
    type: ContentType,
    fileName: string
  ): string {
    if (type === ContentType.PDF) {
      return MIME_TYPES.PDF;
    }

    const ext = path.extname(fileName).toLowerCase();

    switch (ext) {
      case FILE_EXTENSIONS.JPG:
      case FILE_EXTENSIONS.JPEG:
        return MIME_TYPES.JPEG;

      case FILE_EXTENSIONS.PNG:
        return MIME_TYPES.PNG;

      default:
        return MIME_TYPES.DEFAULT;
    }
  }

  //  Authorize content creation: Only ADMIN, SUPERADMIN, or active TEACHER in the batch

  async authorizeContentCreation(batchId: number, user: IUser): Promise<void> {

    // Validate batch access first
    await this.validateBatchAccess(batchId, user);

    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    const batchUser = await batchRepo.findBatchUser(user.id, batchId);
    if (!batchUser || !batchUser.isActive) {
      throw new ForbiddenError('You must be an active user in this batch for content');
    }
  }

  // Authorize content access: Any user in the batch can access content (view/get)
  async validateContentAccess(contentId: number, user: IUser): Promise<void> {

    const content = await contentRepo.findContentById(contentId);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

    const batchId = content.batchId;
    await this.validateBatchAccess(batchId, user);

    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    const batchUser = await batchRepo.findBatchUser(user.id, batchId);
    if (!batchUser) {
      throw new ForbiddenError('You are not a member of this batch');
    }

    // User must be active in the batch to access content
    if (!batchUser.isActive) {
      throw new ForbiddenError('You are not active in this batch');
    }
  }

  private async validateBatchAccess(batchId: number, user: IUser): Promise<void> {
    // Batch -> Course -> Exam -> Business
    const batchWithRelations = await batchRepo.findBatchById(batchId, {
      include: { course: { include: { exam: true } } }
    }) as any; // Cast for simplified access

    if (!batchWithRelations) throw new NotFoundError('Batch not found');

    const exam = batchWithRelations.course?.exam;
    if (!exam) {
      throw new ForbiddenError('Batch is not correctly associated with an exam');
    }

    const isSuperAdmin = user.role === UserRole.SUPERADMIN;
    const hasBusinessAccess = exam.businessId === user.businessId;

    if (!isSuperAdmin && !hasBusinessAccess) {
      throw new ForbiddenError('You do not have access to this batch');
    }
  }
}