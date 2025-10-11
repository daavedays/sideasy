/**
 * Workers Collection Firestore Operations
 * 
 * Handles all CRUD operations for the workers collection with automatic
 * synchronization to the users collection.
 * 
 * ⚠️ CRITICAL: All changes to synced fields MUST update both collections!
 * Synced fields: firstName, lastName, email, role, isOfficer, activity
 * Worker-only fields: qualifications, מחלקה (sub-department), preferences, tasks, statistics
 * 
 * Location: src/lib/firestore/workers.ts
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkerData {
  workerId: string;
  firstName: string;
  lastName: string;
  email: string;
  מחלקה: string;                  // Department name in Hebrew
  role: 'owner' | 'admin' | 'worker';
  isOfficer: boolean;
  activity: 'active' | 'deleted' | 'inactive';
  score: number;
  lastClosingDate: Timestamp | null;
  mandatoryClosingDates: Timestamp[];
  qualifications: string[];
  closingIntervals: number;
  preferences: {
    date: Timestamp;
    task: string | null;
  }[];
  assignedMainTasks: string[];
  assignedSecondaryTasks: string[];
  completedMainTasks: string[];
  completedSecondaryTasks: string[];
  statistics: {
    totalMainTasks: number;
    totalSecondaryTasks: number;
    lastShiftDate: Timestamp | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkerUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'owner' | 'admin' | 'worker';
  isOfficer?: boolean;
  activity?: 'active' | 'deleted' | 'inactive';
  qualifications?: string[];
  מחלקה?: string;  // Sub-department field (editable by owner/admin)
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get a single worker by ID
 */
export async function getWorker(
  departmentId: string,
  workerId: string
): Promise<WorkerData | null> {
  try {
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const workerSnap = await getDoc(workerRef);

    if (workerSnap.exists()) {
      return workerSnap.data() as WorkerData;
    }

    return null;
  } catch (error) {
    console.error('Error getting worker:', error);
    throw error;
  }
}

/**
 * Get all workers in a department
 */
export async function getAllWorkers(
  departmentId: string
): Promise<WorkerData[]> {
  try {
    const workersRef = collection(db, 'departments', departmentId, 'workers');
    const snapshot = await getDocs(workersRef);

    const workers: WorkerData[] = [];
    snapshot.forEach((doc) => {
      workers.push(doc.data() as WorkerData);
    });

    return workers;
  } catch (error) {
    console.error('Error getting all workers:', error);
    throw error;
  }
}

/**
 * Get workers by role (owner, admin, or worker)
 */
export async function getWorkersByRole(
  departmentId: string,
  role: 'owner' | 'admin' | 'worker'
): Promise<WorkerData[]> {
  try {
    const workersRef = collection(db, 'departments', departmentId, 'workers');
    const q = query(workersRef, where('role', '==', role));
    const snapshot = await getDocs(q);

    const workers: WorkerData[] = [];
    snapshot.forEach((doc) => {
      workers.push(doc.data() as WorkerData);
    });

    return workers;
  } catch (error) {
    console.error('Error getting workers by role:', error);
    throw error;
  }
}

/**
 * Get all active workers (excluding deleted)
 */
export async function getActiveWorkers(
  departmentId: string
): Promise<WorkerData[]> {
  try {
    const workersRef = collection(db, 'departments', departmentId, 'workers');
    const q = query(workersRef, where('activity', '==', 'active'));
    const snapshot = await getDocs(q);

    const workers: WorkerData[] = [];
    snapshot.forEach((doc) => {
      workers.push(doc.data() as WorkerData);
    });

    return workers;
  } catch (error) {
    console.error('Error getting active workers:', error);
    throw error;
  }
}

// ============================================================================
// CREATE OPERATION
// ============================================================================

/**
 * Create a new worker document (called during user approval)
 * 
 * NOTE: This creates an empty worker document with synced fields from users collection.
 * It does NOT update the users collection (that's handled by approvalHelpers).
 */
