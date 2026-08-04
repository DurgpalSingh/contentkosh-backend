import { Client as PgClient } from 'pg';

const TENANT_SCHEMA_SQL = `
DO $$
BEGIN
  CREATE TYPE "ExamStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CourseStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AnnouncementScope" AS ENUM ('COURSE', 'BATCH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContentType" AS ENUM ('PDF', 'IMAGE', 'DOC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TestLanguage" AS ENUM ('hi', 'en');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "exams" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "status" "ExamStatus" NOT NULL DEFAULT 'ACTIVE',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "business_id" INTEGER NOT NULL,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "thumbnail" TEXT,
  "price" INTEGER NOT NULL DEFAULT 0,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE',
  "exam_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "course_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "batches" (
  "id" SERIAL PRIMARY KEY,
  "code_name" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "course_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "batch_users" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "batch_id" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "permission_id" INTEGER NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" SERIAL PRIMARY KEY,
  "heading" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "business_id" INTEGER NOT NULL,
  "visible_to_admins" BOOLEAN NOT NULL DEFAULT false,
  "visible_to_teachers" BOOLEAN NOT NULL DEFAULT false,
  "visible_to_students" BOOLEAN NOT NULL DEFAULT false,
  "scope" "AnnouncementScope" NOT NULL DEFAULT 'BATCH',
  "target_all_courses" BOOLEAN NOT NULL DEFAULT false,
  "target_all_batches" BOOLEAN NOT NULL DEFAULT false,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "announcement_targets" (
  "id" SERIAL PRIMARY KEY,
  "announcement_id" INTEGER NOT NULL,
  "course_id" INTEGER,
  "batch_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "contents" (
  "id" SERIAL PRIMARY KEY,
  "batch_id" INTEGER NOT NULL,
  "subject_id" INTEGER,
  "title" TEXT NOT NULL,
  "type" "ContentType" NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
  "uploaded_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "teachers" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "business_id" INTEGER NOT NULL,
  "qualification" TEXT NOT NULL,
  "experience_years" INTEGER NOT NULL,
  "designation" TEXT NOT NULL,
  "bio" TEXT,
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "gender" "Gender",
  "date_of_birth" TIMESTAMP(3),
  "address" TEXT,
  "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "students" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "business_id" INTEGER NOT NULL,
  "date_of_birth" TIMESTAMP(3),
  "gender" "Gender",
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "address" TEXT,
  "city" TEXT,
  "bio" TEXT,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "practice_tests" (
  "id" TEXT PRIMARY KEY,
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
  "language" "TestLanguage" NOT NULL DEFAULT 'en',
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "exam_tests" (
  "id" TEXT PRIMARY KEY,
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
  "language" "TestLanguage" NOT NULL DEFAULT 'en',
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "test_questions" (
  "id" TEXT PRIMARY KEY,
  "practice_test_id" TEXT,
  "exam_test_id" TEXT,
  "type" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "correct_text_answer" TEXT,
  "correct_option_ids_answers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "explanation" TEXT,
  "media_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "test_options" (
  "id" TEXT PRIMARY KEY,
  "question_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "media_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "test_attempts" (
  "id" TEXT PRIMARY KEY,
  "practice_test_id" TEXT,
  "exam_test_id" TEXT,
  "user_id" INTEGER NOT NULL,
  "language" "TestLanguage" NOT NULL DEFAULT 'en',
  "status" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "total_score" DOUBLE PRECISION,
  "percentage" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "test_attempt_answers" (
  "id" TEXT PRIMARY KEY,
  "attempt_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "selected_option_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "text_answer" TEXT,
  "is_correct" BOOLEAN,
  "obtained_marks" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "exams" ALTER COLUMN "status" TYPE "ExamStatus" USING "status"::text::"ExamStatus";
ALTER TABLE "courses" ALTER COLUMN "status" TYPE "CourseStatus" USING "status"::text::"CourseStatus";
ALTER TABLE "subjects" ALTER COLUMN "status" TYPE "SubjectStatus" USING "status"::text::"SubjectStatus";
ALTER TABLE "announcements" ALTER COLUMN "scope" TYPE "AnnouncementScope" USING "scope"::text::"AnnouncementScope";
ALTER TABLE "contents" ALTER COLUMN "type" TYPE "ContentType" USING "type"::text::"ContentType";
ALTER TABLE "contents" ALTER COLUMN "status" TYPE "ContentStatus" USING "status"::text::"ContentStatus";
ALTER TABLE "teachers" ALTER COLUMN "gender" TYPE "Gender" USING "gender"::text::"Gender";
ALTER TABLE "teachers" ALTER COLUMN "status" TYPE "TeacherStatus" USING "status"::text::"TeacherStatus";
ALTER TABLE "students" ALTER COLUMN "gender" TYPE "Gender" USING "gender"::text::"Gender";
ALTER TABLE "students" ALTER COLUMN "status" TYPE "StudentStatus" USING "status"::text::"StudentStatus";
ALTER TABLE "practice_tests" ALTER COLUMN "language" TYPE "TestLanguage" USING "language"::text::"TestLanguage";
ALTER TABLE "exam_tests" ALTER COLUMN "language" TYPE "TestLanguage" USING "language"::text::"TestLanguage";
ALTER TABLE "test_attempts" ALTER COLUMN "language" TYPE "TestLanguage" USING "language"::text::"TestLanguage";

CREATE UNIQUE INDEX IF NOT EXISTS "batches_code_name_key" ON "batches"("code_name");
CREATE INDEX IF NOT EXISTS "batches_course_id_idx" ON "batches"("course_id");
CREATE UNIQUE INDEX IF NOT EXISTS "batch_users_user_id_batch_id_key" ON "batch_users"("user_id", "batch_id");
CREATE INDEX IF NOT EXISTS "announcements_business_id_idx" ON "announcements"("business_id");
CREATE INDEX IF NOT EXISTS "announcements_created_by_idx" ON "announcements"("created_by");
CREATE INDEX IF NOT EXISTS "announcement_targets_announcement_id_idx" ON "announcement_targets"("announcement_id");
CREATE INDEX IF NOT EXISTS "announcement_targets_course_id_idx" ON "announcement_targets"("course_id");
CREATE INDEX IF NOT EXISTS "announcement_targets_batch_id_idx" ON "announcement_targets"("batch_id");
CREATE INDEX IF NOT EXISTS "exams_business_id_name_idx" ON "exams"("business_id", "name");
CREATE INDEX IF NOT EXISTS "exams_business_id_idx" ON "exams"("business_id");
CREATE INDEX IF NOT EXISTS "exams_business_id_status_idx" ON "exams"("business_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "courses_exam_id_name_key" ON "courses"("exam_id", "name");
CREATE INDEX IF NOT EXISTS "courses_exam_id_idx" ON "courses"("exam_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_course_id_name_key" ON "subjects"("course_id", "name");
CREATE INDEX IF NOT EXISTS "subjects_course_id_idx" ON "subjects"("course_id");
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_user_id_permission_id_key" ON "role_permissions"("user_id", "permission_id");
CREATE INDEX IF NOT EXISTS "contents_batch_id_idx" ON "contents"("batch_id");
CREATE INDEX IF NOT EXISTS "contents_subject_id_idx" ON "contents"("subject_id");
CREATE INDEX IF NOT EXISTS "contents_batch_id_status_idx" ON "contents"("batch_id", "status");
CREATE INDEX IF NOT EXISTS "contents_uploaded_by_idx" ON "contents"("uploaded_by");
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_user_id_key" ON "teachers"("user_id");
CREATE INDEX IF NOT EXISTS "teachers_user_id_idx" ON "teachers"("user_id");
CREATE INDEX IF NOT EXISTS "teachers_business_id_idx" ON "teachers"("business_id");
CREATE INDEX IF NOT EXISTS "teachers_status_idx" ON "teachers"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "students_user_id_key" ON "students"("user_id");
CREATE INDEX IF NOT EXISTS "students_user_id_idx" ON "students"("user_id");
CREATE INDEX IF NOT EXISTS "students_business_id_idx" ON "students"("business_id");
CREATE INDEX IF NOT EXISTS "students_status_idx" ON "students"("status");
CREATE INDEX IF NOT EXISTS "practice_tests_business_id_status_idx" ON "practice_tests"("business_id", "status");
CREATE INDEX IF NOT EXISTS "practice_tests_batch_id_status_idx" ON "practice_tests"("batch_id", "status");
CREATE INDEX IF NOT EXISTS "practice_tests_subject_id_idx" ON "practice_tests"("subject_id");
CREATE INDEX IF NOT EXISTS "exam_tests_business_id_status_idx" ON "exam_tests"("business_id", "status");
CREATE INDEX IF NOT EXISTS "exam_tests_batch_id_status_idx" ON "exam_tests"("batch_id", "status");
CREATE INDEX IF NOT EXISTS "exam_tests_subject_id_idx" ON "exam_tests"("subject_id");
CREATE INDEX IF NOT EXISTS "test_questions_practice_test_id_idx" ON "test_questions"("practice_test_id");
CREATE INDEX IF NOT EXISTS "test_questions_exam_test_id_idx" ON "test_questions"("exam_test_id");
CREATE INDEX IF NOT EXISTS "test_options_question_id_idx" ON "test_options"("question_id");
CREATE INDEX IF NOT EXISTS "test_attempts_practice_test_id_user_id_idx" ON "test_attempts"("practice_test_id", "user_id");
CREATE INDEX IF NOT EXISTS "test_attempts_exam_test_id_user_id_idx" ON "test_attempts"("exam_test_id", "user_id");
CREATE INDEX IF NOT EXISTS "test_attempts_user_id_idx" ON "test_attempts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_attempt_question" ON "test_attempt_answers"("attempt_id", "question_id");
CREATE INDEX IF NOT EXISTS "test_attempt_answers_attempt_id_idx" ON "test_attempt_answers"("attempt_id");
CREATE INDEX IF NOT EXISTS "test_attempt_answers_question_id_idx" ON "test_attempt_answers"("question_id");
`;

