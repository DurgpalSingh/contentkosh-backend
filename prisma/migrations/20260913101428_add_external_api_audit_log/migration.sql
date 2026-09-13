-- CreateTable
CREATE TABLE "public"."external_api_audit_logs" (
    "id" SERIAL NOT NULL,
    "service_name" TEXT NOT NULL,
    "business_id" INTEGER,
    "user_id" INTEGER,
    "role" TEXT,
    "http_method" TEXT NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_path" TEXT NOT NULL,
    "request_body" JSONB,
    "response_status" INTEGER,
    "response_time_ms" INTEGER NOT NULL,
    "response_body" JSONB,
    "is_success" BOOLEAN NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_api_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_api_audit_logs_service_name_idx" ON "public"."external_api_audit_logs"("service_name");

-- CreateIndex
CREATE INDEX "external_api_audit_logs_business_id_idx" ON "public"."external_api_audit_logs"("business_id");

-- CreateIndex
CREATE INDEX "external_api_audit_logs_created_at_idx" ON "public"."external_api_audit_logs"("created_at");
