/**
 * Firestore Data Converters for Primary Scheduling
 * 
 * Converts between Firestore Timestamps and JavaScript Dates
 * for primary schedule data types.
 * 
 * Location: src/lib/utils/firestoreConverters.ts
 * Purpose: Type-safe Firestore data conversion
 */

import { Timestamp } from 'firebase/firestore';
import {
  PrimarySchedule,
  PrimaryScheduleUI,
  PeriodDocument,
  PeriodDocumentUI,
  Assignment,
  AssignmentFirestore,
} from '../../types/primarySchedule.types';

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export const timestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export const dateToTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

/**
 * Convert PrimarySchedule (Firestore) to PrimaryScheduleUI (with Dates)
 */
export const scheduleFirestoreToUI = (schedule: PrimarySchedule): PrimaryScheduleUI => {
  return {
    ...schedule,
    startDate: timestampToDate(schedule.startDate),
    endDate: timestampToDate(schedule.endDate),
    createdAt: timestampToDate(schedule.createdAt),
    updatedAt: timestampToDate(schedule.updatedAt),
    publishedAt: schedule.publishedAt ? timestampToDate(schedule.publishedAt) : undefined,
  };
};

/**
 * Convert PrimaryScheduleUI (with Dates) to PrimarySchedule (Firestore)
 */
export const scheduleUIToFirestore = (schedule: PrimaryScheduleUI): PrimarySchedule => {
  return {
    ...schedule,
    startDate: dateToTimestamp(schedule.startDate),
    endDate: dateToTimestamp(schedule.endDate),
    createdAt: dateToTimestamp(schedule.createdAt),
    updatedAt: dateToTimestamp(schedule.updatedAt),
    publishedAt: schedule.publishedAt ? dateToTimestamp(schedule.publishedAt) : undefined,
  };
};

/**
 * Convert Assignment (UI) to AssignmentFirestore
 */
export const assignmentUIToFirestore = (assignment: Assignment): AssignmentFirestore => {
  return {
    ...assignment,
    startDate: dateToTimestamp(assignment.startDate),
    endDate: dateToTimestamp(assignment.endDate),
  };
};

/**
 * Convert AssignmentFirestore to Assignment (UI)
 */
export const assignmentFirestoreToUI = (assignment: AssignmentFirestore): Assignment => {
  return {
    ...assignment,
    startDate: timestampToDate(assignment.startDate),
    endDate: timestampToDate(assignment.endDate),
  };
};

/**
 * Convert PeriodDocument (Firestore) to PeriodDocumentUI (with Dates)
 */
export const periodFirestoreToUI = (period: PeriodDocument): PeriodDocumentUI => {
  return {
    ...period,
    startDate: timestampToDate(period.startDate),
    endDate: timestampToDate(period.endDate),
    createdAt: timestampToDate(period.createdAt),
    updatedAt: timestampToDate(period.updatedAt),
    assignments: period.assignments.map(assignmentFirestoreToUI),
  };
};

/**
 * Convert PeriodDocumentUI (with Dates) to PeriodDocument (Firestore)
 */
export const periodUIToFirestore = (period: PeriodDocumentUI): PeriodDocument => {
  return {
    ...period,
    startDate: dateToTimestamp(period.startDate),
    endDate: dateToTimestamp(period.endDate),
    createdAt: dateToTimestamp(period.createdAt),
    updatedAt: dateToTimestamp(period.updatedAt),
    assignments: period.assignments.map(assignmentUIToFirestore),
  };
};

/**
 * Create a new Firestore-ready schedule object
 */
export const createNewScheduleFirestore = (
  departmentId: string,
  departmentName: string,
  startDate: Date,
  endDate: Date,
  includeAdmins: boolean,
  totalPeriods: number,
  createdBy: string
): Omit<PrimarySchedule, 'scheduleId'> => {
  const now = Timestamp.now();
  
  return {
    name: `תורנות ${formatDateForScheduleName(startDate)} - ${formatDateForScheduleName(endDate)}`,
    type: 'primary',
    startDate: dateToTimestamp(startDate),
    endDate: dateToTimestamp(endDate),
    includeAdmins,
    totalPeriods,
    periodDuration: 7, // Always 7 days (weekly)
    status: 'draft',
    departmentId,
    departmentName,
    createdAt: now,
    createdBy,
    updatedAt: now,
  };
};

/**
 * Format date for schedule name (DD/MM/YYYY)
 */
const formatDateForScheduleName = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Create a new Firestore-ready period document
 */
export const createNewPeriodFirestore = (
  periodNumber: number,
  startDate: Date,
  endDate: Date
): Omit<PeriodDocument, 'periodId'> => {
  const now = Timestamp.now();
  
  return {
    periodNumber,
    startDate: dateToTimestamp(startDate),
    endDate: dateToTimestamp(endDate),
    assignments: [],
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update period with new assignments
 */
export const updatePeriodAssignments = (
  period: PeriodDocument,
  newAssignments: Assignment[]
): PeriodDocument => {
  return {
    ...period,
    assignments: newAssignments.map(assignmentUIToFirestore),
    updatedAt: Timestamp.now(),
  };
};

