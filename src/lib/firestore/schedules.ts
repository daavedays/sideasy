import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/appConfig';

/**
 * Schedule Operations
 * 
 * Firestore CRUD operations for schedules.
 * Handles schedule and shift management.
 * 
 * Location: src/lib/firestore/schedules.ts
 * Purpose: Schedule data management
 */

export interface Shift {
  id: string;
  workerId: string;
  startTime: Date;
  endTime: Date;
  type: string;
  qualificationRequired: number;
}

export interface Schedule {
  id?: string;
  departmentId: string;
  startDate: Date;
  endDate: Date;
  shifts: Shift[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createSchedule = async (data: Omit<Schedule, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.SCHEDULES), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

export const getSchedule = async (scheduleId: string): Promise<Schedule | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Schedule;
    }
    return null;
  } catch (error) {
    console.error('Error getting schedule:', error);
    throw error;
  }
};

export const updateSchedule = async (scheduleId: string, data: Partial<Schedule>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

export const getSchedulesByDepartment = async (departmentId: string): Promise<Schedule[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where('departmentId', '==', departmentId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Schedule[];
  } catch (error) {
    console.error('Error getting schedules by department:', error);
    throw error;
  }
};

