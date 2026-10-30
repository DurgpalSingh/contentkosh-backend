-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'USER');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ExamStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."CourseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."SubjectStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."AnnouncementScope" AS ENUM ('COURSE', 'BATCH');

-- CreateEnum
CREATE TYPE "public"."BusinessProvisioningStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('PDF', 'IMAGE', 'DOC');

-- CreateEnum
CREATE TYPE "public"."ContentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "public"."TestLanguage" AS ENUM ('hi', 'en');

-- CreateTable
CREATE TABLE "public"."system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "profile_picture" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business" (
    "id" SERIAL NOT NULL,
    "institute_name" TEXT NOT NULL,
    "slug" TEXT,
    "schema_name" TEXT,
    "provisioning_status" "public"."BusinessProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "logo" TEXT,
    "tagline" TEXT,
    "contact_number" TEXT,
    "email" TEXT,
    "address" TEXT,
    "youtube_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "facebook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "provisioned_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business_slug_history" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."batches" (
    "id" SERIAL NOT NULL,
    "code_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "course_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."batch_users" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."announcements" (
    "id" SERIAL NOT NULL,
    "heading" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "business_id" INTEGER NOT NULL,
    "visible_to_admins" BOOLEAN NOT NULL DEFAULT false,
    "visible_to_teachers" BOOLEAN NOT NULL DEFAULT false,
    "visible_to_students" BOOLEAN NOT NULL DEFAULT false,
    "scope" "public"."AnnouncementScope" NOT NULL DEFAULT 'BATCH',
    "target_all_courses" BOOLEAN NOT NULL DEFAULT false,
    "target_all_batches" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."announcement_targets" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "batch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exams" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "public"."ExamStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "business_id" INTEGER NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."courses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "public"."CourseStatus" NOT NULL DEFAULT 'ACTIVE',
    "exam_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subjects" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "course_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contents" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "subject_id" INTEGER,
    "title" TEXT NOT NULL,
    "type" "public"."ContentType" NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "status" "public"."ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teachers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "qualification" TEXT NOT NULL,
    "experience_years" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "bio" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gender" "public"."Gender",
    "date_of_birth" TIMESTAMP(3),
    "address" TEXT,
    "status" "public"."TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."students" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_id" INTEGER NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" "public"."Gender",
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address" TEXT,
    "city" TEXT,
    "bio" TEXT,
    "status" "public"."StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_audit_logs" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER,
    "user_id" INTEGER,
    "role" TEXT,
    "http_method" TEXT NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_path" TEXT NOT NULL,
    "query_params" JSONB,
    "request_body" JSONB,
    "response_status" INTEGER NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "response_body" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."practice_tests" (
    "id" TEXT NOT NULL,
    "business_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "subject_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "default_marks_per_question" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "show_explanations" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT true,
    "language" "public"."TestLanguage" NOT NULL DEFAULT 'en',
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exam_tests" (
    "id" TEXT NOT NULL,
    "business_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "subject_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "start_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "default_marks_per_question" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "negative_marks_per_question" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "result_visibility" INTEGER NOT NULL DEFAULT 0,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT true,
    "language" "public"."TestLanguage" NOT NULL DEFAULT 'en',
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_questions" (
    "id" TEXT NOT NULL,
    "practice_test_id" TEXT,
    "exam_test_id" TEXT,
    "type" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "correct_text_answer" TEXT,
    "correct_option_ids_answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explanation" TEXT,
    "media_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "media_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_attempts" (
    "id" TEXT NOT NULL,
    "practice_test_id" TEXT,
    "exam_test_id" TEXT,
    "user_id" INTEGER NOT NULL,
    "language" "public"."TestLanguage" NOT NULL DEFAULT 'en',
    "status" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "total_score" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_attempt_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_option_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text_answer" TEXT,
    "is_correct" BOOLEAN,
    "obtained_marks" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_business_id_idx" ON "public"."users"("business_id");

-- CreateIndex
CREATE INDEX "users_business_id_role_idx" ON "public"."users"("business_id", "role");

-- CreateIndex
CREATE INDEX "users_business_id_status_idx" ON "public"."users"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_email_key" ON "public"."users"("business_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_mobile_key" ON "public"."users"("business_id", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "business_slug_key" ON "public"."business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "business_schema_name_key" ON "public"."business"("schema_name");

-- CreateIndex
CREATE INDEX "business_slug_history_business_id_idx" ON "public"."business_slug_history"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_slug_history_slug_key" ON "public"."business_slug_history"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "batches_code_name_key" ON "public"."batches"("code_name");

-- CreateIndex
CREATE INDEX "batches_course_id_idx" ON "public"."batches"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_users_user_id_batch_id_key" ON "public"."batch_users"("user_id", "batch_id");

-- CreateIndex
CREATE INDEX "announcements_business_id_idx" ON "public"."announcements"("business_id");

-- CreateIndex
CREATE INDEX "announcements_created_by_idx" ON "public"."announcements"("created_by");

-- CreateIndex
CREATE INDEX "announcement_targets_announcement_id_idx" ON "public"."announcement_targets"("announcement_id");

-- CreateIndex
CREATE INDEX "announcement_targets_course_id_idx" ON "public"."announcement_targets"("course_id");

-- CreateIndex
CREATE INDEX "announcement_targets_batch_id_idx" ON "public"."announcement_targets"("batch_id");

-- CreateIndex
CREATE INDEX "exams_business_id_name_idx" ON "public"."exams"("business_id", "name");

-- CreateIndex
CREATE INDEX "exams_business_id_idx" ON "public"."exams"("business_id");

-- CreateIndex
CREATE INDEX "exams_business_id_status_idx" ON "public"."exams"("business_id", "status");

-- CreateIndex
CREATE INDEX "courses_exam_id_idx" ON "public"."courses"("exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_exam_id_name_key" ON "public"."courses"("exam_id", "name");

-- CreateIndex
CREATE INDEX "subjects_course_id_idx" ON "public"."subjects"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_course_id_name_key" ON "public"."subjects"("course_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_user_id_permission_id_key" ON "public"."role_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "contents_batch_id_idx" ON "public"."contents"("batch_id");

-- CreateIndex
CREATE INDEX "contents_subject_id_idx" ON "public"."contents"("subject_id");

-- CreateIndex
CREATE INDEX "contents_batch_id_status_idx" ON "public"."contents"("batch_id", "status");

-- CreateIndex
CREATE INDEX "contents_uploaded_by_idx" ON "public"."contents"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "public"."teachers"("user_id");

-- CreateIndex
CREATE INDEX "teachers_user_id_idx" ON "public"."teachers"("user_id");

-- CreateIndex
CREATE INDEX "teachers_business_id_idx" ON "public"."teachers"("business_id");

-- CreateIndex
CREATE INDEX "teachers_status_idx" ON "public"."teachers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "public"."students"("user_id");

-- CreateIndex
CREATE INDEX "students_user_id_idx" ON "public"."students"("user_id");

-- CreateIndex
CREATE INDEX "students_business_id_idx" ON "public"."students"("business_id");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "public"."students"("status");

-- CreateIndex
CREATE INDEX "practice_tests_business_id_status_idx" ON "public"."practice_tests"("business_id", "status");

-- CreateIndex
CREATE INDEX "practice_tests_batch_id_status_idx" ON "public"."practice_tests"("batch_id", "status");

-- CreateIndex
CREATE INDEX "practice_tests_subject_id_idx" ON "public"."practice_tests"("subject_id");

-- CreateIndex
CREATE INDEX "exam_tests_business_id_status_idx" ON "public"."exam_tests"("business_id", "status");

-- CreateIndex
CREATE INDEX "exam_tests_batch_id_status_idx" ON "public"."exam_tests"("batch_id", "status");

-- CreateIndex
CREATE INDEX "exam_tests_subject_id_idx" ON "public"."exam_tests"("subject_id");

-- CreateIndex
CREATE INDEX "test_questions_practice_test_id_idx" ON "public"."test_questions"("practice_test_id");

-- CreateIndex
CREATE INDEX "test_questions_exam_test_id_idx" ON "public"."test_questions"("exam_test_id");

-- CreateIndex
CREATE INDEX "test_options_question_id_idx" ON "public"."test_options"("question_id");

-- CreateIndex
CREATE INDEX "test_attempts_practice_test_id_user_id_idx" ON "public"."test_attempts"("practice_test_id", "user_id");

-- CreateIndex
CREATE INDEX "test_attempts_exam_test_id_user_id_idx" ON "public"."test_attempts"("exam_test_id", "user_id");

-- CreateIndex
CREATE INDEX "test_attempts_user_id_idx" ON "public"."test_attempts"("user_id");

-- CreateIndex
CREATE INDEX "test_attempt_answers_attempt_id_idx" ON "public"."test_attempt_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "test_attempt_answers_question_id_idx" ON "public"."test_attempt_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_question" ON "public"."test_attempt_answers"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."business_slug_history" ADD CONSTRAINT "business_slug_history_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batches" ADD CONSTRAINT "batches_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_users" ADD CONSTRAINT "batch_users_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_users" ADD CONSTRAINT "batch_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcements" ADD CONSTRAINT "announcements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcements" ADD CONSTRAINT "announcements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcement_targets" ADD CONSTRAINT "announcement_targets_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcement_targets" ADD CONSTRAINT "announcement_targets_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."announcement_targets" ADD CONSTRAINT "announcement_targets_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exams" ADD CONSTRAINT "exams_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exams" ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exams" ADD CONSTRAINT "exams_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."courses" ADD CONSTRAINT "courses_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subjects" ADD CONSTRAINT "subjects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contents" ADD CONSTRAINT "contents_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contents" ADD CONSTRAINT "contents_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contents" ADD CONSTRAINT "contents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contents" ADD CONSTRAINT "contents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teachers" ADD CONSTRAINT "teachers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."students" ADD CONSTRAINT "students_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_tests" ADD CONSTRAINT "practice_tests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_tests" ADD CONSTRAINT "practice_tests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_tests" ADD CONSTRAINT "practice_tests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_tests" ADD CONSTRAINT "exam_tests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_tests" ADD CONSTRAINT "exam_tests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_tests" ADD CONSTRAINT "exam_tests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_questions" ADD CONSTRAINT "test_questions_practice_test_id_fkey" FOREIGN KEY ("practice_test_id") REFERENCES "public"."practice_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_questions" ADD CONSTRAINT "test_questions_exam_test_id_fkey" FOREIGN KEY ("exam_test_id") REFERENCES "public"."exam_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_options" ADD CONSTRAINT "test_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_attempts" ADD CONSTRAINT "test_attempts_practice_test_id_fkey" FOREIGN KEY ("practice_test_id") REFERENCES "public"."practice_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_attempts" ADD CONSTRAINT "test_attempts_exam_test_id_fkey" FOREIGN KEY ("exam_test_id") REFERENCES "public"."exam_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_attempts" ADD CONSTRAINT "test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

