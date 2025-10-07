/**
 * Date Utilities
 * 
 * Helper functions for date and time operations.
 * Provides formatting, parsing, and date manipulation utilities.
 * 
 * Location: src/lib/utils/dateUtils.ts
 * Purpose: Date and time utilities
 */

export const formatDate = (date: Date, locale: string = 'he-IL'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

export const formatTime = (date: Date, locale: string = 'he-IL'): string => {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const formatDateTime = (date: Date, locale: string = 'he-IL'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getWeekStart = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

export const getWeekEnd = (date: Date = new Date()): Date => {
  const weekStart = getWeekStart(date);
  return new Date(weekStart.setDate(weekStart.getDate() + 6));
};

export const getMonthStart = (date: Date = new Date()): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const getMonthEnd = (date: Date = new Date()): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

export const calculateHoursBetween = (startDate: Date, endDate: Date): number => {
  const diff = endDate.getTime() - startDate.getTime();
  return diff / (1000 * 60 * 60); // Convert milliseconds to hours
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};

