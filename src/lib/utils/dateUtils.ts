/**
 * Date Utilities
 * 
 * Central date formatting utilities for the entire application.
 * 
 * CRITICAL RULE: ALL dates in this app MUST be displayed in DD/MM/YYYY format.
 * Timezone: Asia/Jerusalem (Israel Time - UTC+2/UTC+3 with DST)
 * 
 * Location: src/lib/utils/dateUtils.ts
 * Purpose: Enforce consistent date formatting throughout the app
 */

/**
 * Format Date to DD/MM/YYYY (Israel timezone)
 * This is the ONLY format to be used for displaying dates to users
 * 
 * @param date - Date object or date string (YYYY-MM-DD)
 * @returns Formatted string in DD/MM/YYYY format
 */
export const formatDateDDMMYYYY = (date: Date | string): string => {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Parse YYYY-MM-DD string directly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = date;
  }
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD for storage
 * Use this when storing dates in Firestore or state
 * 
 * @param dateString - Date string in DD/MM/YYYY format
 * @returns Date string in YYYY-MM-DD format
 */
export const convertDDMMYYYYtoYYYYMMDD = (dateString: string): string => {
  const [day, month, year] = dateString.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Convert YYYY-MM-DD to DD/MM/YYYY for display
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date string in DD/MM/YYYY format
 */
export const convertYYYYMMDDtoDDMMYYYY = (dateString: string): string => {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Get current date in DD/MM/YYYY format (Israel timezone)
 */
export const getCurrentDateDDMMYYYY = (): string => {
  return formatDateDDMMYYYY(new Date());
};

/**
 * Get current date in YYYY-MM-DD format for storage
 */
export const getCurrentDateYYYYMMDD = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if two dates are the same day (ignoring time)
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

/**
 * Parse DD/MM/YYYY string to Date object
 * 
 * @param dateString - Date string in DD/MM/YYYY format
 * @returns Date object
 */
export const parseDDMMYYYY = (dateString: string): Date => {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Get Hebrew day name
 */
export const getHebrewDayName = (date: Date): string => {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[date.getDay()];
};

/**
 * Get Hebrew month name
 */
export const getHebrewMonthName = (monthIndex: number): string => {
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return months[monthIndex];
};

/**
 * Check if date is a weekend (Thursday, Friday, Saturday)
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 4 || day === 5 || day === 6; // Thursday, Friday, Saturday
};

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Subtract days from a date
 */
export const subtractDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

/**
 * Get date range between two dates (inclusive)
 */
export const getDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

/**
 * Validate DD/MM/YYYY format
 */
export const isValidDDMMYYYY = (dateString: string): boolean => {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateString)) return false;
  
  const [day, month, year] = dateString.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  
  return (
    date.getDate() === day &&
    date.getMonth() === month - 1 &&
    date.getFullYear() === year
  );
};
