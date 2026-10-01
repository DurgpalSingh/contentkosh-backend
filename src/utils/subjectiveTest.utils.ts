import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
} from '../constants/test-enums';

/** Absorbs small client/server clock drift on window boundaries (same tolerance as Exam start). */
export const SUBJECTIVE_TIME_TOLERANCE_MS = 1000;

type TestWindow = { startAt: Date; deadlineAt: Date; durationMinutes: number };
type SubmissionState = { status: number; startedAt: Date };

/** The earlier of `startedAt + duration` and the test deadline. */
export function computeEffectiveEnd(test: TestWindow, startedAt: Date): Date {
  const endByDuration = new Date(startedAt.getTime() + test.durationMinutes * 60_000);
  return endByDuration < test.deadlineAt ? endByDuration : test.deadlineAt;
}

export function deriveAvailability(test: TestWindow, now: Date): SubjectiveAvailability {
  const nowMs = now.getTime();
  if (nowMs + SUBJECTIVE_TIME_TOLERANCE_MS < test.startAt.getTime()) return SubjectiveAvailability.UPCOMING;
  if (nowMs > test.deadlineAt.getTime() + SUBJECTIVE_TIME_TOLERANCE_MS) return SubjectiveAvailability.CLOSED;
  return SubjectiveAvailability.OPEN;
}

export function isPastEffectiveEnd(test: TestWindow, startedAt: Date, now: Date): boolean {
  return now.getTime() > computeEffectiveEnd(test, startedAt).getTime() + SUBJECTIVE_TIME_TOLERANCE_MS;
}

/** EXPIRED is never stored: an IN_PROGRESS attempt past its effective end reads as EXPIRED. */
export function deriveDisplayStatus(
  test: TestWindow,
  submission: SubmissionState | null,
  now: Date,
): SubjectiveDisplayStatus {
  if (!submission) return SubjectiveDisplayStatus.NOT_STARTED;
  switch (submission.status) {
    case SubjectiveSubmissionStatus.CHECKED:
      return SubjectiveDisplayStatus.CHECKED;
    case SubjectiveSubmissionStatus.SUBMITTED:
      return SubjectiveDisplayStatus.SUBMITTED;
    default:
      return isPastEffectiveEnd(test, submission.startedAt, now)
        ? SubjectiveDisplayStatus.EXPIRED
        : SubjectiveDisplayStatus.IN_PROGRESS;
  }
}
