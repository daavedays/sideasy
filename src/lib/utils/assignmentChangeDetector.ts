/**
 * Assignment Change Detector
 * 
 * Detects which workers have had their assignments changed
 * by comparing original and new assignment maps.
 * 
 * Used to optimize closing schedule calculation by only
 * updating affected workers.
 * 
 * Location: src/lib/utils/assignmentChangeDetector.ts
 */

import { Assignment } from '../../types/primarySchedule.types';

/**
 * Detect which workers have changed assignments
 * 
 * Compares original and new assignment maps to find:
 * - Workers with added assignments
 * - Workers with modified assignments
 * - Workers with deleted assignments
 * 
 * @param originalAssignments - Assignments before edits
 * @param newAssignments - Assignments after edits
 * @returns Set of worker IDs that have changes
 */
export function detectChangedWorkers(
  originalAssignments: Map<string, Assignment>,
  newAssignments: Map<string, Assignment>
): Set<string> {
  const changedWorkers = new Set<string>();
  
  // Check all original assignments for modifications or deletions
  originalAssignments.forEach((original, key) => {
    const newAssignment = newAssignments.get(key);
    
    // Assignment was deleted
    if (!newAssignment) {
      changedWorkers.add(original.workerId);
      return;
    }
    
    // Assignment was modified
    if (
      original.taskId !== newAssignment.taskId ||
      original.startDate.getTime() !== newAssignment.startDate.getTime() ||
      original.endDate.getTime() !== newAssignment.endDate.getTime()
    ) {
      changedWorkers.add(original.workerId);
    }
  });
  
  // Check for newly added assignments
  newAssignments.forEach((assignment, key) => {
    if (!originalAssignments.has(key)) {
      changedWorkers.add(assignment.workerId);
    }
  });
  
  return changedWorkers;
}

/**
 * Get all unique worker IDs from an assignment map
 * 
 * @param assignments - Assignment map
 * @returns Set of worker IDs
 */
export function getAllWorkerIds(assignments: Map<string, Assignment>): Set<string> {
  const workerIds = new Set<string>();
  
  assignments.forEach((assignment) => {
    workerIds.add(assignment.workerId);
  });
  
  return workerIds;
}

