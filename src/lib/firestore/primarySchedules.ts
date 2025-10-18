/**
 * Firestore Functions for Primary Schedules
 * 
 * All database operations for primary task scheduling.
 * Handles CRUD operations for schedules and assignments.
 * 
 * Collection Structure:
 * /{departmentId}/schedules/{scheduleId}
 *   └── /primaryTasks/{periodId}
 * 
 * Location: src/lib/firestore/primarySchedules.ts
 * Purpose: Firestore integration for primary scheduling
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteField,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  PrimarySchedule,
  PrimaryScheduleUI,
  Assignment,
  AssignmentMap,
  PastScheduleDisplay,
} from '../../types/primarySchedule.types';
import {
  scheduleFirestoreToUI,
  createNewScheduleFirestore,
  timestampToDate,
  assignmentUIToFirestore,
} from '../utils/firestoreConverters';
import { detectChangedWorkers } from '../utils/assignmentChangeDetector';
import { formatDateFull, formatDateRange } from '../utils/weekUtils';
import { TaskEntry } from './workers';

// assignmentsMap field key is used below; no combined document used anymore

/**
 * Get all schedules for a department (sorted by creation date)
 * 
 * @param departmentId - Department ID
 * @param limitCount - Maximum number of schedules to fetch (default: 15)
 * @returns Array of schedules
 */
export const getPrimarySchedules = async (
  departmentId: string,
  limitCount: number = 15
): Promise<PrimaryScheduleUI[]> => {
  try {
    const schedulesRef = collection(db, 'departments', departmentId, 'primarySchedules');
    const q = query(
      schedulesRef,
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const schedules: PrimaryScheduleUI[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as PrimarySchedule;
      if (data.type === 'primary') {
        schedules.push(scheduleFirestoreToUI(data));
      }
    });

    return schedules;
  } catch (error: any) {
    console.error('Error fetching primary schedules:', error);
    // If collection doesn't exist yet or permission denied, return empty array
    if (error.code === 'permission-denied' || error.code === 'not-found' || error.code === 'failed-precondition') {
      console.log('Collection not accessible, returning empty array');
      return [];
    }
    throw error;
  }
};

/**
 * Get past schedules formatted for dropdown display
 * Fetches the 4 most recent schedules (as per requirements)
 * 
 * @param departmentId - Department ID
 * @returns Array of past schedule display objects (max 4)
 */
export const getPastSchedulesDisplay = async (
  departmentId: string
): Promise<PastScheduleDisplay[]> => {
  try {
    const schedules = await getPrimarySchedules(departmentId, 4);

    return schedules.map((schedule) => ({
      scheduleId: schedule.scheduleId,
      label: `${formatDateRange(schedule.startDate, schedule.endDate)} (${schedule.startDate.getFullYear()}) - עודכן ${formatDateFull(schedule.updatedAt)}`,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      year: schedule.startDate.getFullYear(),
      updatedAt: schedule.updatedAt,
    }));
  } catch (error) {
    console.error('Error fetching past schedules display:', error);
    throw error;
  }
};

/**
 * Create a new primary schedule
 * 
 * @param departmentId - Department ID
 * @param departmentName - Department name
 * @param startDate - Schedule start date
 * @param endDate - Schedule end date
 * @param includeAdmins - Whether to include admins
 * @param totalPeriods - Total number of weeks
 * @param createdBy - User ID creating the schedule
 * @returns Schedule ID
 */
export const createPrimarySchedule = async (
  departmentId: string,
  departmentName: string,
  startDate: Date,
  endDate: Date,
  includeAdmins: boolean,
  totalPeriods: number,
  createdBy: string
): Promise<string> => {
  try {
    const schedulesRef = collection(db, 'departments', departmentId, 'primarySchedules');
    const newScheduleRef = doc(schedulesRef);
    
    const scheduleData = createNewScheduleFirestore(
      departmentId,
      departmentName,
      startDate,
      endDate,
      includeAdmins,
      totalPeriods,
      createdBy
    );

    await setDoc(newScheduleRef, {
      ...scheduleData,
      scheduleId: newScheduleRef.id,
    });

    return newScheduleRef.id;
  } catch (error) {
    console.error('Error creating primary schedule:', error);
    throw error;
  }
};

