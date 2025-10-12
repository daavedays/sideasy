/**
 * Mandatory Closing Date Extractor
 * 
 * Extracts Friday dates when workers must close due to primary tasks
 * spanning the weekend (Thursday, Friday, Saturday).
 * 
 * Location: src/lib/utils/mandatoryClosingDateExtractor.ts
 */

import { Assignment } from '../../types/primarySchedule.types';

/**
 * Extract mandatory closing dates for workers from assignments
 * 
 * A worker must close if their primary task spans the weekend.
 * Weekend is defined as Thursday, Friday, Saturday.
 * We use Friday as the canonical date to represent the closing.
 * 
 * @param assignments - All assignments in the schedule
 * @param weeks - All weeks in the schedule (with Friday dates)
 * @returns Map of workerId → array of Friday closing dates
 */
export function extractMandatoryClosingDates(
  assignments: Map<string, Assignment>,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>
): Map<string, Date[]> {
  const workerClosingDates = new Map<string, Date[]>();
  
  // Group assignments by worker
  const workerAssignments = new Map<string, Assignment[]>();
  assignments.forEach((assignment) => {
    const existing = workerAssignments.get(assignment.workerId) || [];
    existing.push(assignment);
    workerAssignments.set(assignment.workerId, existing);
  });
  
  // For each worker, extract Friday dates from week-spanning assignments
  workerAssignments.forEach((workerTasks, workerId) => {
    const closingDates: Date[] = [];
    
    workerTasks.forEach((assignment) => {
      // Find the week this assignment belongs to
      const week = weeks.find(w => w.weekNumber === assignment.weekNumber);
      if (!week) return;
      
      // Check if assignment spans the weekend
      if (assignmentSpansWeekend(assignment, week)) {
        // Use the week's end date (Friday) as the closing date
        const fridayDate = week.endDate;
        
        // Only add if not already present
        if (!closingDates.some(d => d.getTime() === fridayDate.getTime())) {
          closingDates.push(fridayDate);
        }
      }
    });
    
    // Sort dates chronologically
    closingDates.sort((a, b) => a.getTime() - b.getTime());
    
    if (closingDates.length > 0) {
      workerClosingDates.set(workerId, closingDates);
    }
  });
  
  return workerClosingDates;
}

/**
 * Check if an assignment spans the weekend
 * 
 * Weekend is defined as Thursday, Friday, Saturday.
 * An assignment spans the weekend if it overlaps with any of these days.
 * 
 * @param assignment - The assignment to check
 * @param week - The week context (contains start/end dates)
 * @returns True if assignment spans weekend
 */
function assignmentSpansWeekend(
  assignment: Assignment, 
  week: { weekNumber: number; startDate: Date; endDate: Date }
): boolean {
  // Get the week's dates
  const weekStart = week.startDate; // Sunday
  const weekEnd = week.endDate; // Friday (assumed to be Saturday for weekend check)
  
  // Calculate Thursday, Friday, Saturday of this week
  // Assuming week.startDate is Sunday:
  // - Thursday is +4 days
  // - Friday is +5 days
  // - Saturday is +6 days
  
  const thursday = new Date(weekStart);
  thursday.setDate(thursday.getDate() + 4);
  
  const friday = new Date(weekStart);
  friday.setDate(friday.getDate() + 5);
  
  const saturday = new Date(weekStart);
  saturday.setDate(saturday.getDate() + 6);
  
  // Normalize dates to midnight for comparison
  const thursdayMidnight = new Date(thursday.getFullYear(), thursday.getMonth(), thursday.getDate());
  const saturdayEndOfDay = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate(), 23, 59, 59);
  
  // Check if assignment overlaps with Thu-Sat range
  const assignmentStart = assignment.startDate;
  const assignmentEnd = assignment.endDate;
  
  // Assignment spans weekend if it overlaps with [Thu 00:00, Sat 23:59:59]
  return assignmentStart <= saturdayEndOfDay && assignmentEnd >= thursdayMidnight;
}

/**
 * Extract mandatory closing dates for a specific set of workers
 * 
 * Filtered version that only processes specified workers.
 * 
 * @param assignments - All assignments in the schedule
 * @param weeks - All weeks in the schedule
 * @param workerIds - Set of worker IDs to process
 * @returns Map of workerId → array of Friday closing dates (only for specified workers)
 */
export function extractMandatoryClosingDatesForWorkers(
  assignments: Map<string, Assignment>,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>,
  workerIds: Set<string>
): Map<string, Date[]> {
  const allClosingDates = extractMandatoryClosingDates(assignments, weeks);
  
  // Filter to only include specified workers
  const filteredDates = new Map<string, Date[]>();
  workerIds.forEach((workerId) => {
    const dates = allClosingDates.get(workerId);
    if (dates && dates.length > 0) {
      filteredDates.set(workerId, dates);
    }
  });
  
  return filteredDates;
}

