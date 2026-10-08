import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  TestStatus,
} from '../constants/test-enums';
import type {
  RosterEntryRecord,
  SubjectiveSubmissionRecord,
  SubjectiveTestRecord,
} from '../repositories/subjectiveTest.repo';
import {
  answerSheetDisplayName,
  computeAttemptDeadline,
  getSubmissionDisplayStatus,
  getTestAvailability,
  questionPaperDisplayName,
} from '../utils/subjectiveTest.utils';

// Storage keys (questionPaperPath, answerSheetPath, checkedAnswerSheetPath) are never returned;
// clients get `has*` flags and display names, and download through the file endpoints.

type TestSummaryResponse = {
  id: string;
  batchId: number;
  batchName: string;
  subjectId: number | null;
  subjectName: string | null;
  name: string;
  paperType: string;
  description: string | null;
  instructions: string | null;
  totalMarks: number;
  durationMinutes: number;
  startAt: Date;
  deadlineAt: Date;
  hasQuestionPaper: boolean;
  questionPaperName: string | null;
};

export type SubjectiveTestResponse = TestSummaryResponse & {
  businessId: number;
  status: number;
  isPublished: boolean;
  createdBy: number;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubjectiveAvailableTestResponse = TestSummaryResponse & {
  availability: SubjectiveAvailability;
  displayStatus: SubjectiveDisplayStatus;
  submissionId: string | null;
  effectiveDeadlineAt: Date | null;
};

export type SubjectiveResultResponse = {
  marksAwarded: number;
  totalMarks: number;
  remarks: string | null;
  checkedAt: Date | null;
  hasCheckedAnswerSheet: boolean;
};

export type SubjectiveStudentSubmissionResponse = {
  submissionId: string;
  test: SubjectiveAvailableTestResponse;
  displayStatus: SubjectiveDisplayStatus;
  startedAt: Date;
  effectiveDeadlineAt: Date;
  submittedAt: Date | null;
  hasAnswerSheet: boolean;
  answerSheetName: string | null;
  /** Present only once the submission is CHECKED. */
  result: SubjectiveResultResponse | null;
};

export type SubjectiveStaffSubmissionResponse = {
  id: string;
  subjectiveTestId: string;
  student: { id: number; name: string; email: string } | null;
  displayStatus: SubjectiveDisplayStatus;
  startedAt: Date;
  effectiveDeadlineAt: Date;
  submittedAt: Date | null;
  hasAnswerSheet: boolean;
  answerSheetName: string | null;
  marksAwarded: number | null;
  remarks: string | null;
  hasCheckedAnswerSheet: boolean;
  checkedBy: number | null;
  checkedAt: Date | null;
};

export type SubjectiveRosterRowResponse = {
  studentId: number;
  studentName: string;
  studentEmail: string;
  submissionId: string | null;
  displayStatus: SubjectiveDisplayStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  answerSheetName: string | null;
  marksAwarded: number | null;
  remarks: string | null;
  hasCheckedAnswerSheet: boolean;
  checkedAt: Date | null;
};

function toTestSummary(test: SubjectiveTestRecord): TestSummaryResponse {
  return {
    id: test.id,
    batchId: test.batchId,
    batchName: test.batch.displayName,
    subjectId: test.subjectId ?? null,
    subjectName: test.subject?.name ?? null,
    name: test.name,
    paperType: test.paperType,
    description: test.description ?? null,
    instructions: test.instructions ?? null,
    totalMarks: test.totalMarks,
    durationMinutes: test.durationMinutes,
    startAt: test.startAt,
    deadlineAt: test.deadlineAt,
    hasQuestionPaper: Boolean(test.questionPaperPath),
    questionPaperName: questionPaperDisplayName(test),
  };
}

export const SubjectiveTestMapper = {
  toStaffTestResponse(test: SubjectiveTestRecord): SubjectiveTestResponse {
    return {
      ...toTestSummary(test),
      businessId: test.businessId,
      status: test.status,
      isPublished: test.status === TestStatus.PUBLISHED,
      createdBy: test.createdBy,
      updatedBy: test.updatedBy ?? null,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
    };
  },

  toStudentTestCardResponse(
    test: SubjectiveTestRecord,
    ownAttempt: SubjectiveSubmissionRecord | null,
    now: Date,
  ): SubjectiveAvailableTestResponse {
    return {
      ...toTestSummary(test),
      availability: getTestAvailability(test, now),
      displayStatus: getSubmissionDisplayStatus(test, ownAttempt, now),
      submissionId: ownAttempt?.id ?? null,
      effectiveDeadlineAt: ownAttempt ? computeAttemptDeadline(test, ownAttempt.startedAt) : null,
    };
  },

  toStudentAttemptResponse(
    test: SubjectiveTestRecord,
    attempt: SubjectiveSubmissionRecord,
    now: Date,
  ): SubjectiveStudentSubmissionResponse {
    const testCard = SubjectiveTestMapper.toStudentTestCardResponse(test, attempt, now);
    return {
      submissionId: attempt.id,
      test: testCard,
      displayStatus: testCard.displayStatus,
      startedAt: attempt.startedAt,
      effectiveDeadlineAt: testCard.effectiveDeadlineAt!,
      submittedAt: attempt.submittedAt ?? null,
      hasAnswerSheet: Boolean(attempt.answerSheetPath),
      answerSheetName: answerSheetDisplayName(attempt.answerSheetPath),
      result:
        testCard.displayStatus === SubjectiveDisplayStatus.CHECKED
          ? {
              marksAwarded: attempt.marksAwarded ?? 0,
              totalMarks: test.totalMarks,
              remarks: attempt.remarks ?? null,
              checkedAt: attempt.checkedAt ?? null,
              hasCheckedAnswerSheet: Boolean(attempt.checkedAnswerSheetPath),
            }
          : null,
    };
  },

  toStaffSubmissionResponse(
    test: SubjectiveTestRecord,
    submission: SubjectiveSubmissionRecord,
    student: { id: number; name: string; email: string } | null,
    now: Date,
  ): SubjectiveStaffSubmissionResponse {
    return {
      id: submission.id,
      subjectiveTestId: submission.subjectiveTestId,
      student,
      displayStatus: getSubmissionDisplayStatus(test, submission, now),
      startedAt: submission.startedAt,
      effectiveDeadlineAt: computeAttemptDeadline(test, submission.startedAt),
      submittedAt: submission.submittedAt ?? null,
      hasAnswerSheet: Boolean(submission.answerSheetPath),
      answerSheetName: answerSheetDisplayName(submission.answerSheetPath),
      marksAwarded: submission.marksAwarded ?? null,
      remarks: submission.remarks ?? null,
      hasCheckedAnswerSheet: Boolean(submission.checkedAnswerSheetPath),
      checkedBy: submission.checkedBy ?? null,
      checkedAt: submission.checkedAt ?? null,
    };
  },

  toRosterEntryResponse(test: SubjectiveTestRecord, entry: RosterEntryRecord, now: Date): SubjectiveRosterRowResponse {
    const attempt =
      entry.submissionId && entry.status !== null && entry.startedAt
        ? { status: entry.status, startedAt: entry.startedAt }
        : null;
    return {
      studentId: entry.studentId,
      studentName: entry.studentName,
      studentEmail: entry.studentEmail,
      submissionId: entry.submissionId,
      displayStatus: getSubmissionDisplayStatus(test, attempt, now),
      startedAt: entry.startedAt,
      submittedAt: entry.submittedAt,
      answerSheetName: answerSheetDisplayName(entry.answerSheetPath),
      marksAwarded: entry.marksAwarded,
      remarks: entry.remarks,
      hasCheckedAnswerSheet: entry.hasCheckedAnswerSheet,
      checkedAt: entry.checkedAt,
    };
  },
};
