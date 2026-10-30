-- CreateTable
CREATE TABLE "public"."subjective_tests" (
    "id" TEXT NOT NULL,
    "business_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "subject_id" INTEGER,
    "name" TEXT NOT NULL,
    "paper_type" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "question_paper_path" TEXT,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjective_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subjective_test_submissions" (
    "id" TEXT NOT NULL,
    "subjective_test_id" TEXT NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "answer_sheet_path" TEXT,
    "marks_awarded" DOUBLE PRECISION,
    "remarks" TEXT,
    "checked_answer_sheet_path" TEXT,
    "checked_by" INTEGER,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjective_test_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjective_tests_business_id_status_idx" ON "public"."subjective_tests"("business_id", "status");

-- CreateIndex
CREATE INDEX "subjective_tests_batch_id_status_idx" ON "public"."subjective_tests"("batch_id", "status");

-- CreateIndex
CREATE INDEX "subjective_tests_subject_id_idx" ON "public"."subjective_tests"("subject_id");

-- CreateIndex
CREATE INDEX "subjective_test_submissions_subjective_test_id_status_idx" ON "public"."subjective_test_submissions"("subjective_test_id", "status");

-- CreateIndex
CREATE INDEX "subjective_test_submissions_student_id_status_idx" ON "public"."subjective_test_submissions"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subjective_test_submissions_subjective_test_id_student_id_key" ON "public"."subjective_test_submissions"("subjective_test_id", "student_id");

-- AddForeignKey
ALTER TABLE "public"."subjective_tests" ADD CONSTRAINT "subjective_tests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjective_tests" ADD CONSTRAINT "subjective_tests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjective_tests" ADD CONSTRAINT "subjective_tests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjective_test_submissions" ADD CONSTRAINT "subjective_test_submissions_subjective_test_id_fkey" FOREIGN KEY ("subjective_test_id") REFERENCES "public"."subjective_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

