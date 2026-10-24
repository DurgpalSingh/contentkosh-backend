import { ContentType, UserRole } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { KnowledgeBaseQueryResponse } from '../dtos/ai.dto';
import { AiAgentClient, aiAgentClient, aiAgentQueryClient } from './aiAgent.client';
import * as batchRepo from '../repositories/batch.repo';
import logger from '../utils/logger';

interface AgentUploadResponse {
  request_id?: string;
  message?: string;
}

export class AiKnowledgeBaseService {
  constructor(
    private readonly agentClient: AiAgentClient = aiAgentClient,
    private readonly queryAgentClient: AiAgentClient = aiAgentQueryClient,
  ) {}

  async uploadPdfToKnowledgeBase(params: {
    filePath: string;
    originalFileName?: string;
    businessId: number;
    courseId: number;
    subjectId?: number;
    contentType: ContentType;
  }): Promise<AgentUploadResponse | null> {
    if (params.contentType !== ContentType.PDF) {
      logger.debug('AiKnowledgeBaseService: Skipping agent upload for non-PDF content', {
        businessId: params.businessId,
        courseId: params.courseId,
        contentType: params.contentType,
      });
      return null;
    }

    if (params.subjectId === undefined) {
      logger.info('AiKnowledgeBaseService: Skipping agent upload - content has no subject assigned', {
        businessId: params.businessId,
        courseId: params.courseId,
      });
      return null;
    }

    const buffer = await fs.readFile(params.filePath);
    const formData = new FormData();
    formData.append('business_id', String(params.businessId));
    formData.append('course_ids', String(params.courseId));
    formData.append('subject_ids', String(params.subjectId));
    formData.append(
      'files',
      new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      params.originalFileName || path.basename(params.filePath),
    );

    logger.info('AiKnowledgeBaseService: Sending document to CK Agent', {
      businessId: params.businessId,
      courseId: params.courseId,
      subjectId: params.subjectId,
      contentType: params.contentType,
      fileName: params.originalFileName || path.basename(params.filePath),
      fileSize: buffer.length,
    });
    const response = await this.agentClient.postForm<AgentUploadResponse>('/llm/upload', formData);
    logger.info('AiKnowledgeBaseService: CK Agent accepted document upload', {
      businessId: params.businessId,
      courseId: params.courseId,
      requestId: response.request_id,
      message: response.message,
    });
    return response;
  }

  async queryKnowledgeBase(params: {
    businessId: number;
    query: string;
    user: IUser;
    jobId: string;
  }): Promise<KnowledgeBaseQueryResponse> {
    const courseIds = await this.resolveEnrolledCourseIds(params.businessId, params.user);

    return this.queryAgentClient.postJson<KnowledgeBaseQueryResponse>('/llm/kb/query', {
      job_id: params.jobId,
      business_id: String(params.businessId),
      course_ids: courseIds.map(String),
      query: params.query,
    });
  }

  async stopQuery(jobId: string): Promise<void> {
    logger.info('AiKnowledgeBaseService: Requesting CK Agent to stop query job', { jobId });
    try {
      await this.agentClient.postEmpty(`/query/${encodeURIComponent(jobId)}/stop`);
    } catch (error) {
      logger.warn('AiKnowledgeBaseService: Failed to stop CK Agent query job', {
        jobId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolveEnrolledCourseIds(businessId: number, user: IUser): Promise<number[]> {
    if (user.role !== UserRole.STUDENT || !user.businessId || user.businessId !== businessId) {
      throw new ForbiddenError('You do not have access to this knowledge base');
    }

    const { courseIds } = await batchRepo.findUserBatchAndCourseMembership(businessId, user.id);
    if (courseIds.length === 0) {
      throw new ForbiddenError('You must be enrolled in a course to use Contentkosh AI');
    }

    return courseIds;
  }
}

export const aiKnowledgeBaseService = new AiKnowledgeBaseService();
