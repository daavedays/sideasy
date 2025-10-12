/**
 * Cell Key Utilities for Primary Task Table
 * 
 * Helper functions for generating and parsing cell keys
 * used in the assignment map.
 * 
 * Cell Key Format: `${workerId}_${weekNumber}`
 * Example: "9597064_5" (worker 9597064, week 5)
 * 
 * Location: src/lib/utils/cellKeyUtils.ts
 * Purpose: Consistent cell key generation and parsing
 */

import { CellKey } from '../../types/primarySchedule.types';

/**
 * Generate unique cell key for a worker-week combination
 * 
 * @param workerId - Worker's unique ID
 * @param weekNumber - Week number (1-based)
 * @returns Cell key string
 */
export const generateCellKey = (workerId: string, weekNumber: number): CellKey => {
  return `${workerId}_${weekNumber}`;
};

/**
 * Parse cell key into workerId and weekNumber
 * 
 * @param cellKey - Cell key string
 * @returns Object with workerId and weekNumber
 */
export const parseCellKey = (cellKey: CellKey): { workerId: string; weekNumber: number } => {
  const [workerId, weekNumberStr] = cellKey.split('_');
  return {
    workerId,
    weekNumber: parseInt(weekNumberStr, 10),
  };
};

/**
 * Check if a cell key is valid
 * 
 * @param cellKey - Cell key string to validate
 * @returns True if valid, false otherwise
 */
export const isValidCellKey = (cellKey: CellKey): boolean => {
  const parts = cellKey.split('_');
  if (parts.length !== 2) return false;
  
  const weekNumber = parseInt(parts[1], 10);
  return !isNaN(weekNumber) && weekNumber > 0;
};

/**
 * Generate all cell keys for a worker across all weeks
 * 
 * @param workerId - Worker's unique ID
 * @param totalWeeks - Total number of weeks in schedule
 * @returns Array of cell keys
 */
export const generateWorkerCellKeys = (workerId: string, totalWeeks: number): CellKey[] => {
  const keys: CellKey[] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    keys.push(generateCellKey(workerId, weekNumber));
  }
  return keys;
};

/**
 * Generate all cell keys for a week across all workers
 * 
 * @param workerIds - Array of worker IDs
 * @param weekNumber - Week number
 * @returns Array of cell keys
 */
export const generateWeekCellKeys = (workerIds: string[], weekNumber: number): CellKey[] => {
  return workerIds.map(workerId => generateCellKey(workerId, weekNumber));
};

/**
 * Filter assignment map by worker ID
 * 
 * @param assignmentMap - Full assignment map
 * @param workerId - Worker ID to filter by
 * @returns Filtered map with only that worker's assignments
 */
export const filterAssignmentsByWorker = <T>(
  assignmentMap: Map<CellKey, T>,
  workerId: string
): Map<CellKey, T> => {
  const filtered = new Map<CellKey, T>();
  
  assignmentMap.forEach((value, key) => {
    const parsed = parseCellKey(key);
    if (parsed.workerId === workerId) {
      filtered.set(key, value);
    }
  });
  
  return filtered;
};

/**
 * Filter assignment map by week number
 * 
 * @param assignmentMap - Full assignment map
 * @param weekNumber - Week number to filter by
 * @returns Filtered map with only that week's assignments
 */
export const filterAssignmentsByWeek = <T>(
  assignmentMap: Map<CellKey, T>,
  weekNumber: number
): Map<CellKey, T> => {
  const filtered = new Map<CellKey, T>();
  
  assignmentMap.forEach((value, key) => {
    const parsed = parseCellKey(key);
    if (parsed.weekNumber === weekNumber) {
      filtered.set(key, value);
    }
  });
  
  return filtered;
};

