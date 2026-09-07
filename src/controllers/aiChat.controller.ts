import { Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthRequest } from '../dtos/auth.dto';
import { SaveAIChatDto, GetAIChatDto } from '../dtos/ai.dto';
import { ValidationUtils } from '../utils/validation';
import { BadRequestError } from '../errors/api.errors';
import { ApiResponseHandler } from '../utils/apiResponse';
import { handleControllerError } from '../utils/controllerErrorHandler';
import { AIChatService, aiChatService } from '../services/aiChat.service';

export class AIChatController {
  constructor(private readonly service: AIChatService = aiChatService) {}

  public saveChat = async (req: AuthRequest, res: Response) => {
    try {
      const businessId = ValidationUtils.validateId(req.params.businessId, 'Business ID');
      const dto = plainToInstance(SaveAIChatDto, req.body);
      const user = req.user!;

      const result = await this.service.saveChat({
        businessId,
        user,
        dto,
      });

      ApiResponseHandler.success(res, result, 'Chat saved successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to save chat', 'Error saving chat');
    }
  };

  public getChats = async (req: AuthRequest, res: Response) => {
    try {
      const businessId = ValidationUtils.validateId(req.params.businessId, 'Business ID');
      const dto = plainToInstance(GetAIChatDto, req.query);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const message = errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('; ');
        throw new BadRequestError(message);
      }
      const user = req.user!;

      const result = await this.service.getChatsByUser({
        businessId,
        user,
        limit: dto.limit,
        offset: dto.offset,
      });

      ApiResponseHandler.success(res, result, 'Chats retrieved successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to retrieve chats', 'Error retrieving chats');
    }
  };

  public deleteChat = async (req: AuthRequest, res: Response) => {
    try {
      const businessId = ValidationUtils.validateId(req.params.businessId, 'Business ID');
      const chatId = ValidationUtils.validateId(req.params.chatId, 'Chat ID');
      const user = req.user!;

      await this.service.deleteChat({
        businessId,
        chatId,
        user,
      });

      ApiResponseHandler.success(res, null, 'Chat deleted successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to delete chat', 'Error deleting chat');
    }
  };
}

export const aiChatController = new AIChatController();