const FOREIGN_KEYS = [
  ['courses', 'courses_exam_id_fkey', 'FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['subjects', 'subjects_course_id_fkey', 'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['batches', 'batches_course_id_fkey', 'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['batch_users', 'batch_users_batch_id_fkey', 'FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['batch_users', 'batch_users_user_id_fkey', 'FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['announcements', 'announcements_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['announcements', 'announcements_created_by_fkey', 'FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['announcements', 'announcements_updated_by_fkey', 'FOREIGN KEY ("updated_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['announcement_targets', 'announcement_targets_announcement_id_fkey', 'FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['announcement_targets', 'announcement_targets_course_id_fkey', 'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['announcement_targets', 'announcement_targets_batch_id_fkey', 'FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exams', 'exams_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exams', 'exams_created_by_fkey', 'FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exams', 'exams_updated_by_fkey', 'FOREIGN KEY ("updated_by") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['role_permissions', 'role_permissions_permission_id_fkey', 'FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['role_permissions', 'role_permissions_user_id_fkey', 'FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['contents', 'contents_batch_id_fkey', 'FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['contents', 'contents_subject_id_fkey', 'FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['contents', 'contents_uploaded_by_fkey', 'FOREIGN KEY ("uploaded_by") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['contents', 'contents_updated_by_fkey', 'FOREIGN KEY ("updated_by") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['teachers', 'teachers_user_id_fkey', 'FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['teachers', 'teachers_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['teachers', 'teachers_created_by_fkey', 'FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['teachers', 'teachers_updated_by_fkey', 'FOREIGN KEY ("updated_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['students', 'students_user_id_fkey', 'FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['students', 'students_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['students', 'students_created_by_fkey', 'FOREIGN KEY ("created_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['students', 'students_updated_by_fkey', 'FOREIGN KEY ("updated_by") REFERENCES public."users"("id") ON DELETE SET NULL ON UPDATE CASCADE'],
  ['practice_tests', 'practice_tests_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['practice_tests', 'practice_tests_batch_id_fkey', 'FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['practice_tests', 'practice_tests_subject_id_fkey', 'FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exam_tests', 'exam_tests_business_id_fkey', 'FOREIGN KEY ("business_id") REFERENCES public."business"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exam_tests', 'exam_tests_batch_id_fkey', 'FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['exam_tests', 'exam_tests_subject_id_fkey', 'FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_questions', 'test_questions_practice_test_id_fkey', 'FOREIGN KEY ("practice_test_id") REFERENCES "practice_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_questions', 'test_questions_exam_test_id_fkey', 'FOREIGN KEY ("exam_test_id") REFERENCES "exam_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_options', 'test_options_question_id_fkey', 'FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_attempts', 'test_attempts_practice_test_id_fkey', 'FOREIGN KEY ("practice_test_id") REFERENCES "practice_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_attempts', 'test_attempts_exam_test_id_fkey', 'FOREIGN KEY ("exam_test_id") REFERENCES "exam_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_attempts', 'test_attempts_user_id_fkey', 'FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_attempt_answers', 'test_attempt_answers_attempt_id_fkey', 'FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
  ['test_attempt_answers', 'test_attempt_answers_question_id_fkey', 'FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE'],
] as const;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function addForeignKeyIfMissing(
  client: PgClient,
  schemaName: string,
  tableName: string,
  constraintName: string,
  definition: string,
): Promise<void> {
  const existing = await client.query(
    `
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = $1
        AND rel.relname = $2
        AND c.conname = $3
    `,
    [schemaName, tableName, constraintName],
  );

  if (existing.rowCount && existing.rowCount > 0) return;

  await client.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(constraintName)} ${definition}`,
  );
}

export async function provisionTenantSchema(
  client: PgClient,
  schemaName: string,
): Promise<void> {
  await client.query(`SET search_path = ${quoteIdentifier(schemaName)}, public`);
  await client.query(TENANT_SCHEMA_SQL);

  for (const [tableName, constraintName, definition] of FOREIGN_KEYS) {
    // eslint-disable-next-line no-await-in-loop
    await addForeignKeyIfMissing(client, schemaName, tableName, constraintName, definition);
  }
}
