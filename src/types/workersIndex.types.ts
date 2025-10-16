/**
 * Workers Index Types
 * 
 * Centralized TypeScript types for the workers index document stored at:
 *   departments/{departmentId}/workersIndex/index
 * 
 * This document aggregates frequently-read worker state to minimize reads on the
 * heavy workers collection. Preferences and schedule flags live here.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * A single preference entry for a worker.
 */
export interface WorkerIndexPreference {
  date: Timestamp;
  taskId: string | null;
  updatedAt: Timestamp;
}

/**
 * A single primary task assignment stored in the workers index.
 * Limited to the most recent 80 entries per worker.
 */
export interface WorkerIndexPrimaryTask {
  startDate: Timestamp;
  endDate: Timestamp;
  taskId: string;
  taskName: string;
  scheduleId?: string;
}

/**
 * Aggregated, frequently-read data for a single worker inside the index.
 */
export interface WorkerIndexEntry {
  lastClosingDate: Timestamp | null;
  primaryTasksMap: WorkerIndexPrimaryTask[]; // capped at 80 entries
  optimalClosingDates: Timestamp[];         // capped at 500 entries
  preferences: WorkerIndexPreference[];     // capped at 80 entries
  score: number;                            // integer, default 0
  closingInterval: number;                  // integer, default 0
  qualifications: string[];                 // worker qualifications for quick reads
}

/**
 * The workers index document shape.
 */
export interface WorkersIndexDoc {
  workers: Record<string, WorkerIndexEntry>; // key: workerId
  updatedAt: Timestamp;
}


