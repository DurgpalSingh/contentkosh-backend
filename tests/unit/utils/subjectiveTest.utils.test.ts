import {
  computeEffectiveEnd,
  deriveAvailability,
  deriveDisplayStatus,
} from '../../../src/utils/subjectiveTest.utils';
import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
} from '../../../src/constants/test-enums';

const MINUTE = 60_000;
const startAt = new Date('2026-10-15T04:30:00.000Z');
const deadlineAt = new Date('2026-10-15T07:30:00.000Z');
const test = { startAt, deadlineAt, durationMinutes: 60 };

describe('subjectiveTest.utils', () => {
  describe('computeEffectiveEnd', () => {
    it('uses startedAt + duration when that is before the deadline', () => {
      const startedAt = new Date(startAt.getTime() + 10 * MINUTE);
      expect(computeEffectiveEnd(test, startedAt)).toEqual(new Date(startedAt.getTime() + 60 * MINUTE));
    });

    it('caps at the deadline when duration would run past it', () => {
      const startedAt = new Date(deadlineAt.getTime() - 15 * MINUTE);
      expect(computeEffectiveEnd(test, startedAt)).toEqual(deadlineAt);
    });
  });

  describe('deriveAvailability', () => {
    it.each([
      [new Date(startAt.getTime() - MINUTE), SubjectiveAvailability.UPCOMING],
      [startAt, SubjectiveAvailability.OPEN],
      [deadlineAt, SubjectiveAvailability.OPEN],
      [new Date(deadlineAt.getTime() + MINUTE), SubjectiveAvailability.CLOSED],
    ])('at %s is %s', (now, expected) => {
      expect(deriveAvailability(test, now)).toBe(expected);
    });
  });

  describe('deriveDisplayStatus', () => {
    const startedAt = new Date(startAt.getTime() + 5 * MINUTE);
    const inProgress = { status: SubjectiveSubmissionStatus.IN_PROGRESS, startedAt };

    it('is NOT_STARTED without a submission', () => {
      expect(deriveDisplayStatus(test, null, startAt)).toBe(SubjectiveDisplayStatus.NOT_STARTED);
    });

    it('is IN_PROGRESS before the effective end', () => {
      expect(deriveDisplayStatus(test, inProgress, new Date(startedAt.getTime() + 59 * MINUTE)))
        .toBe(SubjectiveDisplayStatus.IN_PROGRESS);
    });

    it('is EXPIRED once an in-progress attempt passes its effective end', () => {
      expect(deriveDisplayStatus(test, inProgress, new Date(startedAt.getTime() + 61 * MINUTE)))
        .toBe(SubjectiveDisplayStatus.EXPIRED);
    });

    it('keeps SUBMITTED and CHECKED regardless of time', () => {
      const later = new Date(deadlineAt.getTime() + 60 * MINUTE);
      expect(deriveDisplayStatus(test, { status: SubjectiveSubmissionStatus.SUBMITTED, startedAt }, later))
        .toBe(SubjectiveDisplayStatus.SUBMITTED);
      expect(deriveDisplayStatus(test, { status: SubjectiveSubmissionStatus.CHECKED, startedAt }, later))
        .toBe(SubjectiveDisplayStatus.CHECKED);
    });
  });
});
