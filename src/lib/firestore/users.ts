import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS, UserRole, UserStatus } from '../../config/appConfig';

/**
 * User Operations
 * 
 * Firestore CRUD operations for users.
 * Handles user data management and queries.
 * 
 * Location: src/lib/firestore/users.ts
 * Purpose: User data management
 */

export interface User {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  departmentId?: string;
  qualificationLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

export const updateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const getUsersByDepartment = async (departmentId: string): Promise<User[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('departmentId', '==', departmentId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  } catch (error) {
    console.error('Error getting users by department:', error);
    throw error;
  }
};

export const getPendingUsers = async (departmentId: string): Promise<User[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('departmentId', '==', departmentId),
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  } catch (error) {
    console.error('Error getting pending users:', error);
    throw error;
  }
};

