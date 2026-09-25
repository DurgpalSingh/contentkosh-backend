import { UserRole } from '@prisma/client';
import { ApiError, BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import {
  SaveAIChatDto,
  AIChatResponseDto,
  AIChatListResponseDto,
  AIChatStatusDto,
  KnowledgeBaseQueryResponse,
} from '../dtos/ai.dto';
import { config } from '../config/config';
import * as batchRepo from '../repositories/batch.repo';
import * as aiChatRepo from '../repositories/aiChat.repo';
import { AiKnowledgeBaseService, aiKnowledgeBaseService } from './aiKnowledgeBase.service';
import logger from '../utils/logger';

const DEFAULT_AI_ERROR_MESSAGE = 'Contentkosh AI could not answer right now';
const INTERRUPTED_AI_ERROR_MESSAGE = 'Contentkosh AI was interrupted. Please ask again.';
// A PENDING chat older than this can no longer be answered (e.g. the server restarted mid-request).
const STALE_PENDING_GRACE_MS = 60_000;

export class AIChatService {
  constructor(private readonly knowledgeBaseService: AiKnowledgeBaseService = aiKnowledgeBaseService) {}

  /**
   * Stores the question as a PENDING chat and answers it in the background, so the
   * request survives the student refreshing or leaving the page. Clients poll the chat.
   */
  async submitQuery(params: {
    businessId: number;
    user: IUser;
    query: string;
  }): Promise<AIChatResponseDto> {
    await this.validateStudentEnrollment(params.businessId, params.user);
    await this.failStalePendingChats(params.businessId, params.user.id);

    const pending = await aiChatRepo.findPendingAIChatByUser(params.user.id, params.businessId);
    if (pending) {
      throw new BadRequestError('Please wait for Contentkosh AI to answer your previous question');
    }

    const chat = await aiChatRepo.createPendingAIChat({
      userId: params.user.id,
      businessId: params.businessId,
      userMessage: params.query,
    });

    void this.answerPendingChat(chat.id, params);

    return this.mapToResponseDto(chat);
  }

  async getChat(params: {
    businessId: number;
    chatId: number;
    user: IUser;
  }): Promise<AIChatResponseDto> {
    await this.failStalePendingChats(params.businessId, params.user.id);
    const chat = await this.findOwnedChat(params, 'You do not have permission to view this chat');
    return this.mapToResponseDto(chat);
  }

  private async answerPendingChat(
    chatId: number,
    params: { businessId: number; user: IUser; query: string },
  ): Promise<void> {
    try {
      const answer = await this.knowledgeBaseService.queryKnowledgeBase(params);
      const updated = await aiChatRepo.completePendingAIChat(chatId, {
        assistantResponse: answer?.answer || 'No answer was returned.',
        source: answer ? (answer as unknown as object) : null,
      });
      if (updated === 0) {
        logger.info('AIChatService: Chat was cancelled before the agent answered', { chatId });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : DEFAULT_AI_ERROR_MESSAGE;
      logger.error('AIChatService: Failed to answer chat', {
        chatId,
        message: error instanceof Error ? error.message : String(error),
      });
      try {
        await aiChatRepo.failPendingAIChats({ id: chatId }, message);
      } catch (statusError) {
        logger.error('AIChatService: Failed to mark chat as failed', {
          chatId,
          message: statusError instanceof Error ? statusError.message : String(statusError),
        });
      }
    }
  }

  private async failStalePendingChats(businessId: number, userId: number): Promise<void> {
    const createdBefore = new Date(Date.now() - config.aiAgent.timeoutMs - STALE_PENDING_GRACE_MS);
    await aiChatRepo.failPendingAIChats(
      { userId, businessId, createdBefore },
      INTERRUPTED_AI_ERROR_MESSAGE,
    );
  }

  private async findOwnedChat(
    params: { businessId: number; chatId: number; user: IUser },
    forbiddenMessage: string,
  ) {
    const chat = await aiChatRepo.findAIChatById(params.chatId);

    if (!chat) {
      throw new NotFoundError('Chat');
    }

    if (chat.userId !== params.user.id || chat.businessId !== params.businessId) {
      throw new ForbiddenError(forbiddenMessage);
    }

    return chat;
  }
  async saveChat(params: {
    businessId: number;
    user: IUser;
    dto: SaveAIChatDto;
  }): Promise<AIChatResponseDto> {
    // Validate user is an enrolled student in this business
    await this.validateStudentEnrollment(params.businessId, params.user);

    const chat = await aiChatRepo.createAIChat({
      userId: params.user.id,
      businessId: params.businessId,
      userMessage: params.dto.userMessage,
      assistantResponse: params.dto.assistantResponse,
      source: params.dto.source ? (params.dto.source as unknown as object) : null,
    });

    return this.mapToResponseDto(chat);
  }

  async getChatsByUser(params: {
    businessId: number;
    user: IUser;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<AIChatListResponseDto> {
    // Validate user is an enrolled student in this business
    await this.validateStudentEnrollment(params.businessId, params.user);
    await this.failStalePendingChats(params.businessId, params.user.id);

    const limit = Math.min(params.limit || 50, 200); // Max 200, default 50
    const offset = params.offset || 0;

    const [chats, total] = await Promise.all([
      aiChatRepo.findAIChatsByUser({
        userId: params.user.id,
        businessId: params.businessId,
        limit,
        offset,
      }),
      aiChatRepo.countAIChatsByUser({
        userId: params.user.id,
        businessId: params.businessId,
      }),
    ]);

    return {
      data: chats.map(chat => this.mapToResponseDto(chat)),
      total,
      limit,
      offset,
    };
  }

  async deleteOldChats(businessId: number, retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return aiChatRepo.deleteOldAIChatsByBusiness(businessId, cutoffDate);
  }

  async deleteAllOldChats(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return aiChatRepo.deleteOldAIChats(cutoffDate);
  }

  async deleteChat(params: {
    businessId: number;
    chatId: number;
    user: IUser;
  }): Promise<void> {
    await this.findOwnedChat(params, 'You do not have permission to delete this chat');

    await aiChatRepo.deleteAIChatById(params.chatId);
  }

  private async validateStudentEnrollment(businessId: number, user: IUser): Promise<void> {
    if (user.role !== UserRole.STUDENT || !user.businessId || user.businessId !== businessId) {
      throw new ForbiddenError('You do not have access to this course');
    }

    const { courseIds } = await batchRepo.findUserBatchAndCourseMembership(businessId, user.id);
    if (courseIds.length === 0) {
      throw new ForbiddenError('You must be enrolled in a course to chat with AI');
    }
  }

  private mapToResponseDto(chat: {
    id: number;
    userId: number;
    businessId: number;
    userMessage: string;
    assistantResponse: string | null;
    source: unknown;
    status: AIChatStatusDto;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AIChatResponseDto {
    return {
      id: chat.id,
      userId: chat.userId,
      businessId: chat.businessId,
      userMessage: chat.userMessage,
      assistantResponse: chat.assistantResponse,
      source: chat.source as KnowledgeBaseQueryResponse | null,
      status: chat.status,
      errorMessage: chat.errorMessage,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }
}

export const aiChatService = new AIChatService();
