import { Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { AuthRequest } from '../dtos/auth.dto';
import { QueryKnowledgeBaseDto } from '../dtos/ai.dto';
import { ValidationUtils } from '../utils/validation';
import { ApiResponseHandler } from '../utils/apiResponse';
import { handleControllerError } from '../utils/controllerErrorHandler';
import { AiKnowledgeBaseService } from '../services/aiKnowledgeBase.service';

export class AiKnowledgeBaseController {
  constructor(private readonly service: AiKnowledgeBaseService) {}

  public queryKnowledgeBase = async (req: AuthRequest, res: Response) => {
    try {
      const businessId = ValidationUtils.validateId(req.params.businessId, 'Business ID');
      const dto = plainToInstance(QueryKnowledgeBaseDto, req.body);
      const user = req.user!;

      const result = await this.service.queryKnowledgeBase({
        businessId,
        courseId: dto.courseId,
        query: dto.query,
        user,
      });

      ApiResponseHandler.success(res, result, 'Contentkosh AI answered successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to query Contentkosh AI', 'Error querying Contentkosh AI');
    }
  };
}

export const aiKnowledgeBaseController = new AiKnowledgeBaseController(new AiKnowledgeBaseService());
