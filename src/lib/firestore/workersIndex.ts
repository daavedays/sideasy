/**
 * Workers Index Firestore Utilities
 * 
 * Document path:
 *   departments/{departmentId}/workersIndex/index
 * 
 * Purpose:
 * - Provide an aggregated, frequently-read view of worker scheduling-related state
 * - Keep heavy arrays out of workers collection for cost and performance
 */

import { doc, getDoc, serverTimestamp, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { WorkersIndexDoc, WorkerIndexEntry, WorkerIndexPrimaryTask } from '../../types/workersIndex.types';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const MAX_OPTIMAL_DATES = 500;
const MAX_PREFERENCES = 80;
const MAX_PRIMARY_TASKS = 80;

function clampArray<T>(arr: T[], max: number): T[] {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= max) return arr;
  // Keep most recent entries by assuming later items are newer
  return arr.slice(arr.length - max);
}

function createEmptyEntry(): WorkerIndexEntry {
  return {
    lastClosingDate: null,
    primaryTasksMap: [],
    optimalClosingDates: [],
    preferences: [],
    score: 0,
    closingInterval: 0,
    qualifications: []
  };
}

/**
 * Ensure the workers index document exists for a department.
 */
export async function ensureWorkersIndex(departmentId: string): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    const data: WorkersIndexDoc = {
      workers: {},
      updatedAt: serverTimestamp() as Timestamp
    } as unknown as WorkersIndexDoc;
    await setDoc(indexRef, data);
  }
}

/**
 * Upsert a partial entry for a worker in the workers index.
 * This merges fields and enforces caps on large arrays.
 */