/**
 * Update schedule metadata
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 * @param updates - Partial schedule updates
 */
export const updateScheduleMetadata = async (
  departmentId: string,
  scheduleId: string,
  updates: Partial<PrimaryScheduleUI>
): Promise<void> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);
    
    // Convert Date objects to Timestamps
    const firestoreUpdates: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    if (updates.startDate) {
      firestoreUpdates.startDate = Timestamp.fromDate(updates.startDate);
    }
    if (updates.endDate) {
      firestoreUpdates.endDate = Timestamp.fromDate(updates.endDate);
    }

    await updateDoc(scheduleRef, firestoreUpdates);
  } catch (error) {
    console.error('Error updating schedule metadata:', error);
    throw error;
  }
};

/**
 * Save all period assignments for a schedule (batch write)
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 * @param assignmentMap - Map of all assignments
 * @param weeks - Array of week objects
 */
export const saveAllPeriodAssignments = async (
  departmentId: string,
  scheduleId: string,
  assignmentMap: AssignmentMap,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>,
  updatedBy: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);
    const snap = await getDoc(scheduleRef);

    // Convert new assignments to a Firestore-friendly map
    const newAssignments: Record<string, any> = {};
    for (const [key, assignment] of assignmentMap.entries()) {
      const base = assignmentUIToFirestore(assignment);
      newAssignments[key] = base;
    }

    if (!snap.exists()) {
      const firstWeek = weeks[0];
      const lastWeek = weeks[weeks.length - 1];
      await setDoc(
        scheduleRef,
        {
          assignmentsMap: newAssignments,
          updatedAt: Timestamp.now(),
          startDate: Timestamp.fromDate(firstWeek.startDate),
          endDate: Timestamp.fromDate(lastWeek.endDate),
        },
        { merge: true }
      );
      return;
    }

    const existing = (snap.data() as any) || {};
    const existingAssignments: Record<string, any> = existing.assignmentsMap || {};

    const updates: Record<string, any> = {};
    const deletions: Record<string, any> = {};

    const toComparable = (obj: any) => ({
      workerId: obj.workerId,
      workerName: obj.workerName,
      taskId: obj.taskId,
      taskName: obj.taskName,
      taskColor: obj.taskColor,
      isCustomTask: obj.isCustomTask,
      weekNumber: obj.weekNumber,
      spansMultipleWeeks: obj.spansMultipleWeeks,
      startDateMs: obj.startDate?.toMillis ? obj.startDate.toMillis() : (obj.startDate?.toDate ? obj.startDate.toDate().getTime() : undefined),
      endDateMs: obj.endDate?.toMillis ? obj.endDate.toMillis() : (obj.endDate?.toDate ? obj.endDate.toDate().getTime() : undefined),
    });

    for (const key of Object.keys(newAssignments)) {
      const prev = existingAssignments[key];
      const next = newAssignments[key];
      const path = `assignmentsMap.${key}`;

      if (!prev) {
        updates[path] = {
          ...next,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy,
        };
      } else {
        const same = JSON.stringify(toComparable(prev)) === JSON.stringify(toComparable(next));
        if (!same) {
          updates[path] = {
            ...next,
            createdAt: prev.createdAt || Timestamp.now(),
            updatedAt: Timestamp.now(),
            updatedBy,
          };
        }
      }
    }

    for (const key of Object.keys(existingAssignments)) {
      if (!(key in newAssignments)) {
        deletions[`assignmentsMap.${key}`] = deleteField();
      }
    }

    await updateDoc(scheduleRef, { ...updates, ...deletions, updatedAt: Timestamp.now() });
  } catch (error) {
    console.error('Error saving assignments map:', error);
    throw error;
  }
};

