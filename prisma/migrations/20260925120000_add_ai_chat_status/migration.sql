-- CreateEnum
CREATE TYPE "public"."AIChatStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."ai_chats"
  ADD COLUMN "status" "public"."AIChatStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "error_message" TEXT,
  ALTER COLUMN "assistant_response" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ai_chats_user_id_business_id_status_idx" ON "public"."ai_chats"("user_id", "business_id", "status");
