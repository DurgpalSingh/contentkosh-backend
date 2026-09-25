import { UserRole } from '@prisma/client';
import { AIChatService } from '../../../src/services/aiChat.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import * as aiChatRepo from '../../../src/repositories/aiChat.repo';
import { AiAgentError } from '../../../src/services/aiAgent.client';

jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/aiChat.repo');
jest.mock('../../../src/utils/logger');

const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve));

describe('AIChatService', () => {
  let service: AIChatService;
  const knowledgeBaseService = { queryKnowledgeBase: jest.fn() };
  const student = { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIChatService(knowledgeBaseService as any);
    (aiChatRepo.failPendingAIChats as jest.Mock).mockResolvedValue(0);
  });

  describe('submitQuery', () => {
    const pendingChat = {
      id: 11,
      userId: 7,
      businessId: 1,
      userMessage: 'What is photosynthesis?',
      assistantResponse: null,
      source: null,
      status: 'PENDING',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
        batchIds: [1],
        courseIds: [2],
      });
      (aiChatRepo.findPendingAIChatByUser as jest.Mock).mockResolvedValue(null);
      (aiChatRepo.createPendingAIChat as jest.Mock).mockResolvedValue(pendingChat);
      (aiChatRepo.completePendingAIChat as jest.Mock).mockResolvedValue(1);
    });

    it('returns the pending chat immediately and stores the answer in the background', async () => {
      knowledgeBaseService.queryKnowledgeBase.mockResolvedValue({ answer: 'Plants make food', page: 3 });

      const result = await service.submitQuery({ businessId: 1, user: student, query: 'What is photosynthesis?' });

      expect(result).toMatchObject({ id: 11, status: 'PENDING', assistantResponse: null });
      expect(aiChatRepo.createPendingAIChat).toHaveBeenCalledWith({
        userId: 7,
        businessId: 1,
        userMessage: 'What is photosynthesis?',
      });

      await flushBackgroundWork();
      expect(aiChatRepo.completePendingAIChat).toHaveBeenCalledWith(11, {
        assistantResponse: 'Plants make food',
        source: { answer: 'Plants make food', page: 3 },
      });
    });

    it('marks the chat as failed with the agent error message', async () => {
      knowledgeBaseService.queryKnowledgeBase.mockRejectedValue(new AiAgentError('AI agent request timed out', 504));

      await service.submitQuery({ businessId: 1, user: student, query: 'What is photosynthesis?' });
      await flushBackgroundWork();

      expect(aiChatRepo.completePendingAIChat).not.toHaveBeenCalled();
      expect(aiChatRepo.failPendingAIChats).toHaveBeenCalledWith({ id: 11 }, 'AI agent request timed out');
    });

    it('rejects a new question while a previous one is still pending', async () => {
      (aiChatRepo.findPendingAIChatByUser as jest.Mock).mockResolvedValue(pendingChat);

      await expect(
        service.submitQuery({ businessId: 1, user: student, query: 'Another question' }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(aiChatRepo.createPendingAIChat).not.toHaveBeenCalled();
    });

    it('expires stale pending chats before checking for an in-flight question', async () => {
      await service.submitQuery({ businessId: 1, user: student, query: 'What is photosynthesis?' });

      expect(aiChatRepo.failPendingAIChats).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, businessId: 1, createdBefore: expect.any(Date) }),
        expect.any(String),
      );
    });
  });

  describe('getChat', () => {
    it('returns a chat owned by the student', async () => {
      (aiChatRepo.findAIChatById as jest.Mock).mockResolvedValue({
        id: 11,
        userId: 7,
        businessId: 1,
        userMessage: 'Hi',
        assistantResponse: 'Hello',
        source: null,
        status: 'COMPLETED',
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getChat({ businessId: 1, chatId: 11, user: student });

      expect(result).toMatchObject({ id: 11, status: 'COMPLETED', assistantResponse: 'Hello' });
    });

    it('rejects a chat owned by another student', async () => {
      (aiChatRepo.findAIChatById as jest.Mock).mockResolvedValue({ id: 11, userId: 8, businessId: 1 });

      await expect(service.getChat({ businessId: 1, chatId: 11, user: student })).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('saveChat', () => {
    it('saves a chat for enrolled student', async () => {
      (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
        batchIds: [1],
        courseIds: [2],
      });
      (aiChatRepo.createAIChat as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 7,
        businessId: 1,
        userMessage: 'Hello AI',
        assistantResponse: 'Hello there',
        source: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.saveChat({
        businessId: 1,
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
        dto: {
          userMessage: 'Hello AI',
          assistantResponse: 'Hello there',
        },
      });

      expect(result.id).toBe(1);
      expect(aiChatRepo.createAIChat).toHaveBeenCalled();
    });

    it('rejects chat from non-student user', async () => {
      await expect(
        service.saveChat({
          businessId: 1,
          user: { id: 7, email: 'admin@test.com', role: UserRole.ADMIN, businessId: 1 },
          dto: {
            userMessage: 'Hello AI',
            assistantResponse: 'Hello there',
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this course',
      });
    });

    it('rejects chat from student not enrolled in any course', async () => {
      (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
        batchIds: [],
        courseIds: [],
      });

      await expect(
        service.saveChat({
          businessId: 1,
          user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
          dto: {
            userMessage: 'Hello AI',
            assistantResponse: 'Hello there',
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You must be enrolled in a course to chat with AI',
      });
    });
  });

  describe('getChatsByUser', () => {
    it('retrieves chats for enrolled student', async () => {
      (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
        batchIds: [1],
        courseIds: [2],
      });
      (aiChatRepo.findAIChatsByUser as jest.Mock).mockResolvedValue([
        {
          id: 1,
          userId: 7,
          businessId: 1,
          userMessage: 'Hello AI',
          assistantResponse: 'Hello there',
          source: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      (aiChatRepo.countAIChatsByUser as jest.Mock).mockResolvedValue(1);

      const result = await service.getChatsByUser({
        businessId: 1,
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
        limit: 10,
        offset: 0,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(aiChatRepo.findAIChatsByUser).toHaveBeenCalled();
    });

    it('limits result to 200 max even if higher limit requested', async () => {
      (batchRepo.findUserBatchAndCourseMembership as jest.Mock).mockResolvedValue({
        batchIds: [1],
        courseIds: [2],
      });
      (aiChatRepo.findAIChatsByUser as jest.Mock).mockResolvedValue([]);
      (aiChatRepo.countAIChatsByUser as jest.Mock).mockResolvedValue(0);

      await service.getChatsByUser({
        businessId: 1,
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
        limit: 500,
        offset: 0,
      });

      expect(aiChatRepo.findAIChatsByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 200,
        }),
      );
    });
  });

  describe('deleteChat', () => {
    it('deletes chat owned by user', async () => {
      (aiChatRepo.findAIChatById as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 7,
        businessId: 1,
        userMessage: 'Hello AI',
        assistantResponse: 'Hello there',
        source: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.deleteChat({
        businessId: 1,
        chatId: 1,
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      });

      expect(aiChatRepo.deleteAIChatById).toHaveBeenCalledWith(1);
    });

    it('rejects delete of chat not owned by user', async () => {
      (aiChatRepo.findAIChatById as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 8, // Different user
        businessId: 1,
        userMessage: 'Hello AI',
        assistantResponse: 'Hello there',
        source: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.deleteChat({
          businessId: 1,
          chatId: 1,
          user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to delete this chat',
      });
    });

    it('throws NotFoundError if chat does not exist', async () => {
      (aiChatRepo.findAIChatById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteChat({
          businessId: 1,
          chatId: 999,
          user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Chat not found',
      });
    });
  });

  describe('deleteOldChats', () => {
    it('deletes chats older than retention days', async () => {
      (aiChatRepo.deleteOldAIChatsByBusiness as jest.Mock).mockResolvedValue(5);

      const result = await service.deleteOldChats(1, 7);

      expect(result).toBe(5);
      expect(aiChatRepo.deleteOldAIChatsByBusiness).toHaveBeenCalledWith(1, expect.any(Date));
    });
  });

  describe('deleteAllOldChats', () => {
    it('deletes all chats older than retention days across all businesses', async () => {
      (aiChatRepo.deleteOldAIChats as jest.Mock).mockResolvedValue(10);

      const result = await service.deleteAllOldChats(7);

      expect(result).toBe(10);
      expect(aiChatRepo.deleteOldAIChats).toHaveBeenCalledWith(expect.any(Date));
    });
  });
});
