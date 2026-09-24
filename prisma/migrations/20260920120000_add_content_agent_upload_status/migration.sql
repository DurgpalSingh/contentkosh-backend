-- CreateEnum
CREATE TYPE "ContentAgentUploadStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "contents"
  ADD COLUMN "agent_upload_status" "ContentAgentUploadStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "agent_upload_error" TEXT;
