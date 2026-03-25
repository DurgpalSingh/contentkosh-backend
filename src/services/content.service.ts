import { Prisma, Content, ContentType, ContentStatus, UserRole, SubjectStatus } from '@prisma/client';
import * as contentRepo from '../repositories/content.repo';
import * as batchRepo from '../repositories/batch.repo';
import * as subjectRepo from '../repositories/subject.repo';
import { CreateContentDto, UpdateContentDto, ContentQueryDto } from '../dtos/content.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import logger from '../utils/logger';
import { ContentMapper } from '../mappers/content.mapper';
import { promises as fs } from 'fs';
import * as path from 'path';
import { FILE_TYPE_CONFIG } from '../config/file-type';
import { MIME_TYPES } from '../constants/file.constants';

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
      await this.validateSubjectForBatch(batchId, data.subjectId, user);
      const createData: Prisma.ContentCreateInput = {
        title: data.title,
        type: data.type,
        filePath: data.filePath,
        fileSize: data.fileSize,
        status: data.status || ContentStatus.ACTIVE,
        batch: {
          connect: { id: batchId }
        },
        subject: {
          connect: { id: data.subjectId }
        },
        uploader: {
          connect: { id: user.id }
        }
      };
      const content = await contentRepo.createContent(createData);
      logger.info('ContentService: Content created', {
        contentId: content.id,
        batchId,
        userId: user.id,
        subjectId: data.subjectId
      });
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
      ...(user.role === UserRole.TEACHER && { uploadedBy: user.id }),
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

    const isPrivilegedUser = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    const isTeacherOwner = user.role === UserRole.TEACHER && existingContent.uploadedBy === user.id;

    if (!isPrivilegedUser && !isTeacherOwner) {
      throw new ForbiddenError('You can only update content you uploaded');
    }

    await this.validateSubjectForBatch(existingContent.batchId, data.subjectId, user);

    const updateData: Prisma.ContentUpdateInput = {
      ...(data.title && { title: data.title }),
      ...(data.status !== undefined && { status: data.status }),
      subject: {
        connect: { id: data.subjectId }
      },
      updater: {
        connect: { id: user.id }
      },
      updatedAt: new Date()
    };

    const content = await contentRepo.updateContent(id, updateData);
    logger.info('ContentService: Content updated', {
      contentId: content.id,
      userId: user.id,
      subjectId: data.subjectId
    });
    return ContentMapper.toResponse(content);
  }

  async deleteContent(id: number, user: IUser): Promise<void> {
    logger.info('ContentService: Deleting content', { contentId: id, userId: user.id });

    const existingContent = await contentRepo.findContentById(id);
    if (!existingContent) {
      throw new NotFoundError('Content not found');
    }

    const isPrivilegedUser = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    const isTeacherOwner = user.role === UserRole.TEACHER && existingContent.uploadedBy === user.id;

    if (!isPrivilegedUser && !isTeacherOwner) {
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
    const config = FILE_TYPE_CONFIG[type];
    if (!config) {
      return MIME_TYPES.DEFAULT;
    }

    const ext = path.extname(fileName).toLowerCase();
    return config.mimeTypes[ext] || config.defaultMimeType || MIME_TYPES.DEFAULT;
  }

  //  Authorize content creation: Only ADMIN, SUPERADMIN, or active TEACHER in the batch
  async authorizeContentCreation(batchId: number, user: IUser): Promise<void> {
    const { isSuperAdmin, isAdmin, batchUser } =
      await this.batchAccessContext(batchId, user);

    if (isSuperAdmin || isAdmin) {
      return;
    }

    if (!batchUser || !batchUser.isActive) {
      throw new ForbiddenError(
        'You must be an active user in this batch to create content'
      );
    }
  }

  // Authorize content access: Any user in the batch can access content (view/get)
  async validateContentAccess(contentId: number, user: IUser): Promise<void> {
    const content = await contentRepo.findContentById(contentId);
    if (!content) {
      throw new NotFoundError('Content not found');
    }

    const { isSuperAdmin, isAdmin, batchUser } =
      await this.batchAccessContext(content.batchId, user);

    if (isSuperAdmin || isAdmin) {
      return;
    }

    if (!batchUser || !batchUser.isActive) {
      throw new ForbiddenError(
        'You must be an active user in this batch to access content'
      );
    }
    if (user.role === UserRole.STUDENT || content.uploadedBy === user.id) {
      return;
    }

    throw new ForbiddenError('You can only access content you uploaded');
  }

  private async validateSubjectForBatch(
    batchId: number,
    subjectId: number,
    user: IUser
  ): Promise<void> {
    logger.info('ContentService: Validating subject for batch', {
      batchId,
      subjectId,
      userId: user.id
    });

    const batch = await batchRepo.findBatchById(batchId, {
      include: { course: { include: { exam: true } } }
    }) as any;

    if (!batch) {
      logger.warn('ContentService: Batch not found during subject validation', {
        batchId,
        subjectId,
        userId: user.id
      });
      throw new NotFoundError('Batch not found');
    }

    const businessId = batch.course?.exam?.businessId;

    const subject = await subjectRepo.findSubjectById(subjectId);
    if (!subject) {
      logger.warn('ContentService: Subject not found', { subjectId, batchId, userId: user.id, businessId });
      throw new NotFoundError('Subject not found');
    }

    if (subject.courseId !== batch.courseId) {
      logger.warn('ContentService: Subject course mismatch', {
        batchId,
        batchCourseId: batch.courseId,
        subjectId,
        subjectCourseId: subject.courseId,
        userId: user.id,
        businessId
      });
      throw new BadRequestError('Subject does not belong to this batch');
    }

    if (subject.status !== SubjectStatus.ACTIVE) {
      logger.warn('ContentService: Subject is inactive', {
        batchId,
        subjectId,
        status: subject.status,
        userId: user.id,
        businessId
      });
      throw new BadRequestError('Subject must be active');
    }
  }

  private async batchAccessContext(batchId: number, user: IUser) {
    const batch = await batchRepo.findBatchById(batchId, { include: { course: { include: { exam: true } } } }) as any;

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const exam = batch.course?.exam;
    if (!exam) {
      throw new ForbiddenError('Batch is not correctly associated with an exam');
    }

    const isSuperAdmin = user.role === UserRole.SUPERADMIN;
    const isAdmin = user.role === UserRole.ADMIN;
    const hasBusinessAccess = exam.businessId === user.businessId;

    if (!isSuperAdmin && !hasBusinessAccess) {
      throw new ForbiddenError('You do not have access to this batch');
    }

    const batchUser =
      isSuperAdmin || isAdmin
        ? null
        : await batchRepo.findBatchUser(user.id, batchId);

    return {
      isSuperAdmin,
      isAdmin,
      batchUser
    };
  }
}