/**
 * Get all assignments for a schedule
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 * @returns Assignment map
 */
export const getScheduleAssignments = async (
  departmentId: string,
  scheduleId: string
): Promise<AssignmentMap> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);
    const snapshot = await getDoc(scheduleRef);

    const assignmentMap: AssignmentMap = new Map();
    if (!snapshot.exists()) return assignmentMap;

    const data = snapshot.data() as any;
    const assignments = (data && data.assignmentsMap) || {};
    Object.entries(assignments).forEach(([key, raw]) => {
      const a = raw as any;
      assignmentMap.set(key, {
        ...a,
        startDate: a.startDate.toDate(),
        endDate: a.endDate.toDate()
      } as Assignment);
    });

    return assignmentMap;
  } catch (error) {
    console.error('Error fetching schedule assignments:', error);
    throw error;
  }
};

/**
 * Get a specific schedule by ID
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 * @returns Schedule or null
 */
export const getScheduleById = async (
  departmentId: string,
  scheduleId: string
): Promise<PrimaryScheduleUI | null> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);
    const snapshot = await getDoc(scheduleRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as PrimarySchedule;
    return scheduleFirestoreToUI(data);
  } catch (error) {
    console.error('Error fetching schedule by ID:', error);
    throw error;
  }
};

/**
 * Publish a schedule (change status to 'published')
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 * @param publishedBy - User ID publishing the schedule
 */
export const publishSchedule = async (
  departmentId: string,
  scheduleId: string,
  publishedBy: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);

    await updateDoc(scheduleRef, {
      status: 'published',
      publishedAt: Timestamp.now(),
      publishedBy,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error publishing schedule:', error);
    throw error;
  }
};

/**
 * Archive a schedule (change status to 'archived')
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 */
export const archiveSchedule = async (
  departmentId: string,
  scheduleId: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);

    await updateDoc(scheduleRef, {
      status: 'archived',
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error archiving schedule:', error);
    throw error;
  }
};

/**
 * Delete a schedule and all its assignments
 * 
 * @param departmentId - Department ID
 * @param scheduleId - Schedule ID
 */
