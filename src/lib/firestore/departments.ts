import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/appConfig';
import { DEFAULT_CLOSING_CONFIG } from '../../types/closingSchedule.types';

/**
 * Department Operations
 * 
 * Firestore CRUD operations for departments.
 * Handles department creation, updates, and queries.
 * 
 * Location: src/lib/firestore/departments.ts
 * Purpose: Department data management
 */

export interface Department {
  id?: string;
  name: string;
  type?: 'predefined' | 'custom';
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  closingScheduleConfig?: {
    gapSlackWeeks: number;
    allowSingleReliefMin1: boolean;
    reliefMaxPerSchedule: number;
  };
  settings?: {
    maxWorkers?: number;
    shiftTypes?: string[];
  };
}

export const createDepartment = async (data: Omit<Department, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.DEPARTMENTS), {
      ...data,
      closingScheduleConfig: data.closingScheduleConfig || DEFAULT_CLOSING_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

export const getDepartment = async (departmentId: string): Promise<Department | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.DEPARTMENTS, departmentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Department;
    }
    return null;
  } catch (error) {
    console.error('Error getting department:', error);
    throw error;
  }
};

export const updateDepartment = async (departmentId: string, data: Partial<Department>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.DEPARTMENTS, departmentId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

export const deleteDepartment = async (departmentId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.DEPARTMENTS, departmentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
};

export const getDepartmentsByOwner = async (ownerId: string): Promise<Department[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.DEPARTMENTS),
      where('ownerId', '==', ownerId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Department[];
  } catch (error) {
    console.error('Error getting departments by owner:', error);
    throw error;
  }
};

/**
 * Get all departments
 * Used for displaying department options in signup form
 */
export const getAllDepartments = async (): Promise<Department[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.DEPARTMENTS));
    
    const departments = querySnapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data()
      } as Department;
    });
    
    return departments;
  } catch (error) {
    console.error('Error getting all departments:', error);
    throw error;
  }
};

/**
 * Find department by name (case-insensitive)
 * Used to check if a custom department name already exists
 */
export const getDepartmentByName = async (name: string): Promise<Department | null> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.DEPARTMENTS));
    
    // Search case-insensitive
    const normalizedSearchName = name.trim().toLowerCase();
    
    for (const doc of querySnapshot.docs) {
      const departmentData = doc.data();
      const normalizedDeptName = departmentData.name?.toLowerCase() || '';
      
      if (normalizedDeptName === normalizedSearchName) {
        return {
          id: doc.id,
          ...departmentData
        } as Department;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding department by name:', error);
    throw error;
  }
};

