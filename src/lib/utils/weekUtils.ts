/**
 * Week Utilities for Primary Task Scheduling
 * 
 * Handles week calculation, date range formatting, and week-based logic
 * for primary task scheduling tables.
 * 
 * Location: src/lib/utils/weekUtils.ts
 * Purpose: Centralized week calculation logic for primary schedules
 */

import { Week, Worker } from '../../types/primarySchedule.types';

/**
 * Get the day of week index (0 = Sunday, 6 = Saturday)
 */
const getDayOfWeek = (date: Date): number => {
  return date.getDay();
};

/**
 * Get the next Saturday from a given date (inclusive)
 */
const getNextSaturday = (date: Date): Date => {
  const dayOfWeek = getDayOfWeek(date);
  const daysUntilSaturday = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  
  const saturday = new Date(date);
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  
  return saturday;
};

/**
 * Get the next Sunday from a given date
 */
const getNextSunday = (date: Date): Date => {
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() + 1); // Day after Saturday
  return sunday;
};


/**
 * Format date to DD/MM
 */
export const formatDateShort = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

/**
 * Format date to DD/MM/YYYY
 */
export const formatDateFull = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date range as "DD/MM - DD/MM"
 */
export const formatDateRange = (startDate: Date, endDate: Date): string => {
  return `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;
};

/**
 * Calculate weeks from a date range
 * 
 * Logic:
 * - First week: User's start date → First Saturday
 * - Middle weeks: Sunday → Saturday (full weeks)
 * - Last week: Sunday → User's end date
 * 
 * @param startDate - Schedule start date
 * @param endDate - Schedule end date
 * @returns Array of Week objects
 */
export const calculateWeeksFromDateRange = (
  startDate: Date,
  endDate: Date
): Week[] => {
  const weeks: Week[] = [];
  let weekNumber = 1;
  
  // Normalize dates to start of day (00:00:00)
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(23, 59, 59, 999);
  
  let currentStart = new Date(normalizedStart);
  
  // First week: Start date → First Saturday
  const firstSaturday = getNextSaturday(currentStart);
  
  weeks.push({
    weekNumber: weekNumber++,
    startDate: new Date(currentStart),
    endDate: new Date(firstSaturday),
    dateRange: formatDateRange(currentStart, firstSaturday),
    isFirstWeek: true,
    isLastWeek: false
  });
  
  // If first Saturday is already past end date, we're done
  if (firstSaturday >= normalizedEnd) {
    weeks[0].isLastWeek = true;
    weeks[0].endDate = new Date(normalizedEnd);
    weeks[0].dateRange = formatDateRange(currentStart, normalizedEnd);
    return weeks;
  }
  
  // Move to next Sunday for middle weeks
  currentStart = getNextSunday(firstSaturday);
  
  // Middle weeks: Sunday → Saturday (full weeks)
  while (currentStart < normalizedEnd) {
    const saturday = getNextSaturday(currentStart);
    
    // Check if this Saturday is past the end date
    if (saturday >= normalizedEnd) {
      // This is the last week (partial or full)
      weeks.push({
        weekNumber: weekNumber++,
        startDate: new Date(currentStart),
        endDate: new Date(normalizedEnd),
        dateRange: formatDateRange(currentStart, normalizedEnd),
        isFirstWeek: false,
        isLastWeek: true
      });
      break;
    } else {
      // Full week
      weeks.push({
        weekNumber: weekNumber++,
        startDate: new Date(currentStart),
        endDate: new Date(saturday),
        dateRange: formatDateRange(currentStart, saturday),
        isFirstWeek: false,
        isLastWeek: false
      });
      
      // Move to next Sunday
      currentStart = getNextSunday(saturday);
    }
  }
  
  return weeks;
};

/**
 * Get the year from a date
 */
export const getYear = (date: Date): number => {
  return date.getFullYear();
};

/**
 * Generate schedule name from dates
 * Format: "תורנות DD/MM/YYYY - DD/MM/YYYY"
 */
export const generateScheduleName = (startDate: Date, endDate: Date): string => {
  return `תורנות ${formatDateFull(startDate)} - ${formatDateFull(endDate)}`;
};

/**
 * Sort workers alphabetically by first name (Hebrew)
 */
export const sortWorkersAlphabetically = (workers: Worker[]): Worker[] => {
  return [...workers].sort((a, b) => {
    return a.firstName.localeCompare(b.firstName, 'he');
  });
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Check if a task spans multiple weeks based on start and end dates
 */
export const taskSpansMultipleWeeks = (
  taskStartDate: Date,
  taskEndDate: Date,
  weeks: Week[]
): number => {
  let weekCount = 0;
  
  for (const week of weeks) {
    // Check if task overlaps with this week
    const taskStart = taskStartDate.getTime();
    const taskEnd = taskEndDate.getTime();
    const weekStart = week.startDate.getTime();
    const weekEnd = week.endDate.getTime();
    
    // Task overlaps if it starts before week ends and ends after week starts
    if (taskStart <= weekEnd && taskEnd >= weekStart) {
      weekCount++;
    }
  }
  
  return weekCount;
};

/**
 * Get week number for a specific date within a schedule
 */
export const getWeekNumberForDate = (date: Date, weeks: Week[]): number | null => {
  for (const week of weeks) {
    if (date >= week.startDate && date <= week.endDate) {
      return week.weekNumber;
    }
  }
  return null;
};

/**
 * Convert day string to day index (0 = Sunday, 6 = Saturday)
 */
export const dayStringToIndex = (
  day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
): number => {
  const dayMap = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  };
  return dayMap[day];
};

/**
 * Get Hebrew day name from date
 */
export const getHebrewDayName = (date: Date): string => {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[date.getDay()];
};

/**
 * Calculate task end date based on start date and duration
 */
export const calculateTaskEndDate = (
  startDate: Date,
  durationDays: number
): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
};

