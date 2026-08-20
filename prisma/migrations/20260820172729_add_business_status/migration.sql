-- CreateEnum
CREATE TYPE "public"."BusinessStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');

-- AlterTable
ALTER TABLE "public"."business" ADD COLUMN     "status" "public"."BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" INTEGER,
ADD COLUMN     "status_reason" TEXT;
