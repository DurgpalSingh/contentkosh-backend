import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../middlewares/auth.middleware';
import { authorizeBusinessAccess, validateIdParam } from '../middlewares/validation.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { SaveAIChatDto, GetAIChatDto } from '../dtos/ai.dto';
import { aiChatController } from '../controllers/aiChat.controller';

export const aiChatRouter = Router();

// Save a new chat
aiChatRouter.post(
  '/:businessId/ai/chats',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(SaveAIChatDto),
  aiChatController.saveChat,
);

// Get user's chats for a course
aiChatRouter.get(
  '/:businessId/ai/chats',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  aiChatController.getChats,
);

// Delete a specific chat
aiChatRouter.delete(
  '/:businessId/ai/chats/:chatId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateIdParam('chatId'),
  authorizeBusinessAccess,
  aiChatController.deleteChat,
);
