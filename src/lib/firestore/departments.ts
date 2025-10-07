import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/appConfig';

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
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    maxWorkers?: number;
    shiftTypes?: string[];
  };
}

export const createDepartment = async (data: Omit<Department, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.DEPARTMENTS), {
      ...data,
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

