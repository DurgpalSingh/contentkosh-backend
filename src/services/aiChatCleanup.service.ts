import { aiChatConfig } from '../config/aiChat.config';
import { AIChatService, aiChatService as defaultAiChatService } from './aiChat.service';
import logger from '../utils/logger';

/**
 * AI Chat Cleanup Service
 * Handles scheduled deletion of old chat messages
 */
export class AIChatCleanupService {
  constructor(private readonly aiChatService: AIChatService = defaultAiChatService) {}

  /**
   * Cleanup old chats across all businesses
   * This should be called by a cron job
   */
  async cleanupOldChats(): Promise<void> {
    try {
      logger.info(`Starting AI chat cleanup (retention: ${aiChatConfig.retentionDays} days)`);

      const deletedCount = await this.aiChatService.deleteAllOldChats(aiChatConfig.retentionDays);

      logger.info(`AI chat cleanup completed. Deleted ${deletedCount} old chat messages.`);
    } catch (error) {
      logger.error('AI chat cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup old chats for a specific business
   * Useful for business-specific maintenance tasks
   */
  async cleanupBusinessChats(businessId: number): Promise<void> {
    try {
      logger.info(
        `Starting AI chat cleanup for business ${businessId} (retention: ${aiChatConfig.retentionDays} days)`,
      );

      const deletedCount = await this.aiChatService.deleteOldChats(
        businessId,
        aiChatConfig.retentionDays,
      );

      logger.info(
        `AI chat cleanup for business ${businessId} completed. Deleted ${deletedCount} old chat messages.`,
      );
    } catch (error) {
      logger.error(`AI chat cleanup for business ${businessId} failed:`, error);
      throw error;
    }
  }
}

export const aiChatCleanupService = new AIChatCleanupService();
