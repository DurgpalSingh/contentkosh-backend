/**
 * AI Chat Configuration
 * Contains settings for AI chat behavior and retention policies
 */

export const aiChatConfig = {
  // Chat retention period in days (default 6 days, configurable via env)
  retentionDays: parseInt(process.env.AI_CHAT_RETENTION_DAYS || '6', 10),

  // Maximum chats to return per request
  maxChatsPerRequest: 200,

  // Default limit if not specified by client
  defaultChatsLimit: 50,

  // Schedule for cron job to clean old chats (every day at 2 AM)
  cleanupSchedule: process.env.AI_CHAT_CLEANUP_SCHEDULE || '0 2 * * *',
};

// Validation
if (aiChatConfig.retentionDays < 1 || aiChatConfig.retentionDays > 365) {
  throw new Error('AI_CHAT_RETENTION_DAYS must be between 1 and 365 days');
}
