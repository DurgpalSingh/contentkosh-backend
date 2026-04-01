import { computeLowestEligibleBatchId } from '../../src/repositories/testAttempt.repo';
import { BadRequestError } from '../../src/errors/api.errors';
import { sanitizeQuestionHtml, MAX_QUESTION_HTML_CHARS } from '../../src/utils/sanitizeHtml';

describe('computeLowestEligibleBatchId', () => {
  it('returns the minimum batch in the intersection', () => {
    expect(computeLowestEligibleBatchId([10, 5, 20], [20, 5])).toBe(5);
  });

  it('returns null when there is no overlap', () => {
    expect(computeLowestEligibleBatchId([1, 2], [3, 4])).toBeNull();
  });

  it('returns the only matching batch', () => {
    expect(computeLowestEligibleBatchId([7], [7, 8])).toBe(7);
  });
});

describe('sanitizeQuestionHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeQuestionHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).toContain('Hi');
  });

  it('rejects content over max length', () => {
    const huge = 'a'.repeat(MAX_QUESTION_HTML_CHARS + 1);
    expect(() => sanitizeQuestionHtml(huge)).toThrow(BadRequestError);
  });
});
