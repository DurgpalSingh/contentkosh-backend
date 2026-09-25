import { Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { AuthRequest } from '../dtos/auth.dto';
import { QueryKnowledgeBaseDto } from '../dtos/ai.dto';
import { ValidationUtils } from '../utils/validation';
import { ApiResponseHandler } from '../utils/apiResponse';
import { handleControllerError } from '../utils/controllerErrorHandler';
import { AIChatService, aiChatService } from '../services/aiChat.service';

export class AiKnowledgeBaseController {
  constructor(private readonly service: AIChatService = aiChatService) {}

  // Returns the PENDING chat immediately; the answer is filled in the background and fetched via GET /ai/chats/:chatId.
  public queryKnowledgeBase = async (req: AuthRequest, res: Response) => {
    try {
      const businessId = ValidationUtils.validateId(req.params.businessId, 'Business ID');
      const dto = plainToInstance(QueryKnowledgeBaseDto, req.body);
      const user = req.user!;

      const result = await this.service.submitQuery({
        businessId,
        query: dto.query,
        user,
      });

      ApiResponseHandler.success(res, result, 'Question sent to Contentkosh AI');
    } catch (error) {
      handleControllerError(res, error, 'Failed to query Contentkosh AI', 'Error querying Contentkosh AI');
    }
  };
}

export const aiKnowledgeBaseController = new AiKnowledgeBaseController();