export async function createWorkerDocument(
  departmentId: string,
  workerId: string,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    role: 'owner' | 'admin' | 'worker';
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);

    // Check if worker already exists
    const existingWorker = await getDoc(workerRef);
    if (existingWorker.exists()) {
      return {
        success: false,
        message: 'Worker document already exists'
      };
    }

    // Create initial worker document
    const workerData: Partial<WorkerData> = {
      workerId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      מחלקה: '',  // Sub-department (empty by default, editable by owner/admin)
      role: userData.role,
      isOfficer: false,
      activity: 'active',
      score: 0,
      lastClosingDate: null,
      mandatoryClosingDates: [],
      qualifications: [],
      closingIntervals: 0,
      preferences: [],
      assignedMainTasks: [],
      assignedSecondaryTasks: [],
      completedMainTasks: [],
      completedSecondaryTasks: [],
      statistics: {
        totalMainTasks: 0,
        totalSecondaryTasks: 0,
        lastShiftDate: null
      },
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    await setDoc(workerRef, workerData);

    return {
      success: true,
      message: 'Worker document created successfully'
    };
  } catch (error: any) {
    console.error('Error creating worker document:', error);
    return {
      success: false,
      message: error.message || 'Failed to create worker document'
    };
  }
}

// ============================================================================
// UPDATE OPERATIONS (WITH SYNC)
// ============================================================================

/**
 * Update worker data with automatic sync to users collection
 * 
 * ⚠️ CRITICAL: Synced fields (firstName, lastName, email, role, isOfficer, activity)
 * will be updated in BOTH collections automatically.
 * 
 * NOTE: Admins can only update worker-only fields (qualifications, מחלקה).
 * Synced fields can only be updated by owners.
 */
export async function updateWorkerWithSync(
  departmentId: string,
  workerId: string,
  updates: WorkerUpdateData
): Promise<{ success: boolean; message: string }> {
  try {
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const userRef = doc(db, 'users', workerId);

    // Separate synced fields from worker-only fields
    const syncedFields: any = {};
    const workerOnlyFields: any = {};

    // Synced fields
    if (updates.firstName !== undefined) syncedFields.firstName = updates.firstName;
    if (updates.lastName !== undefined) syncedFields.lastName = updates.lastName;
    if (updates.email !== undefined) syncedFields.email = updates.email;
    if (updates.role !== undefined) syncedFields.role = updates.role;
    if (updates.isOfficer !== undefined) syncedFields.isOfficer = updates.isOfficer;
    if (updates.activity !== undefined) syncedFields.activity = updates.activity;

    // Worker-only fields
    if (updates.qualifications !== undefined) workerOnlyFields.qualifications = updates.qualifications;
    if (updates.מחלקה !== undefined) workerOnlyFields.מחלקה = updates.מחלקה;

    // Add updatedAt timestamp to both
    const timestamp = serverTimestamp();
    syncedFields.updatedAt = timestamp;
    workerOnlyFields.updatedAt = timestamp;

    // Prepare updates
    const updatePromises = [];

    // Always update workers collection (with all fields that changed)
    const workerUpdates = { ...workerOnlyFields };
    
    // Only add synced fields to worker updates if they exist
    if (Object.keys(syncedFields).length > 1) { // > 1 because updatedAt is always there
      Object.assign(workerUpdates, syncedFields);
    } else {
      // If no synced fields, still need updatedAt
      workerUpdates.updatedAt = timestamp;
    }
    
    updatePromises.push(updateDoc(workerRef, workerUpdates));

    // Only update users collection if synced fields changed
    // (Admins don't have permission to update users collection)
    if (Object.keys(syncedFields).length > 1) { // > 1 because updatedAt is always there
      updatePromises.push(updateDoc(userRef, syncedFields));
    }

    await Promise.all(updatePromises);

    return {
      success: true,
      message: 'Worker updated successfully'
    };
  } catch (error: any) {
    console.error('Error updating worker:', error);
    return {
      success: false,
      message: error.message || 'Failed to update worker'
    };
  }
}

/**
 * Change worker role (worker ↔ admin) with department count updates
 * 
 * ⚠️ CRITICAL: Updates both collections + department counts
 */
