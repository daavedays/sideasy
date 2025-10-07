import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/appConfig';

/**
 * Statistics Operations
 * 
 * Firestore operations for department and user statistics.
 * Tracks metrics like total shifts, hours worked, etc.
 * 
 * Location: src/lib/firestore/statistics.ts
 * Purpose: Statistics data management
 */

export interface DepartmentStatistics {
  id?: string;
  departmentId: string;
  totalWorkers: number;
  totalSchedules: number;
  totalShifts: number;
  totalHours: number;
  lastUpdated: Date;
}

export interface WorkerStatistics {
  id?: string;
  workerId: string;
  departmentId: string;
  totalShifts: number;
  totalHours: number;
  completedShifts: number;
  missedShifts: number;
  performanceScore: number;
  lastUpdated: Date;
}

export const getDepartmentStatistics = async (departmentId: string): Promise<DepartmentStatistics | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.STATISTICS, `dept_${departmentId}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DepartmentStatistics;
    }
    return null;
  } catch (error) {
    console.error('Error getting department statistics:', error);
    throw error;
  }
};

export const updateDepartmentStatistics = async (departmentId: string, data: Partial<DepartmentStatistics>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.STATISTICS, `dept_${departmentId}`);
    await updateDoc(docRef, {
      ...data,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error updating department statistics:', error);
    throw error;
  }
};

export const getWorkerStatistics = async (workerId: string): Promise<WorkerStatistics | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.STATISTICS, `worker_${workerId}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as WorkerStatistics;
    }
    return null;
  } catch (error) {
    console.error('Error getting worker statistics:', error);
    throw error;
  }
};

export const initializeWorkerStatistics = async (workerId: string, departmentId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.STATISTICS, `worker_${workerId}`);
    await setDoc(docRef, {
      workerId,
      departmentId,
      totalShifts: 0,
      totalHours: 0,
      completedShifts: 0,
      missedShifts: 0,
      performanceScore: 100,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error initializing worker statistics:', error);
    throw error;
  }
};

