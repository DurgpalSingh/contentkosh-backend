import { UserRole } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { SaveAIChatDto, AIChatResponseDto, AIChatListResponseDto, KnowledgeBaseQueryResponse } from '../dtos/ai.dto';
import * as batchRepo from '../repositories/batch.repo';
import * as aiChatRepo from '../repositories/aiChat.repo';

export class AIChatService {
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
    const chat = await aiChatRepo.findAIChatById(params.chatId);

    if (!chat) {
      throw new NotFoundError('Chat');
    }

    if (chat.userId !== params.user.id || chat.businessId !== params.businessId) {
      throw new ForbiddenError('You do not have permission to delete this chat');
    }

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
    assistantResponse: string;
    source: unknown;
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
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }
}

export const aiChatService = new AIChatService();