export async function changeWorkerRole(
  departmentId: string,
  workerId: string,
  newRole: 'admin' | 'worker',
  currentRole: 'admin' | 'worker' | 'owner'
): Promise<{ success: boolean; message: string }> {
  try {
    // Can't change to/from owner role
    if (currentRole === 'owner') {
      return {
        success: false,
        message: 'Cannot change owner role'
      };
    }

    // No change needed
    if (newRole === currentRole) {
      return {
        success: true,
        message: 'No role change needed'
      };
    }

    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const userRef = doc(db, 'users', workerId);
    const deptRef = doc(db, 'departments', departmentId);

    const timestamp = serverTimestamp();

    // Determine count changes
    const countUpdates: any = {};
    if (newRole === 'admin') {
      // worker → admin
      countUpdates.adminCount = increment(1);
      countUpdates.workerCount = increment(-1);
    } else {
      // admin → worker
      countUpdates.adminCount = increment(-1);
      countUpdates.workerCount = increment(1);
    }
    countUpdates.updatedAt = timestamp;

    // Update all three documents
    await Promise.all([
      updateDoc(workerRef, { role: newRole, updatedAt: timestamp }),
      updateDoc(userRef, { role: newRole, updatedAt: timestamp }),
      updateDoc(deptRef, countUpdates)
    ]);

    return {
      success: true,
      message: `Role changed from ${currentRole} to ${newRole}`
    };
  } catch (error: any) {
    console.error('Error changing worker role:', error);
    return {
      success: false,
      message: error.message || 'Failed to change role'
    };
  }
}

// ============================================================================
// SOFT DELETE OPERATION
// ============================================================================

/**
 * Soft delete a worker (sets activity to "deleted")
 * 
 * ⚠️ CRITICAL: Updates both collections + department counts
 * Does NOT delete from Firebase Auth (requires backend/Cloud Function)
 */
export async function softDeleteWorker(
  departmentId: string,
  workerId: string,
  workerRole: 'owner' | 'admin' | 'worker'
): Promise<{ success: boolean; message: string }> {
  try {
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const userRef = doc(db, 'users', workerId);
    const deptRef = doc(db, 'departments', departmentId);

    const timestamp = serverTimestamp();

    // Update workers collection
    const workerUpdates = {
      activity: 'deleted',
      updatedAt: timestamp
    };

    // Update users collection
    const userUpdates = {
      activity: 'deleted',
      status: 'rejected',
      updatedAt: timestamp
    };

    // Update department counts
    const countUpdates: any = { updatedAt: timestamp };
    if (workerRole === 'admin') {
      countUpdates.adminCount = increment(-1);
    } else if (workerRole === 'worker') {
      countUpdates.workerCount = increment(-1);
    }
    // Owner count is not tracked separately (assumed to be 1)

    // Update all documents
    await Promise.all([
      updateDoc(workerRef, workerUpdates),
      updateDoc(userRef, userUpdates),
      updateDoc(deptRef, countUpdates)
    ]);

    // TODO: Remove from future schedules (when schedules are implemented)

    return {
      success: true,
      message: 'User soft-deleted successfully'
    };
  } catch (error: any) {
    console.error('Error soft-deleting worker:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete worker'
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a user can be promoted/demoted
 */
export function canChangeRole(
  currentUserRole: string,
  targetUserRole: string
): boolean {
  // Developers can change anyone (handled elsewhere)
  if (currentUserRole === 'developer') return true;

  // Owners can change admins and workers
  if (currentUserRole === 'owner') {
    return targetUserRole === 'admin' || targetUserRole === 'worker';
  }

  // Admins cannot change roles
  if (currentUserRole === 'admin') return false;

  return false;
}

/**
 * Check if a user can delete another user
 */
export function canDeleteUser(
  currentUserRole: string,
  targetUserRole: string
): boolean {
  // Developers can delete anyone (handled elsewhere)
  if (currentUserRole === 'developer') return true;

  // Owners can delete admins and workers (not other owners)
  if (currentUserRole === 'owner') {
    return targetUserRole === 'admin' || targetUserRole === 'worker';
  }

  // Admins cannot delete users
  if (currentUserRole === 'admin') return false;

  return false;
}

