-- CreateTable
CREATE TABLE "ai_chats" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "user_message" TEXT NOT NULL,
    "assistant_response" TEXT NOT NULL,
    "source" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chats_user_id_idx" ON "ai_chats"("user_id");

-- CreateIndex
CREATE INDEX "ai_chats_course_id_idx" ON "ai_chats"("course_id");

-- CreateIndex
CREATE INDEX "ai_chats_business_id_idx" ON "ai_chats"("business_id");

-- CreateIndex
CREATE INDEX "ai_chats_user_id_created_at_idx" ON "ai_chats"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_chats_business_id_created_at_idx" ON "ai_chats"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