export const deleteSchedule = async (
  departmentId: string,
  scheduleId: string
): Promise<void> => {
  try {
    const scheduleRef = doc(db, 'departments', departmentId, 'primarySchedules', scheduleId);
    await writeBatch(db).delete(scheduleRef).commit();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

/**
 * Check if a schedule exists for a specific date range (excluding a specific schedule)
 * 
 * @param departmentId - Department ID
 * @param startDate - Start date
 * @param endDate - End date
 * @param excludeScheduleId - Optional schedule ID to exclude from check (for updates)
 * @returns Object with overlap status and overlapping schedule info
 */
export const checkScheduleOverlap = async (
  departmentId: string,
  startDate: Date,
  endDate: Date,
  excludeScheduleId?: string
): Promise<{ hasOverlap: boolean; overlappingSchedule?: PrimaryScheduleUI }> => {
  try {
    const schedulesRef = collection(db, 'departments', departmentId, 'primarySchedules');
    const snapshot = await getDocs(schedulesRef);

    // If no schedules exist, no overlap possible
    if (snapshot.empty) {
      console.log('No existing schedules found, no overlap');
      return { hasOverlap: false };
    }

    for (const doc of snapshot.docs) {
      // Skip excluded schedule (for updates)
      if (excludeScheduleId && doc.id === excludeScheduleId) continue;

      const data = doc.data() as PrimarySchedule;
      if (data.type !== 'primary') continue;

      const scheduleStart = timestampToDate(data.startDate);
      const scheduleEnd = timestampToDate(data.endDate);

      // Check for overlap
      if (
        (startDate >= scheduleStart && startDate <= scheduleEnd) ||
        (endDate >= scheduleStart && endDate <= scheduleEnd) ||
        (startDate <= scheduleStart && endDate >= scheduleEnd)
      ) {
        return {
          hasOverlap: true,
          overlappingSchedule: scheduleFirestoreToUI(data),
        };
      }
    }

    return { hasOverlap: false };
  } catch (error: any) {
    console.error('Error checking schedule overlap:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Department ID:', departmentId);
    
    // If collection doesn't exist yet, that's okay - no overlap
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      console.log('Collection not found or permission denied, assuming no overlap');
      return { hasOverlap: false };
    }
    
    throw error;
  }
};

/**
 * LEGACY: Check if a schedule exists for a specific date range
 * @deprecated Use checkScheduleOverlap instead for more detailed info
 */
export const scheduleExistsForDateRange = async (
  departmentId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> => {
  const result = await checkScheduleOverlap(departmentId, startDate, endDate);
  return result.hasOverlap;
};

// ============================================================================
// WORKER UPDATES (mandatoryClosingDates, assignedMainTasks, statistics)
// ============================================================================

/**
 * Check if a date range spans BOTH Friday AND Saturday
 * Used to determine if worker needs a mandatory closing date
 * 
 * @param startDate - Task start date
 * @param endDate - Task end date
 * @returns True if range includes both Friday and Saturday
 */
const spansFridayAndSaturday = (startDate: Date, endDate: Date): boolean => {
  let hasFriday = false;
  let hasSaturday = false;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 5) hasFriday = true;  // Friday
    if (dayOfWeek === 6) hasSaturday = true; // Saturday
    
    if (hasFriday && hasSaturday) return true;
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return false;
};

/**
 * Get ALL Friday dates from a date range
 * 
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @returns Array of all Friday dates in the range
 */
const getAllFridayDates = (startDate: Date, endDate: Date): Date[] => {
  const fridays: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (currentDate.getDay() === 5) {
      // Add date at midnight Israel time
      fridays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return fridays;
};

/**
 * Update worker's task history, mandatory closing dates, and statistics
 * Called after saving schedule assignments
 * 
 * @param departmentId - Department ID
 * @param workerId - Worker ID
 * @param scheduleId - Schedule ID (used to remove old entries when editing)
 * @param assignments - All assignments for this worker from the schedule
 * @param taskDefinitions - Task definitions to get task names (passed from parent)
 * @param isEdit - Whether this is editing an existing schedule
 * @returns Array of mandatory closing Friday dates (for closing calculator)
 */
const updateWorkerTaskData = async (
  departmentId: string,
  workerId: string,
  scheduleId: string,
  assignments: Assignment[],
  taskDefinitions: Map<string, string>,
  isEdit: boolean = false
): Promise<Date[]> => {
  try {
    console.log(`🔍 [updateWorkerTaskData] Starting update for worker ${workerId} (${isEdit ? 'EDIT' : 'NEW'})`);
    console.log(`🔍 Schedule ID: ${scheduleId}`);
    console.log(`🔍 Received ${assignments.length} assignments`);
    
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      console.warn(`Worker ${workerId} not found, skipping update`);
      return []; // Return empty array if worker not found
    }

    const workerData = workerSnap.data();
    const now = new Date();

    // Use empty baseline for existingPrimaryTasks (deprecated workersIndex removed).
    const existingPrimaryTasks: TaskEntry[] = [];
    const existingTotalMainTasks = workerData.statistics?.totalMainTasks || 0;
    
    console.log(`🔍 Existing primary tasks: ${existingPrimaryTasks.length}`);
    console.log(`🔍 Existing totalMainTasks: ${existingTotalMainTasks}`);

    // If editing, remove old tasks from THIS schedule
    let filteredExistingTasks = existingPrimaryTasks;
    let removedTaskCount = 0;
    
    if (isEdit) {
      // Filter out tasks from this schedule
      // Note: Tasks without scheduleId are legacy data from before we added tracking
      filteredExistingTasks = existingPrimaryTasks.filter(task => {
        // Keep tasks that have a different scheduleId (from other schedules)
        if (task.scheduleId && task.scheduleId !== scheduleId) {
          return true;
        }
        // Remove tasks from this schedule
        if (task.scheduleId === scheduleId) {
          return false;
        }
        // For legacy tasks without scheduleId, keep them (they're from old schedules)
        return true;
      });
      removedTaskCount = existingPrimaryTasks.length - filteredExistingTasks.length;
      console.log(`🔍 [EDIT MODE] Removed ${removedTaskCount} old tasks from schedule ${scheduleId}`);
    }

    // Build new task entries from assignments
    const newTaskEntries: TaskEntry[] = [];
    const allFridays = new Set<string>(); // ISO strings for deduplication
    let latestEndDate: Date | null = null;

    for (const assignment of assignments) {
      const { taskId, startDate, endDate } = assignment;
      const taskName = taskDefinitions.get(taskId) || taskId;
      
      console.log(`🔍 Processing assignment: taskId=${taskId}, taskName=${taskName}, startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}`);

      // Create task entry with scheduleId
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);
      newTaskEntries.push({
        taskName,
        startDate: startTs,
        endDate: endTs,
        scheduleId,
      });
      

      // Get ALL Fridays if task spans Friday + Saturday
      const spansBothDays = spansFridayAndSaturday(startDate, endDate);
      console.log(`🔍 Checking if task spans Friday+Saturday: ${spansBothDays}`);
      
      if (spansBothDays) {
        const fridays = getAllFridayDates(startDate, endDate);
        console.log(`🔍 Found ${fridays.length} Friday dates:`, fridays.map(f => f.toISOString()));
        fridays.forEach(friday => {
          allFridays.add(friday.toISOString());
        });
      }

      // Track latest end date
      if (!latestEndDate || endDate > latestEndDate) {
        latestEndDate = endDate;
      }
    }
    
    console.log(`🔍 Created ${newTaskEntries.length} new task entries`);
    console.log(`🔍 Found ${allFridays.size} new Friday dates`);

    // Merge filtered existing tasks with new ones (replace old schedule data with new)
    const allPrimaryTasks = [...filteredExistingTasks, ...newTaskEntries];

    // Split into completed vs ongoing based on current date
    const completedMainTasks: TaskEntry[] = [];
    const ongoingTasks: TaskEntry[] = [];

    allPrimaryTasks.forEach(task => {
      const taskEndDate = task.endDate.toDate();
      if (taskEndDate < now) {
        completedMainTasks.push(task);
      } else {
        ongoingTasks.push(task);
      }
    });

    // Recalculate totalMainTasks
    // When editing: recalculate based on filtered tasks + new tasks
    // When creating new: increment from existing
    const newTotalMainTasks = isEdit 
      ? (filteredExistingTasks.length + newTaskEntries.length)
      : (existingTotalMainTasks + assignments.length);

    // Handle mandatory closing dates
    // Recalculate from the union of existing primary tasks (from workersIndex) and new task entries
    let mandatoryDatesArray: Timestamp[];
    const allTasksForFridayCheck = isEdit
      ? [...filteredExistingTasks, ...newTaskEntries]
      : [...existingPrimaryTasks, ...newTaskEntries];

    const allFridaysRecalculated = new Set<string>();
    for (const task of allTasksForFridayCheck) {
      const taskStart = task.startDate.toDate();
      const taskEnd = task.endDate.toDate();
      if (spansFridayAndSaturday(taskStart, taskEnd)) {
        const fridays = getAllFridayDates(taskStart, taskEnd);
        fridays.forEach(friday => {
          allFridaysRecalculated.add(friday.toISOString());
        });
      }
    }

    mandatoryDatesArray = Array.from(allFridaysRecalculated)
      .map(isoString => {
        const date = new Date(isoString);
        date.setHours(12, 0, 0, 0); // Normalize to 12:00 noon
        return date;
      })
      .sort((a, b) => a.getTime() - b.getTime())
      .map(date => Timestamp.fromDate(date));

    // Calculate lastClosingDate (most recent Friday from mandatoryClosingDates)
    const lastClosingDate = mandatoryDatesArray.length > 0
      ? mandatoryDatesArray[mandatoryDatesArray.length - 1]
      : null;

    

    // Update only statistics and updatedAt on workers doc
    const statsUpdate: any = {
      statistics: {
        totalMainTasks: newTotalMainTasks,
        totalSecondaryTasks: workerData.statistics?.totalSecondaryTasks || 0,
        lastShiftDate: latestEndDate ? Timestamp.fromDate(latestEndDate) : workerData.statistics?.lastShiftDate || null,
      },
      updatedAt: Timestamp.now(),
    };

    console.log(`🔍 Final stats update for worker ${workerId}:`, {
      primaryTasksCount: allPrimaryTasks.length,
      mandatoryClosingDatesCount: mandatoryDatesArray.length,
      totalMainTasks: newTotalMainTasks,
      lastClosingDate: lastClosingDate?.toDate().toISOString() || null,
    });

    await updateDoc(workerRef, statsUpdate);
    console.log(`✅ Updated worker ${workerId} statistics`);
    
    // Return mandatory dates as Date objects (normalized to noon Israel time for consistency)
    return mandatoryDatesArray.map(ts => {
      const date = ts.toDate();
      // Set to 12:00 noon Israel time (UTC+2/+3 depending on DST, using +2 for consistency)
      date.setHours(12, 0, 0, 0);
      return date;
    });
  } catch (error) {
    console.error(`Error updating worker ${workerId} task data:`, error);
    return []; // Return empty array on error (don't block closing calculation)
  }
};

