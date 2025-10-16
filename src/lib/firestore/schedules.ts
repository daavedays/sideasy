/**
 * Schedule Operations
 * 
 * Firestore CRUD operations for schedules and primary tasks.
 * Handles schedule metadata and primary task assignments.
 * 
 * Location: src/lib/firestore/schedules.ts
 * Purpose: Schedule and primary task data management
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Schedule status enum
 */
export type ScheduleStatus = 'draft' | 'published' | 'archived';

/**
 * Schedule type enum
 */
export type ScheduleType = 'primary' | 'secondary';

/**
 * Worker assignment within a period
 */
export interface WorkerAssignment {
  workerId: string;            // Worker's user ID
  workerName: string;          // Hebrew full name
  taskId: string;              // Main task ID from taskDefinitions
  taskName: string;            // Hebrew task name
  startDate: Timestamp;        // Assignment start date
  endDate: Timestamp;          // Assignment end date
}

/**
 * Primary task period document
 */
export interface PrimaryTaskPeriod {
  periodId: string;            // Document ID
  periodNumber: number;        // 1, 2, 3... for sorting
  startDate: Timestamp;        // Period start date
  endDate: Timestamp;          // Period end date
  assignments: WorkerAssignment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Schedule document
 */
export interface Schedule {
  scheduleId: string;          // Document ID
  name: string;                // Schedule name in Hebrew
  type: ScheduleType;
  startDate: Timestamp;        // Overall schedule start
  endDate: Timestamp;          // Overall schedule end
  totalPeriods: number;        // Number of periods (weeks)
  periodDuration: number;      // Days per period (usually 7)
  status: ScheduleStatus;
  departmentId: string;
  departmentName: string;      // Hebrew name for display
  createdAt: Timestamp;
  createdBy: string;           // User ID
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  publishedBy?: string;
}

/**
 * Input data for creating a schedule
 */
export interface CreateScheduleInput {
  name: string;
  type: ScheduleType;
  startDate: Date;
  endDate: Date;
  totalPeriods: number;
  periodDuration: number;
  departmentId: string;
  departmentName: string;
  createdBy: string;
}

/**
 * Input data for creating a primary task period
 */
export interface CreatePrimaryTaskPeriodInput {
  periodNumber: number;
  startDate: Date;
  endDate: Date;
  assignments: (Omit<WorkerAssignment, 'startDate' | 'endDate'> & {
    startDate: Date;
    endDate: Date;
  })[];
}

// ============================================
// SCHEDULE OPERATIONS
// ============================================

/**
 * Create a new schedule
 * @param data Schedule creation data
 * @returns Schedule ID
 */
export const createSchedule = async (data: CreateScheduleInput): Promise<string> => {
  try {
    const schedulePath = `departments/${data.departmentId}/schedules`;
    const scheduleRef = collection(db, schedulePath);
    
    const scheduleData = {
      name: data.name,
      type: data.type,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      totalPeriods: data.totalPeriods,
      periodDuration: data.periodDuration,
      status: 'draft' as ScheduleStatus,
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      createdAt: serverTimestamp(),
      createdBy: data.createdBy,
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(scheduleRef, scheduleData);
    
    console.log('✅ Schedule created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating schedule:', error);
    throw error;
  }
};

/**
 * Get a schedule by ID
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @returns Schedule or null
 */
export const getSchedule = async (
  departmentId: string, 
  scheduleId: string
): Promise<Schedule | null> => {
  try {
    const schedulePath = `departments/${departmentId}/schedules`;
    const docRef = doc(db, schedulePath, scheduleId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { 
        scheduleId: docSnap.id, 
        ...docSnap.data() 
      } as Schedule;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting schedule:', error);
    throw error;
  }
};

/**
 * Get all schedules for a department
 * @param departmentId Department ID
 * @returns Array of schedules
 */
export const getSchedulesByDepartment = async (
  departmentId: string
): Promise<Schedule[]> => {
  try {
    const schedulePath = `departments/${departmentId}/schedules`;
    const scheduleRef = collection(db, schedulePath);
    const querySnapshot = await getDocs(scheduleRef);
    
    const schedules = querySnapshot.docs.map(doc => ({
      scheduleId: doc.id,
      ...doc.data()
    })) as Schedule[];
    
    // Sort by creation date (newest first)
    schedules.sort((a, b) => {
      const aDate = a.createdAt as Timestamp;
      const bDate = b.createdAt as Timestamp;
      return bDate.toMillis() - aDate.toMillis();
    });
    
    return schedules;
  } catch (error) {
    console.error('❌ Error getting schedules by department:', error);
    throw error;
  }
};

/**
 * Update a schedule
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param updates Partial schedule data to update
 */
export const updateSchedule = async (
  departmentId: string,
  scheduleId: string,
  updates: Partial<Omit<Schedule, 'scheduleId' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  try {
    const schedulePath = `departments/${departmentId}/schedules`;
    const docRef = doc(db, schedulePath, scheduleId);
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Schedule updated successfully:', scheduleId);
  } catch (error) {
    console.error('❌ Error updating schedule:', error);
    throw error;
  }
};

/**
 * Publish a schedule
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param publishedBy User ID who is publishing
 */
export const publishSchedule = async (
  departmentId: string,
  scheduleId: string,
  publishedBy: string
): Promise<void> => {
  try {
    await updateSchedule(departmentId, scheduleId, {
      status: 'published',
      publishedAt: Timestamp.now(),
      publishedBy
    });
    
    console.log('✅ Schedule published successfully:', scheduleId);
  } catch (error) {
    console.error('❌ Error publishing schedule:', error);
    throw error;
  }
};

/**
 * Archive a schedule
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 */
export const archiveSchedule = async (
  departmentId: string,
  scheduleId: string
): Promise<void> => {
  try {
    await updateSchedule(departmentId, scheduleId, {
      status: 'archived'
    });
    
    console.log('✅ Schedule archived successfully:', scheduleId);
  } catch (error) {
    console.error('❌ Error archiving schedule:', error);
    throw error;
  }
};

/**
 * Delete a schedule (and all its primary tasks)
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 */
export const deleteSchedule = async (
  departmentId: string,
  scheduleId: string
): Promise<void> => {
  try {
    // First delete all primary tasks
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const primaryTasksRef = collection(db, primaryTasksPath);
    const primaryTasksSnapshot = await getDocs(primaryTasksRef);
    
    const deletePromises = primaryTasksSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    await Promise.all(deletePromises);
    
    // Then delete the schedule
    const schedulePath = `departments/${departmentId}/schedules`;
    const scheduleRef = doc(db, schedulePath, scheduleId);
    await deleteDoc(scheduleRef);
    
    console.log('✅ Schedule and all primary tasks deleted successfully:', scheduleId);
  } catch (error) {
    console.error('❌ Error deleting schedule:', error);
    throw error;
  }
};

// ============================================
// PRIMARY TASK OPERATIONS
// ============================================

/**
 * Create a primary task period
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param data Period creation data
 * @returns Period ID
 */
export const createPrimaryTaskPeriod = async (
  departmentId: string,
  scheduleId: string,
  data: CreatePrimaryTaskPeriodInput
): Promise<string> => {
  try {
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const primaryTasksRef = collection(db, primaryTasksPath);
    
    const periodData = {
      periodNumber: data.periodNumber,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      assignments: data.assignments.map(assignment => ({
        ...assignment,
        startDate: Timestamp.fromDate(assignment.startDate),
        endDate: Timestamp.fromDate(assignment.endDate)
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(primaryTasksRef, periodData);
    
    console.log('✅ Primary task period created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating primary task period:', error);
    throw error;
  }
};

/**
 * Get a primary task period by ID
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param periodId Period ID
 * @returns Primary task period or null
 */
export const getPrimaryTaskPeriod = async (
  departmentId: string,
  scheduleId: string,
  periodId: string
): Promise<PrimaryTaskPeriod | null> => {
  try {
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const docRef = doc(db, primaryTasksPath, periodId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        periodId: docSnap.id,
        ...docSnap.data()
      } as PrimaryTaskPeriod;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting primary task period:', error);
    throw error;
  }
};

/**
 * Get all primary task periods for a schedule
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @returns Array of primary task periods (sorted by period number)
 */
export const getPrimaryTasksBySchedule = async (
  departmentId: string,
  scheduleId: string
): Promise<PrimaryTaskPeriod[]> => {
  try {
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const primaryTasksRef = collection(db, primaryTasksPath);
    const querySnapshot = await getDocs(primaryTasksRef);
    
    const periods = querySnapshot.docs.map(doc => ({
      periodId: doc.id,
      ...doc.data()
    })) as PrimaryTaskPeriod[];
    
    // Sort by period number
    periods.sort((a, b) => a.periodNumber - b.periodNumber);
    
    return periods;
  } catch (error) {
    console.error('❌ Error getting primary tasks by schedule:', error);
    throw error;
  }
};

/**
 * Update a primary task period
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param periodId Period ID
 * @param updates Partial period data to update
 */
export const updatePrimaryTaskPeriod = async (
  departmentId: string,
  scheduleId: string,
  periodId: string,
  updates: Partial<Omit<PrimaryTaskPeriod, 'periodId' | 'createdAt'>>
): Promise<void> => {
  try {
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const docRef = doc(db, primaryTasksPath, periodId);
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Primary task period updated successfully:', periodId);
  } catch (error) {
    console.error('❌ Error updating primary task period:', error);
    throw error;
  }
};

/**
 * Delete a primary task period
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param periodId Period ID
 */
export const deletePrimaryTaskPeriod = async (
  departmentId: string,
  scheduleId: string,
  periodId: string
): Promise<void> => {
  try {
    const primaryTasksPath = `departments/${departmentId}/schedules/${scheduleId}/primaryTasks`;
    const docRef = doc(db, primaryTasksPath, periodId);
    await deleteDoc(docRef);
    
    console.log('✅ Primary task period deleted successfully:', periodId);
  } catch (error) {
    console.error('❌ Error deleting primary task period:', error);
    throw error;
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Export schedule to CSV format
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @returns CSV string
 */
export const exportScheduleToCSV = async (
  departmentId: string,
  scheduleId: string
): Promise<string> => {
  try {
    const schedule = await getSchedule(departmentId, scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }
    
    const periods = await getPrimaryTasksBySchedule(departmentId, scheduleId);
    
    // Build worker map: workerId -> [period assignments]
    const workerMap = new Map<string, { name: string; assignments: Map<number, string> }>();
    
    periods.forEach(period => {
      period.assignments.forEach(assignment => {
        if (!workerMap.has(assignment.workerId)) {
          workerMap.set(assignment.workerId, {
            name: assignment.workerName,
            assignments: new Map()
          });
        }
        workerMap.get(assignment.workerId)!.assignments.set(
          period.periodNumber,
          assignment.taskName
        );
      });
    });
    
    // Build CSV header
    const header = ['id', 'name'];
    for (let i = 1; i <= schedule.totalPeriods; i++) {
      const period = periods.find(p => p.periodNumber === i);
      if (period) {
        const startDate = (period.startDate as Timestamp).toDate();
        const endDate = (period.endDate as Timestamp).toDate();
        const dateRange = `${startDate.toLocaleDateString('he-IL')} - ${endDate.toLocaleDateString('he-IL')}`;
        header.push(`${i} (${dateRange})`);
      } else {
        header.push(i.toString());
      }
    }
    
    // Build CSV rows
    const rows: string[] = [header.join(',')];
    
    workerMap.forEach((data, workerId) => {
      const row = [workerId, data.name];
      for (let i = 1; i <= schedule.totalPeriods; i++) {
        row.push(data.assignments.get(i) || '-');
      }
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  } catch (error) {
    console.error('❌ Error exporting schedule to CSV:', error);
    throw error;
  }
};

/**
 * Generate empty periods for a schedule
 * @param departmentId Department ID
 * @param scheduleId Schedule ID
 * @param totalPeriods Number of periods to generate
 * @param startDate Schedule start date
 * @param periodDuration Days per period
 */
export const generateEmptyPeriods = async (
  departmentId: string,
  scheduleId: string,
  totalPeriods: number,
  startDate: Date,
  periodDuration: number
): Promise<void> => {
  try {
    const promises: Promise<string>[] = [];
    
    for (let i = 1; i <= totalPeriods; i++) {
      const periodStart = new Date(startDate);
      periodStart.setDate(periodStart.getDate() + (i - 1) * periodDuration);
      
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + periodDuration - 1);
      periodEnd.setHours(23, 59, 59, 999);
      
      promises.push(
        createPrimaryTaskPeriod(departmentId, scheduleId, {
          periodNumber: i,
          startDate: periodStart,
          endDate: periodEnd,
          assignments: []
        })
      );
    }
    
    await Promise.all(promises);
    console.log(`✅ Generated ${totalPeriods} empty periods successfully`);
  } catch (error) {
    console.error('❌ Error generating empty periods:', error);
    throw error;
  }
};
