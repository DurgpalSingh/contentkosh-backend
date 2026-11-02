-- CreateTable
CREATE TABLE "public"."email_verification_tokens" (
    "user_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "public"."email_verification_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "public"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every account that exists before email verification was introduced is treated as verified,
-- otherwise the new login gate would lock all of them out.
UPDATE "public"."users" SET "email_verified" = true WHERE "email_verified" = false;