/**
 * Save schedule with comprehensive worker updates
 * This is the main save function that handles everything atomically
 * 
 * @param departmentId - Department ID
 * @param departmentName - Department name in Hebrew
 * @param startDate - Schedule start date
 * @param endDate - Schedule end date
 * @param includeAdmins - Include admins in schedule
 * @param weeks - Array of week objects
 * @param assignments - Map of all assignments
 * @param createdBy - User ID creating/updating the schedule
 * @param existingScheduleId - Optional: ID of existing schedule to update
 * @returns Schedule ID
 */
export const saveScheduleWithWorkerUpdates = async (
  departmentId: string,
  departmentName: string,
  startDate: Date,
  endDate: Date,
  includeAdmins: boolean,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>,
  assignments: AssignmentMap,
  createdBy: string,
  existingScheduleId?: string
): Promise<string> => {
  try {
    console.log(`🔍 [saveScheduleWithWorkerUpdates] Called with existingScheduleId: ${existingScheduleId || 'undefined'}`);
    
    let scheduleId = existingScheduleId;

    // Step 1: Load original assignments BEFORE updating (for change detection)
    const originalAssignmentsMap = new Map<string, Assignment>();
    if (existingScheduleId) {
      try {
        console.log(`🔍 Loading original assignments from existing schedule: ${existingScheduleId}`);
        const loadedOriginal = await getScheduleAssignments(departmentId, existingScheduleId);
        loadedOriginal.forEach((assignment, key) => {
          originalAssignmentsMap.set(key, assignment);
        });
        console.log(`🔍 Loaded ${originalAssignmentsMap.size} original assignments for comparison`);
      } catch (error) {
        console.warn('Could not load original assignments for change detection:', error);
      }
    }

    // Step 2: Create or update schedule metadata
    if (scheduleId) {
      // Update existing schedule
      console.log(`🔍 UPDATING existing schedule: ${scheduleId}`);
      await updateScheduleMetadata(departmentId, scheduleId, {
        startDate,
        endDate,
        includeAdmins,
        totalPeriods: weeks.length,
      });
    } else {
      // Create new schedule
      console.log(`🔍 CREATING new schedule (no existingScheduleId provided)`);
      scheduleId = await createPrimarySchedule(
        departmentId,
        departmentName,
        startDate,
        endDate,
        includeAdmins,
        weeks.length,
        createdBy
      );
      console.log(`🔍 Created new schedule with ID: ${scheduleId}`);
    }

    // Step 3: Save all assignments as a single combined period document
    await saveAllPeriodAssignments(departmentId, scheduleId, assignments, weeks, createdBy);

    // Step 4: Load task definitions to get task names
    const { getTaskDefinitions } = await import('./taskDefinitions');
    const taskDefs = await getTaskDefinitions(departmentId);
    
    // Build taskId -> taskName map
    const taskDefinitionsMap = new Map<string, string>();
    if (taskDefs && taskDefs.main_tasks && taskDefs.main_tasks.definitions) {
      taskDefs.main_tasks.definitions.forEach(task => {
        taskDefinitionsMap.set(task.id, task.name);
      });
    }

    // Step 5: Group assignments by worker
    console.log(`🔍 [saveScheduleWithWorkerUpdates] Total assignments in map: ${assignments.size}`);
    
    const assignmentsByWorker = new Map<string, Assignment[]>();
    assignments.forEach((assignment) => {
      const workerId = assignment.workerId;
      if (!assignmentsByWorker.has(workerId)) {
        assignmentsByWorker.set(workerId, []);
      }
      assignmentsByWorker.get(workerId)!.push(assignment);
    });

    console.log(`🔍 [saveScheduleWithWorkerUpdates] Grouped into ${assignmentsByWorker.size} workers`);
    assignmentsByWorker.forEach((workerAssignments, workerId) => {
      console.log(`🔍 Worker ${workerId} has ${workerAssignments.length} assignments`);
    });

    // Step 6: Determine which workers actually changed and update only those
    const isEdit = !!existingScheduleId;
    const changedWorkerIds = detectChangedWorkers(originalAssignmentsMap, assignments);

    // Step 7: Update changed workers' data (in parallel)
    const workerMandatoryDates = new Map<string, Date[]>();

    // Build a fast lookup for weekNumber -> week end date (Saturday)
    const weekEndByNumber = new Map<number, Date>();
    weeks.forEach(w => weekEndByNumber.set(w.weekNumber, w.endDate));

    const workerUpdatePromises = Array.from(changedWorkerIds).map(async (workerId) => {
      const workerAssignments = assignmentsByWorker.get(workerId) || [];
      const mandatoryDates = await updateWorkerTaskData(
        departmentId,
        workerId,
        scheduleId,
        workerAssignments,
        taskDefinitionsMap,
        isEdit
      );
      workerMandatoryDates.set(workerId, mandatoryDates);

      
    });

    await Promise.all(workerUpdatePromises);

    console.log(`✅ Schedule ${scheduleId} saved with updates for ${changedWorkerIds.size} workers`);
    
    // Step 8: Calculate and update optimal closing dates for affected workers
    // Pass mandatory dates directly (from Step 6) to avoid Firestore cache issues
    // Use originalAssignmentsMap loaded in Step 1 (before updates) for accurate change detection
    try {
      const { updateOptimalClosingDates } = await import('./closingScheduleUpdater');
      
      console.log(`🔍 Calling updateOptimalClosingDates with ${originalAssignmentsMap.size} original assignments vs ${assignments.size} new assignments`);
      
      const updatedWorkerIds = await updateOptimalClosingDates(
        departmentId,
        originalAssignmentsMap,  // Use the original assignments from Step 1
        assignments,
        weeks,
        workerMandatoryDates  // Pass mandatory dates directly from worker updates
      );
      
      console.log(`✅ Updated optimal closing dates for ${updatedWorkerIds.length} workers`);
    } catch (error) {
      // Don't fail the entire save if closing date calculation fails
      console.error('⚠️ Error calculating optimal closing dates (schedule still saved):', error);
    }
    
    return scheduleId;
  } catch (error) {
    console.error('Error saving schedule with worker updates:', error);
    throw error;
  }
};

