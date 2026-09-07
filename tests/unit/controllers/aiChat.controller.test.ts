import { Response } from 'express';
import { AuthRequest } from '../../../src/dtos/auth.dto';
import { AIChatController } from '../../../src/controllers/aiChat.controller';
import { AIChatService } from '../../../src/services/aiChat.service';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../../../src/errors/api.errors';

describe('AIChatController', () => {
  let controller: AIChatController;
  let service: Partial<AIChatService>;

  beforeEach(() => {
    service = {
      saveChat: jest.fn(),
      getChatsByUser: jest.fn(),
      deleteChat: jest.fn(),
    };

    controller = new AIChatController(service as AIChatService);
  });

  describe('saveChat', () => {
    it('saves a chat successfully', async () => {
      const mockReq = {
        params: { businessId: '1' },
        body: {
          userMessage: 'Hello AI',
          assistantResponse: 'Hello there',
          source: null,
        },
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const mockChat = {
        id: 1,
        userId: 7,
        businessId: 1,
        userMessage: 'Hello AI',
        assistantResponse: 'Hello there',
        source: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (service.saveChat as jest.Mock).mockResolvedValue(mockChat);

      await controller.saveChat(mockReq, mockRes);

      expect(service.saveChat).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 403 when user is not enrolled in course', async () => {
      const mockReq = {
        params: { businessId: '1' },
        body: {
          userMessage: 'Hello AI',
          assistantResponse: 'Hello there',
        },
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      (service.saveChat as jest.Mock).mockRejectedValue(
        new ForbiddenError('You do not have access to this course'),
      );

      await controller.saveChat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getChats', () => {
    it('retrieves chats for user successfully', async () => {
      const mockReq = {
        params: { businessId: '1' },
        query: { limit: '10', offset: '0' },
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const mockChats = {
        data: [
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
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };

      (service.getChatsByUser as jest.Mock).mockResolvedValue(mockChats);

      await controller.getChats(mockReq, mockRes);

      expect(service.getChatsByUser).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteChat', () => {
    it('deletes a chat successfully', async () => {
      const mockReq = {
        params: { businessId: '1', chatId: '1' },
        user: { id: 7, email: 's@test.com', role: UserRole.STUDENT, businessId: 1 },
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      (service.deleteChat as jest.Mock).mockResolvedValue(undefined);

      await controller.deleteChat(mockReq, mockRes);

      expect(service.deleteChat).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
