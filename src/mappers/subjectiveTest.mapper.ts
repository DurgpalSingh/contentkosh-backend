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

function toTestSummary(subjectiveTest: SubjectiveTestRecord): TestSummaryResponse {
  return {
    id: subjectiveTest.id,
    batchId: subjectiveTest.batchId,
    batchName: subjectiveTest.batch.displayName,
    subjectId: subjectiveTest.subjectId ?? null,
    subjectName: subjectiveTest.subject?.name ?? null,
    name: subjectiveTest.name,
    paperType: subjectiveTest.paperType,
    description: subjectiveTest.description ?? null,
    instructions: subjectiveTest.instructions ?? null,
    totalMarks: subjectiveTest.totalMarks,
    durationMinutes: subjectiveTest.durationMinutes,
    startAt: subjectiveTest.startAt,
    deadlineAt: subjectiveTest.deadlineAt,
    hasQuestionPaper: Boolean(subjectiveTest.questionPaperPath),
    questionPaperName: questionPaperDisplayName(subjectiveTest),
  };
}

export const SubjectiveTestMapper = {
  toStaffTestResponse(subjectiveTest: SubjectiveTestRecord): SubjectiveTestResponse {
    return {
      ...toTestSummary(subjectiveTest),
      businessId: subjectiveTest.businessId,
      status: subjectiveTest.status,
      isPublished: subjectiveTest.status === TestStatus.PUBLISHED,
      createdBy: subjectiveTest.createdBy,
      updatedBy: subjectiveTest.updatedBy ?? null,
      createdAt: subjectiveTest.createdAt,
      updatedAt: subjectiveTest.updatedAt,
    };
  },

  toStudentTestCardResponse(
    subjectiveTest: SubjectiveTestRecord,
    ownAttempt: SubjectiveSubmissionRecord | null,
    now: Date,
  ): SubjectiveAvailableTestResponse {
    return {
      ...toTestSummary(subjectiveTest),
      availability: getTestAvailability(subjectiveTest, now),
      displayStatus: getSubmissionDisplayStatus(subjectiveTest, ownAttempt, now),
      submissionId: ownAttempt?.id ?? null,
      effectiveDeadlineAt: ownAttempt ? computeAttemptDeadline(subjectiveTest, ownAttempt.startedAt) : null,
    };
  },

  toStudentAttemptResponse(
    subjectiveTest: SubjectiveTestRecord,
    attempt: SubjectiveSubmissionRecord,
    now: Date,
  ): SubjectiveStudentSubmissionResponse {
    const testCard = SubjectiveTestMapper.toStudentTestCardResponse(subjectiveTest, attempt, now);
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
              totalMarks: subjectiveTest.totalMarks,
              remarks: attempt.remarks ?? null,
              checkedAt: attempt.checkedAt ?? null,
              hasCheckedAnswerSheet: Boolean(attempt.checkedAnswerSheetPath),
            }
          : null,
    };
  },

  toStaffSubmissionResponse(
    subjectiveTest: SubjectiveTestRecord,
    submission: SubjectiveSubmissionRecord,
    student: { id: number; name: string; email: string } | null,
    now: Date,
  ): SubjectiveStaffSubmissionResponse {
    return {
      id: submission.id,
      subjectiveTestId: submission.subjectiveTestId,
      student,
      displayStatus: getSubmissionDisplayStatus(subjectiveTest, submission, now),
      startedAt: submission.startedAt,
      effectiveDeadlineAt: computeAttemptDeadline(subjectiveTest, submission.startedAt),
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

  /** The display status was already calculated in SQL (subjectiveTest.repo roster query). */
  toRosterEntryResponse(rosterEntry: RosterEntryRecord): SubjectiveRosterRowResponse {
    const { answerSheetPath, ...rosterEntryFields } = rosterEntry;
    return { ...rosterEntryFields, answerSheetName: answerSheetDisplayName(answerSheetPath) };
  },
};
