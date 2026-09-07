-- DropForeignKey
ALTER TABLE "public"."ai_chats" DROP CONSTRAINT "ai_chats_course_id_fkey";

-- AlterTable
ALTER TABLE "public"."ai_chats" ALTER COLUMN "course_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."ai_chats" ADD CONSTRAINT "ai_chats_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