export async function upsertWorkerIndexEntry(
  departmentId: string,
  workerId: string,
  updates: Partial<WorkerIndexEntry>
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);

  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const nextEntry: WorkerIndexEntry = {
    lastClosingDate: updates.lastClosingDate !== undefined ? updates.lastClosingDate : existingEntry.lastClosingDate,
    primaryTasksMap: clampArray(
      updates.primaryTasksMap ? [...existingEntry.primaryTasksMap, ...updates.primaryTasksMap] : existingEntry.primaryTasksMap,
      MAX_PRIMARY_TASKS
    ),
    optimalClosingDates: clampArray(
      updates.optimalClosingDates ? [...existingEntry.optimalClosingDates, ...updates.optimalClosingDates] : existingEntry.optimalClosingDates,
      MAX_OPTIMAL_DATES
    ),
    preferences: clampArray(
      updates.preferences ? [...existingEntry.preferences, ...updates.preferences] : existingEntry.preferences,
      MAX_PREFERENCES
    ),
    score: updates.score !== undefined ? updates.score : existingEntry.score,
    closingInterval: updates.closingInterval !== undefined ? updates.closingInterval : (existingEntry.closingInterval ?? 0),
    qualifications: updates.qualifications !== undefined ? updates.qualifications : (existingEntry.qualifications || [])
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Set or update only the closingInterval for a worker's index entry.
 */
export async function setWorkerClosingInterval(
  departmentId: string,
  workerId: string,
  closingInterval: number
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    closingInterval: closingInterval ?? 0
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Replace optimalClosingDates for a worker (does NOT append, fully replaces).
 * Also bumps updatedAt to notify listeners.
 */
export async function replaceOptimalClosingDates(
  departmentId: string,
  workerId: string,
  optimalDates: Timestamp[]
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    optimalClosingDates: clampArray(optimalDates || [], MAX_OPTIMAL_DATES)
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Replace hasPrimaryTaskOn only for a given set of Friday keys (DD/MM/YYYY).
 * Removes any existing keys within the provided set, then applies the new map.
 * This ensures stale entries from edited schedules are cleaned.
 */
export async function setPrimaryTasksMapForRange(
  departmentId: string,
  workerId: string,
  rangeKeysToReplace: string[], // DD/MM/YYYY keys of Fridays in schedule
  newTasks: WorkerIndexPrimaryTask[]
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const replaceSet = new Set(rangeKeysToReplace || []);
  // Keep entries whose Friday key is NOT in replace set
  const preserved: WorkerIndexPrimaryTask[] = (existingEntry.primaryTasksMap || []).filter((t) => {
    const friday = new Date(t.endDate.toDate());
    friday.setDate(friday.getDate() - 1);
    const key = formatDateDDMMYYYY(friday);
    return !replaceSet.has(key);
  });

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    primaryTasksMap: clampArray([...(preserved || []), ...(newTasks || [])], MAX_PRIMARY_TASKS)
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Replace only the primaryTasksMap entries that belong to a specific scheduleId.
 * This prevents duplicates across weeks and keeps exactly one entry per assigned task.
 */
export async function setPrimaryTasksMapForSchedule(
  departmentId: string,
  workerId: string,
  scheduleId: string,
  newTasks: WorkerIndexPrimaryTask[]
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  // Keep entries from other schedules
  const preserved: WorkerIndexPrimaryTask[] = (existingEntry.primaryTasksMap || []).filter((t) => t.scheduleId !== scheduleId);

  // Deduplicate new tasks by (taskId,start,end,scheduleId)
  const uniq = new Map<string, WorkerIndexPrimaryTask>();
  (newTasks || []).forEach((t) => {
    const key = `${t.taskId}|${t.startDate.toMillis()}|${t.endDate.toMillis()}|${scheduleId}`;
    if (!uniq.has(key)) uniq.set(key, t);
  });

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    primaryTasksMap: clampArray([...(preserved || []), ...Array.from(uniq.values())], MAX_PRIMARY_TASKS)
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Replace only optimalClosingDates that match provided Friday keys.
 * Keeps all other optimal dates intact.
 */
export async function setOptimalClosingDatesForFridays(
  departmentId: string,
  workerId: string,
  fridayKeysToReplace: string[],
  newOptimalDates: Date[]
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const replaceSet = new Set(fridayKeysToReplace || []);

  // Keep existing optimal dates that are NOT in the replace set
  const preserved: Timestamp[] = (existingEntry.optimalClosingDates || []).filter((ts) => {
    const key = formatDateDDMMYYYY(ts.toDate());
    return !replaceSet.has(key);
  });

  // Add the new dates for the schedule range
  const additions: Timestamp[] = (newOptimalDates || []).map((d) => Timestamp.fromDate(d));

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    optimalClosingDates: clampArray([...preserved, ...additions], MAX_OPTIMAL_DATES)
  };

  await updateDoc(indexRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
}

/**
 * Replace a worker's preferences fully. Only for the worker to call on their own entry.
 */
export async function replaceWorkerPreferences(
  departmentId: string,
  workerId: string,
  preferences: WorkerIndexEntry['preferences']
): Promise<void> {
  const indexRef = doc(db, 'departments', departmentId, 'workersIndex', 'index');
  const snap = await getDoc(indexRef);
  if (!snap.exists()) {
    await ensureWorkersIndex(departmentId);
  }

  const clamped = clampArray(preferences || [], MAX_PREFERENCES);
  const current = (await getDoc(indexRef)).data() as WorkersIndexDoc | undefined;
  const existingEntry: WorkerIndexEntry = current?.workers?.[workerId] || createEmptyEntry();

  const nextEntry: WorkerIndexEntry = {
    ...existingEntry,
    preferences: clamped
  };

  const nextWorkers = {
    ...(current?.workers || {}),
    [workerId]: nextEntry
  };

  await updateDoc(indexRef, {
    workers: nextWorkers,
    updatedAt: serverTimestamp()
  });

  // Mirror preferences to byWorker doc under workers/index/byWorker/{workerId}
  const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
  // Ensure document exists with minimal shape and update preferences only
  await setDoc(
    byWorkerRef,
    {
      preferences: clamped,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}


