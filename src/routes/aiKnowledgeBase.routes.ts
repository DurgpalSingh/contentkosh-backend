import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../middlewares/auth.middleware';
import { authorizeBusinessAccess, validateIdParam } from '../middlewares/validation.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { QueryKnowledgeBaseDto } from '../dtos/ai.dto';
import { aiKnowledgeBaseController } from '../controllers/aiKnowledgeBase.controller';

export const aiKnowledgeBaseRouter = Router();

aiKnowledgeBaseRouter.post(
  '/:businessId/ai/kb/query',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(QueryKnowledgeBaseDto),
  aiKnowledgeBaseController.queryKnowledgeBase,
);
