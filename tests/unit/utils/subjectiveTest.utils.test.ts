import {
  buildAnswerSheetStorageKey,
  buildCheckedCopyStorageKey,
  buildQuestionPaperStorageKey,
  computeAttemptDeadline,
  getSubmissionDisplayStatus,
  getTestAvailability,
  parseSubmissionListFilters,
  questionPaperDisplayName,
} from '../../../src/utils/subjectiveTest.utils';
import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
} from '../../../src/constants/test-enums';
import { BadRequestError } from '../../../src/errors/api.errors';

const MINUTE = 60_000;
const startAt = new Date('2026-10-15T04:30:00.000Z');
const deadlineAt = new Date('2026-10-15T07:30:00.000Z');
const schedule = { startAt, deadlineAt, durationMinutes: 60 };

describe('subjectiveTest.utils', () => {
  describe('computeAttemptDeadline', () => {
    it('uses startedAt + duration when that is before the test deadline', () => {
      const startedAt = new Date(startAt.getTime() + 10 * MINUTE);
      expect(computeAttemptDeadline(schedule, startedAt)).toEqual(new Date(startedAt.getTime() + 60 * MINUTE));
    });

    it('caps at the test deadline when the duration would run past it', () => {
      const startedAt = new Date(deadlineAt.getTime() - 15 * MINUTE);
      expect(computeAttemptDeadline(schedule, startedAt)).toEqual(deadlineAt);
    });
  });

  describe('getTestAvailability', () => {
    it.each([
      [new Date(startAt.getTime() - MINUTE), SubjectiveAvailability.UPCOMING],
      [startAt, SubjectiveAvailability.OPEN],
      [deadlineAt, SubjectiveAvailability.OPEN],
      [new Date(deadlineAt.getTime() + MINUTE), SubjectiveAvailability.CLOSED],
    ])('at %s is %s', (now, expectedAvailability) => {
      expect(getTestAvailability(schedule, now)).toBe(expectedAvailability);
    });
  });

  describe('getSubmissionDisplayStatus', () => {
    const startedAt = new Date(startAt.getTime() + 5 * MINUTE);
    const inProgressAttempt = { status: SubjectiveSubmissionStatus.IN_PROGRESS, startedAt };

    it('is NOT_STARTED without an attempt', () => {
      expect(getSubmissionDisplayStatus(schedule, null, startAt)).toBe(SubjectiveDisplayStatus.NOT_STARTED);
    });

    it('is IN_PROGRESS before the attempt deadline and EXPIRED after it', () => {
      expect(getSubmissionDisplayStatus(schedule, inProgressAttempt, new Date(startedAt.getTime() + 59 * MINUTE))).toBe(
        SubjectiveDisplayStatus.IN_PROGRESS,
      );
      expect(getSubmissionDisplayStatus(schedule, inProgressAttempt, new Date(startedAt.getTime() + 61 * MINUTE))).toBe(
        SubjectiveDisplayStatus.EXPIRED,
      );
    });

    it('keeps SUBMITTED and CHECKED regardless of time', () => {
      const muchLater = new Date(deadlineAt.getTime() + 60 * MINUTE);
      expect(getSubmissionDisplayStatus(schedule, { status: SubjectiveSubmissionStatus.SUBMITTED, startedAt }, muchLater)).toBe(
        SubjectiveDisplayStatus.SUBMITTED,
      );
      expect(getSubmissionDisplayStatus(schedule, { status: SubjectiveSubmissionStatus.CHECKED, startedAt }, muchLater)).toBe(
        SubjectiveDisplayStatus.CHECKED,
      );
    });
  });

  describe('storage keys', () => {
    it('puts every file under subjective/<businessId>/<testId>', () => {
      expect(buildQuestionPaperStorageKey(1, 'st-1')).toMatch(/^subjective\/1\/st-1\/question-paper-\d+-\d+\.pdf$/);
      expect(buildCheckedCopyStorageKey(1, 'st-1', 'sub-1')).toMatch(/^subjective\/1\/st-1\/checked\/sub-1-\d+-\d+\.pdf$/);
    });

    it("keeps the student's original file name in the answer sheet key", () => {
      const uploadedFile = { originalname: 'rahul-gs1-mock3.pdf' } as Express.Multer.File;
      expect(buildAnswerSheetStorageKey(1, 'st-1', 42, uploadedFile)).toMatch(
        /^subjective\/1\/st-1\/answers\/42-\d+-\d+__rahul-gs1-mock3\.pdf$/,
      );
    });
  });

  it('names the question paper after the paper type, only when a paper exists', () => {
    expect(questionPaperDisplayName({ paperType: 'GS Paper I', questionPaperPath: 'k.pdf' })).toBe('GS Paper I.pdf');
    expect(questionPaperDisplayName({ paperType: 'GS Paper I', questionPaperPath: null })).toBeNull();
  });

  describe('parseSubmissionListFilters', () => {
    it('applies defaults and lower-cases the search text', () => {
      expect(parseSubmissionListFilters({ search: ' Asha ' })).toEqual({ searchText: 'asha', page: 1, pageSize: 20 });
    });

    it('caps the page size and rejects invalid values', () => {
      expect(parseSubmissionListFilters({ limit: '500' }).pageSize).toBe(100);
      expect(() => parseSubmissionListFilters({ status: 'DONE' })).toThrow(BadRequestError);
      expect(() => parseSubmissionListFilters({ page: '0' })).toThrow(BadRequestError);
    });
  });
});
