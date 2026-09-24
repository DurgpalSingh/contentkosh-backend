import { Prisma, Content, ContentType, ContentStatus, ContentAgentUploadStatus, UserRole, SubjectStatus } from '@prisma/client';
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
import { AiKnowledgeBaseService } from './aiKnowledgeBase.service';

export class ContentService {
  constructor(private readonly aiKnowledgeBaseService: AiKnowledgeBaseService = new AiKnowledgeBaseService()) {}

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
    const batchContext = await this.getBatchContext(batchId);

    if (user.role !== UserRole.SUPERADMIN && batchContext.businessId !== user.businessId) {
      throw new ForbiddenError('You do not have access to this batch');
    }

    try {
      const createData: Prisma.ContentCreateInput = {
        title: data.title,
        type: data.type,
        filePath: data.filePath,
        fileSize: data.fileSize,
        status: data.status || ContentStatus.ACTIVE,
        agentUploadStatus: data.type === ContentType.PDF
          ? ContentAgentUploadStatus.PENDING
          : ContentAgentUploadStatus.NOT_APPLICABLE,
        batch: {
          connect: { id: batchId }
        },
        uploader: {
          connect: { id: user.id }
        },
        ...(data.subjectId !== undefined
          ? {
              subject: {
                connect: { id: data.subjectId }
              }
            }
          : {})
      };
      const content = await contentRepo.createContent(createData, user.businessId!);
      logger.info('ContentService: Content created', {
        contentId: content.id,
        batchId,
        userId: user.id,
        subjectId: data.subjectId
      });

      if (data.type === ContentType.PDF && content.id) {
        logger.info('ContentService: Starting background CK Agent upload', {
          contentId: content.id,
          businessId: batchContext.businessId,
          courseId: batchContext.courseId,
        });
        void this.processAgentUpload({
          contentId: content.id,
          filePath: data.filePath,
          businessId: batchContext.businessId,
          courseId: batchContext.courseId,
        });
      }

      logger.info('ContentService: Returning content upload response', {
        contentId: content.id,
        batchId,
        agentUploadQueued: data.type === ContentType.PDF,
      });
      return ContentMapper.toResponse(content);
    } catch (error) {
      logger.error('ContentService: Content upload failed', {
        batchId,
        userId: user.id,
        type: data.type,
        message: error instanceof Error ? error.message : String(error),
      });
      if (data.filePath) {
        await fs.unlink(data.filePath).catch((cleanupError) => {
          logger.warn('ContentService: Failed to clean up uploaded file after error', {
            batchId,
            message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        });
      }
      throw error;
    }

  }

  private async processAgentUpload(params: {
    contentId: number;
    filePath: string;
    businessId: number;
    courseId: number;
  }): Promise<void> {
    try {
      logger.info('ContentService: CK Agent upload job processing started', {
        contentId: params.contentId,
        businessId: params.businessId,
        courseId: params.courseId,
      });
      await contentRepo.updateAgentUploadStatus(
        params.contentId,
        params.businessId,
        ContentAgentUploadStatus.PROCESSING,
      );
      await this.aiKnowledgeBaseService.uploadPdfToKnowledgeBase({
        filePath: params.filePath,
        businessId: params.businessId,
        courseId: params.courseId,
        contentType: ContentType.PDF,
      });
      await contentRepo.updateAgentUploadStatus(
        params.contentId,
        params.businessId,
        ContentAgentUploadStatus.SUCCEEDED,
      );
      logger.info('ContentService: CK Agent upload completed', { contentId: params.contentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CK Agent upload failed';
      try {
        await contentRepo.updateAgentUploadStatus(
          params.contentId,
          params.businessId,
          ContentAgentUploadStatus.FAILED,
          message,
        );
      } catch (statusError) {
        logger.error('ContentService: Failed to update CK Agent status', {
          contentId: params.contentId,
          statusError,
        });
      }
      logger.error('ContentService: CK Agent upload failed', {
        contentId: params.contentId,
        message,
      });
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

    const updateData: Prisma.ContentUpdateInput = {
      ...(data.title && { title: data.title }),
      ...(data.status !== undefined && { status: data.status }),
      updater: {
        connect: { id: user.id }
      },
      updatedAt: new Date(),
      ...(data.subjectId !== undefined
        ? {
            subject: {
              connect: { id: data.subjectId }
            }
          }
        : {})
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

    const batch = (await batchRepo.findBatchById(batchId, {
      requireActiveHierarchy: true,
      include: { course: { include: { exam: true } } },
    })) as {
      courseId: number;
      course?: { exam?: { businessId: number } };
    } | null;

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
    const batch = (await batchRepo.findBatchById(batchId, {
      requireActiveHierarchy: true,
      include: { course: { include: { exam: true } } },
    })) as { course?: { exam?: { businessId: number; id: number } } } | null;

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

  private async getBatchContext(batchId: number): Promise<{ businessId: number; courseId: number }> {
    const batch = (await batchRepo.findBatchById(batchId, {
      requireActiveHierarchy: true,
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            exam: {
              select: { businessId: true },
            },
          },
        },
      },
    })) as { courseId: number; course?: { exam?: { businessId: number } } } | null;

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const businessId = batch.course?.exam?.businessId;
    if (!businessId) {
      throw new ForbiddenError('Batch is not correctly associated with an exam');
    }

    return { businessId, courseId: batch.courseId };
  }
}
