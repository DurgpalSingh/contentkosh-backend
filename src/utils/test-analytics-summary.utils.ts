export type AnalyticsAttemptLike = {
  score: number | null;
  percentage: number | null;
};

export type AttemptSummaryStats = {
  totalAttempts: number;
  averageScore: number;
  averagePercentage: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
};

function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0);
}

/**
 * Shared summary math for practice vs exam analytics (threshold differs by test type).
 */
export function computeAttemptSummaryStats(
  attempts: AnalyticsAttemptLike[],
  opts: { passThresholdPercent: number },
): AttemptSummaryStats {
  const totalAttempts = attempts.length;
  const scores = attempts.map((a) => a.score ?? 0);
  const percentages = attempts.map((a) => a.percentage ?? 0);

  const averageScore = totalAttempts ? sum(scores) / totalAttempts : 0;
  const averagePercentage = totalAttempts ? sum(percentages) / totalAttempts : 0;
  const highestScore = totalAttempts ? Math.max(...scores) : 0;
  const lowestScore = totalAttempts ? Math.min(...scores) : 0;

  const passCount = attempts.filter((a) => (a.percentage ?? 0) >= opts.passThresholdPercent).length;
  const passRate = totalAttempts ? (passCount / totalAttempts) * 100 : 0;

  return {
    totalAttempts,
    averageScore,
    averagePercentage,
    passRate,
    highestScore,
    lowestScore,
    passCount,
  };
}
