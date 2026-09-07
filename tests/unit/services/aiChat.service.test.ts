import { UserRole } from '@prisma/client';
import { AIChatService } from '../../../src/services/aiChat.service';
import * as batchRepo from '../../../src/repositories/batch.repo';
import * as aiChatRepo from '../../../src/repositories/aiChat.repo';
import { ForbiddenError, NotFoundError } from '../../../src/errors/api.errors';

jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/aiChat.repo');

describe('AIChatService', () => {
  let service: AIChatService;

  beforeEach(() => {
    service = new AIChatService();
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
