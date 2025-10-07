/**
 * Score Utilities
 * 
 * Helper functions for calculating worker performance scores.
 * Handles score calculations based on shifts completed, missed, etc.
 * 
 * Location: src/lib/utils/scoreUtils.ts
 * Purpose: Performance scoring utilities
 */

export const calculatePerformanceScore = (
  completedShifts: number,
  missedShifts: number,
  totalShifts: number
): number => {
  if (totalShifts === 0) return 100;

  const completionRate = (completedShifts / totalShifts) * 100;
  const missRate = (missedShifts / totalShifts) * 100;

  // Start with 100, deduct points for missed shifts
  let score = 100 - (missRate * 2); // Each missed shift costs 2x points

  // Bonus for high completion rate
  if (completionRate >= 95) {
    score += 5;
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getScoreGrade = (score: number): string => {
  if (score >= 90) return 'מצוין';
  if (score >= 80) return 'טוב מאוד';
  if (score >= 70) return 'טוב';
  if (score >= 60) return 'בינוני';
  return 'נמוך';
};

export const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-500';
  if (score >= 80) return 'text-blue-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 60) return 'text-orange-500';
  return 'text-red-500';
};

export const calculateAttendanceRate = (
  completedShifts: number,
  totalShifts: number
): number => {
  if (totalShifts === 0) return 0;
  return Math.round((completedShifts / totalShifts) * 100);
};

export const calculateReliabilityScore = (
  onTimeShifts: number,
  lateShifts: number,
  totalShifts: number
): number => {
  if (totalShifts === 0) return 100;
  
  const onTimeRate = (onTimeShifts / totalShifts) * 100;
  const lateRate = (lateShifts / totalShifts) * 100;
  
  let score = onTimeRate - (lateRate * 0.5);
  return Math.max(0, Math.min(100, Math.round(score)));
};

