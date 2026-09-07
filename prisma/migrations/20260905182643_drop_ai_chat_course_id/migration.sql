/*
  Warnings:

  - You are about to drop the column `course_id` on the `ai_chats` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ai_chats" DROP CONSTRAINT "ai_chats_course_id_fkey";

-- DropIndex
DROP INDEX "public"."ai_chats_course_id_idx";

-- AlterTable
ALTER TABLE "public"."ai_chats" DROP COLUMN "course_id";
