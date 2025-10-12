/**
 * TypeScript Type Definitions for Primary Scheduling
 * 
 * Centralized type definitions for primary task scheduling feature.
 * Import these types throughout the app for consistency.
 * 
 * Location: src/types/primarySchedule.types.ts
 * Purpose: Type safety and code consistency
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Week object representing a period in the schedule
 */
export interface Week {
  weekNumber: number;        // Sequential number (1, 2, 3...)
  startDate: Date;           // Start date of week
  endDate: Date;             // End date of week (typically Saturday)
  dateRange: string;         // Formatted as "DD/MM - DD/MM"
  isFirstWeek: boolean;      // True if this is the first week (may start mid-week)
  isLastWeek: boolean;       // True if this is the last week (may end mid-week)
}

/**
 * Assignment for a worker in a specific week
 */
export interface Assignment {
  workerId: string;
  workerName: string;
  taskId: string;
  taskName: string;
  taskColor: string;
  isCustomTask: boolean;
  startDate: Date;
  endDate: Date;
  weekNumber: number;
  spansMultipleWeeks: boolean;
}

/**
 * Assignment as stored in Firestore (with Timestamps)
 */
export interface AssignmentFirestore {
  workerId: string;
  workerName: string;
  taskId: string;
  taskName: string;
  taskColor: string;
  isCustomTask: boolean;
  startDate: Timestamp;
  endDate: Timestamp;
  weekNumber: number;
  spansMultipleWeeks: boolean;
}

/**
 * Main task definition from taskDefinitions/config
 */
export interface MainTask {
  id: string;
  name: string;
  isDefault: boolean;
  start_day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  end_day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  duration: number;
}

/**
 * Worker data for table display
 */
export interface Worker {
  workerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'worker';
  isActive: boolean;
}

/**
 * Schedule metadata (as stored in Firestore)
 */
export interface PrimarySchedule {
  scheduleId: string;
  name: string;
  type: 'primary';
  startDate: Timestamp;
  endDate: Timestamp;
  includeAdmins: boolean;
  totalPeriods: number;
  periodDuration: number;
  status: 'draft' | 'published' | 'archived';
  departmentId: string;
  departmentName: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  publishedBy?: string;
}

/**
 * Schedule metadata (with Date objects for UI)
 */
export interface PrimaryScheduleUI {
  scheduleId: string;
  name: string;
  type: 'primary';
  startDate: Date;
  endDate: Date;
  includeAdmins: boolean;
  totalPeriods: number;
  periodDuration: number;
  status: 'draft' | 'published' | 'archived';
  departmentId: string;
  departmentName: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  publishedAt?: Date;
  publishedBy?: string;
}

/**
 * Period document (as stored in Firestore subcollection)
 */
export interface PeriodDocument {
  periodId: string;
  periodNumber: number;
  startDate: Timestamp;
  endDate: Timestamp;
  assignments: AssignmentFirestore[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Period document (with Date objects for UI)
 */
export interface PeriodDocumentUI {
  periodId: string;
  periodNumber: number;
  startDate: Date;
  endDate: Date;
  assignments: Assignment[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom task input from user
 */
export interface CustomTaskInput {
  name: string;              // Max 15 characters
  startDate: Date;           // Must be within week boundaries
  durationDays: number;      // Duration in days
}

/**
 * Past schedule for dropdown display
 */
export interface PastScheduleDisplay {
  scheduleId: string;
  label: string;             // "DD/MM - DD/MM (YYYY): DD/MM/YYYY - עודכן ב"
  startDate: Date;
  endDate: Date;
  year: number;
  updatedAt: Date;
}

/**
 * Cell assignment key format: `${workerId}_${weekNumber}`
 */
export type CellKey = string;

/**
 * Map of cell assignments
 */
export type AssignmentMap = Map<CellKey, Assignment>;

/**
 * Schedule status type
 */
export type ScheduleStatus = 'draft' | 'published' | 'archived';

/**
 * Day of week type
 */
export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

/**
 * User role type
 */
export type UserRole = 'developer' | 'owner' | 'admin' | 'worker';

/**
 * Props for PrimaryTaskTable component
 */
export interface PrimaryTaskTableProps {
  weeks: Week[];
  workers: Worker[];
  admins: Worker[];
  includeAdmins: boolean;
  assignments: AssignmentMap;
  taskDefinitions: MainTask[];
  onCellClick: (workerId: string, weekNumber: number, weekDates: { start: Date; end: Date }) => void;
  isReadOnly: boolean;
}

/**
 * Props for PrimaryTaskCellModal component
 */
export interface PrimaryTaskCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId: string;
  workerName: string;
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  currentAssignment: Assignment | null;
  taskDefinitions: MainTask[];
  onSaveAssignment: (assignment: Assignment | null) => void;
}

/**
 * Create schedule form data
 */
export interface CreateScheduleFormData {
  startDate: Date | null;
  endDate: Date | null;
  includeAdmins: boolean;
}

/**
 * CSV export data structure
 */
export interface CSVExportData {
  scheduleId: string;
  scheduleName: string;
  startDate: string;
  endDate: string;
  lastModified: string;
  headers: string[];         // ["ID", "Name", "1", "2", "3"...]
  subHeaders: string[];      // ["", "", "DD/MM - DD/MM", ...]
  rows: CSVRow[];
}

/**
 * CSV row structure
 */
export interface CSVRow {
  workerId: string;
  workerName: string;
  assignments: (string | null)[]; // Task names or null for each week
}

