/**
 * Qualification Utilities
 * 
 * Helper functions for worker qualification management.
 * Handles qualification levels, requirements, and matching.
 * 
 * Location: src/lib/utils/qualificationUtils.ts
 * Purpose: Qualification management utilities
 */

import { QUALIFICATION_LEVELS, QualificationLevel } from '../../config/appConfig';

export const getQualificationName = (level: QualificationLevel): string => {
  const qualificationNames: Record<QualificationLevel, string> = {
    [QUALIFICATION_LEVELS.BEGINNER]: 'מתחיל',
    [QUALIFICATION_LEVELS.INTERMEDIATE]: 'בינוני',
    [QUALIFICATION_LEVELS.ADVANCED]: 'מתקדם',
    [QUALIFICATION_LEVELS.EXPERT]: 'מומחה'
  };
  return qualificationNames[level] || 'לא ידוע';
};

export const getQualificationColor = (level: QualificationLevel): string => {
  const qualificationColors: Record<QualificationLevel, string> = {
    [QUALIFICATION_LEVELS.BEGINNER]: 'bg-gray-500',
    [QUALIFICATION_LEVELS.INTERMEDIATE]: 'bg-blue-500',
    [QUALIFICATION_LEVELS.ADVANCED]: 'bg-purple-500',
    [QUALIFICATION_LEVELS.EXPERT]: 'bg-gold-500'
  };
  return qualificationColors[level] || 'bg-gray-500';
};

export const isQualified = (workerLevel: number, requiredLevel: number): boolean => {
  return workerLevel >= requiredLevel;
};

export const getQualificationGap = (workerLevel: number, requiredLevel: number): number => {
  return Math.max(0, requiredLevel - workerLevel);
};

export const canUpgradeQualification = (
  currentLevel: QualificationLevel,
  shiftsCompleted: number,
  performanceScore: number
): boolean => {
  const requirements = {
    [QUALIFICATION_LEVELS.BEGINNER]: { shifts: 0, score: 0 },
    [QUALIFICATION_LEVELS.INTERMEDIATE]: { shifts: 20, score: 70 },
    [QUALIFICATION_LEVELS.ADVANCED]: { shifts: 50, score: 80 },
    [QUALIFICATION_LEVELS.EXPERT]: { shifts: 100, score: 90 }
  };

  const nextLevel = (currentLevel + 1) as QualificationLevel;
  if (nextLevel > QUALIFICATION_LEVELS.EXPERT) return false;

  const req = requirements[nextLevel];
  return shiftsCompleted >= req.shifts && performanceScore >= req.score;
};

export const getNextQualificationRequirements = (currentLevel: QualificationLevel): {
  shifts: number;
  score: number;
  level: string;
} | null => {
  const nextLevel = (currentLevel + 1) as QualificationLevel;
  
  if (nextLevel > QUALIFICATION_LEVELS.EXPERT) return null;

  const requirements: Record<QualificationLevel, { shifts: number; score: number }> = {
    [QUALIFICATION_LEVELS.BEGINNER]: { shifts: 0, score: 0 },
    [QUALIFICATION_LEVELS.INTERMEDIATE]: { shifts: 20, score: 70 },
    [QUALIFICATION_LEVELS.ADVANCED]: { shifts: 50, score: 80 },
    [QUALIFICATION_LEVELS.EXPERT]: { shifts: 100, score: 90 }
  };

  const req = requirements[nextLevel];
  return {
    shifts: req.shifts,
    score: req.score,
    level: getQualificationName(nextLevel)
  };
};

