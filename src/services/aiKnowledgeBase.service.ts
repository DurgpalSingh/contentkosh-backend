import { ContentType, UserRole } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { KnowledgeBaseQueryResponse } from '../dtos/ai.dto';
import { AiAgentClient, aiAgentClient } from './aiAgent.client';
import * as batchRepo from '../repositories/batch.repo';

interface AgentUploadResponse {
  request_id?: string;
  message?: string;
}

export class AiKnowledgeBaseService {
  constructor(private readonly agentClient: AiAgentClient = aiAgentClient) {}

  async uploadPdfToKnowledgeBase(params: {
    filePath: string;
    originalFileName?: string;
    businessId: number;
    courseId: number;
    contentType: ContentType;
  }): Promise<AgentUploadResponse | null> {
    if (params.contentType !== ContentType.PDF) {
      return null;
    }

    const buffer = await fs.readFile(params.filePath);
    const formData = new FormData();
    formData.append('business_id', String(params.businessId));
    formData.append('course_ids', String(params.courseId));
    formData.append(
      'files',
      new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      params.originalFileName || path.basename(params.filePath),
    );

    return this.agentClient.postForm<AgentUploadResponse>('/llm/upload', formData);
  }

  async queryKnowledgeBase(params: {
    businessId: number;
    query: string;
    user: IUser;
  }): Promise<KnowledgeBaseQueryResponse> {
    const courseIds = await this.resolveEnrolledCourseIds(params.businessId, params.user);

    return this.agentClient.postJson<KnowledgeBaseQueryResponse>('/llm/kb/query', {
      business_id: String(params.businessId),
      course_ids: courseIds.map(String),
      query: params.query,
    });
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
