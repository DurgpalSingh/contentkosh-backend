import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  TestStatus,
} from '../constants/test-enums';
import type {
  SubjectiveRosterRow,
  SubjectiveSubmissionRecord,
  SubjectiveTestRecord,
} from '../repositories/subjectiveTest.repo';
import {
  computeEffectiveEnd,
  deriveAvailability,
  deriveDisplayStatus,
  questionPaperFileName,
} from '../utils/subjectiveTest.utils';
import { originalNameFromKey } from '../services/privateFile.service';

// Storage keys (questionPaperPath, answerSheetPath, checkedAnswerSheetPath) are never
// returned; clients only get `has*` flags and download through the file endpoints.

export type SubjectiveTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  batchName: string;
  subjectId: number | null;
  subjectName: string | null;
  name: string;
  paperType: string;
  description: string | null;
  instructions: string | null;
  status: number;
  isPublished: boolean;
  totalMarks: number;
  durationMinutes: number;
  startAt: Date;
  deadlineAt: Date;
  hasQuestionPaper: boolean;
  /** Display/download name, derived from the paper type. */
  questionPaperName: string | null;
  createdBy: number;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubjectiveAvailableTestResponse = Omit<
  SubjectiveTestResponse,
  'businessId' | 'status' | 'isPublished' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
> & {
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
  /** The student's original PDF name. */
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

const paperName = (t: SubjectiveTestRecord) => (t.questionPaperPath ? questionPaperFileName(t.paperType) : null);

export const SubjectiveTestMapper = {
  test(t: SubjectiveTestRecord): SubjectiveTestResponse {
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      batchName: t.batch.displayName,
      subjectId: t.subjectId ?? null,
      subjectName: t.subject?.name ?? null,
      name: t.name,
      paperType: t.paperType,
      description: t.description ?? null,
      instructions: t.instructions ?? null,
      status: t.status,
      isPublished: t.status === TestStatus.PUBLISHED,
      totalMarks: t.totalMarks,
      durationMinutes: t.durationMinutes,
      startAt: t.startAt,
      deadlineAt: t.deadlineAt,
      hasQuestionPaper: Boolean(t.questionPaperPath),
      questionPaperName: paperName(t),
      createdBy: t.createdBy,
      updatedBy: t.updatedBy ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  availableTest(
    t: SubjectiveTestRecord,
    submission: SubjectiveSubmissionRecord | null,
    now: Date,
  ): SubjectiveAvailableTestResponse {
    return {
      id: t.id,
      batchId: t.batchId,
      batchName: t.batch.displayName,
      subjectId: t.subjectId ?? null,
      subjectName: t.subject?.name ?? null,
      name: t.name,
      paperType: t.paperType,
      description: t.description ?? null,
      instructions: t.instructions ?? null,
      totalMarks: t.totalMarks,
      durationMinutes: t.durationMinutes,
      startAt: t.startAt,
      deadlineAt: t.deadlineAt,
      hasQuestionPaper: Boolean(t.questionPaperPath),
      questionPaperName: paperName(t),
      availability: deriveAvailability(t, now),
      displayStatus: deriveDisplayStatus(t, submission, now),
      submissionId: submission?.id ?? null,
      effectiveDeadlineAt: submission ? computeEffectiveEnd(t, submission.startedAt) : null,
    };
  },

  studentSubmission(
    t: SubjectiveTestRecord,
    s: SubjectiveSubmissionRecord,
    now: Date,
  ): SubjectiveStudentSubmissionResponse {
    const displayStatus = deriveDisplayStatus(t, s, now);
    const isChecked = displayStatus === SubjectiveDisplayStatus.CHECKED;
    return {
      submissionId: s.id,
      test: SubjectiveTestMapper.availableTest(t, s, now),
      displayStatus,
      startedAt: s.startedAt,
      effectiveDeadlineAt: computeEffectiveEnd(t, s.startedAt),
      submittedAt: s.submittedAt ?? null,
      hasAnswerSheet: Boolean(s.answerSheetPath),
      answerSheetName: originalNameFromKey(s.answerSheetPath),
      result: isChecked
        ? {
            marksAwarded: s.marksAwarded ?? 0,
            totalMarks: t.totalMarks,
            remarks: s.remarks ?? null,
            checkedAt: s.checkedAt ?? null,
            hasCheckedAnswerSheet: Boolean(s.checkedAnswerSheetPath),
          }
        : null,
    };
  },

  staffSubmission(
    t: SubjectiveTestRecord,
    s: SubjectiveSubmissionRecord,
    student: { id: number; name: string; email: string } | null,
    now: Date,
  ): SubjectiveStaffSubmissionResponse {
    return {
      id: s.id,
      subjectiveTestId: s.subjectiveTestId,
      student,
      displayStatus: deriveDisplayStatus(t, s, now),
      startedAt: s.startedAt,
      effectiveDeadlineAt: computeEffectiveEnd(t, s.startedAt),
      submittedAt: s.submittedAt ?? null,
      hasAnswerSheet: Boolean(s.answerSheetPath),
      answerSheetName: originalNameFromKey(s.answerSheetPath),
      marksAwarded: s.marksAwarded ?? null,
      remarks: s.remarks ?? null,
      hasCheckedAnswerSheet: Boolean(s.checkedAnswerSheetPath),
      checkedBy: s.checkedBy ?? null,
      checkedAt: s.checkedAt ?? null,
    };
  },

  rosterRow(t: SubjectiveTestRecord, row: SubjectiveRosterRow, now: Date): SubjectiveRosterRowResponse {
    const submission = row.submissionId && row.status !== null && row.startedAt
      ? { status: row.status, startedAt: row.startedAt }
      : null;
    return {
      studentId: row.studentId,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      submissionId: row.submissionId,
      displayStatus: deriveDisplayStatus(t, submission, now),
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      answerSheetName: originalNameFromKey(row.answerSheetPath),
      marksAwarded: row.marksAwarded,
      remarks: row.remarks,
      hasCheckedAnswerSheet: row.hasCheckedAnswerSheet,
      checkedAt: row.checkedAt,
    };
  },
};
