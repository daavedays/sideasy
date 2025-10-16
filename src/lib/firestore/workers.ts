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
import { setWorkerClosingInterval } from './workersIndex';

// ============================================================================
// TYPES
// ============================================================================

export interface TaskEntry {
  taskName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  scheduleId?: string;  // Optional for backward compatibility with existing data
}

export interface WorkerData {
  workerId: string;
  firstName: string;
  lastName: string;
  email: string;
  unit: string;                  // Sub-department name
  role: 'owner' | 'admin' | 'worker';
  isOfficer: boolean;
  activity: 'active' | 'deleted' | 'inactive';
  qualifications: string[];
  closingInterval: number;         // singular per new schema
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;              // userId who last updated
}

export interface WorkerUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'owner' | 'admin' | 'worker';
  isOfficer?: boolean;
  activity?: 'active' | 'deleted' | 'inactive';
  qualifications?: string[];
  unit?: string;  // Sub-department field (editable by owner/admin)
  closingInterval?: number;   // New field (editable by owner/admin)
}

// ============================================================================
// WORKERS MAP DOC (departments/{departmentId}/workers/index)
// Replicates lightweight worker fields into a single map for cost-efficient reads
// ============================================================================

interface WorkerMapEntry {
  workerId: string;
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
  role: 'owner' | 'admin' | 'worker';
  isOfficer: boolean;
  activity: 'active' | 'deleted' | 'inactive';
  qualifications: string[];
  closingInterval: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

async function ensureWorkersMapDoc(departmentId: string): Promise<void> {
  const mapRef = doc(db, 'departments', departmentId, 'workers', 'index');
  const snap = await getDoc(mapRef);
  if (!snap.exists()) {
    await setDoc(mapRef, {
      workers: {},
      updatedAt: serverTimestamp() as Timestamp
    } as { workers: Record<string, WorkerMapEntry>; updatedAt: Timestamp });
  }
}

async function upsertWorkersMapEntry(
  departmentId: string,
  workerId: string,
  updates: Partial<WorkerMapEntry>
): Promise<void> {
  const mapRef = doc(db, 'departments', departmentId, 'workers', 'index');
  const snap = await getDoc(mapRef);
  if (!snap.exists()) {
    await ensureWorkersMapDoc(departmentId);
  }

  const current = (await getDoc(mapRef)).data() as { workers?: Record<string, WorkerMapEntry> } | undefined;
  const existing = current?.workers?.[workerId];

  const nextEntry: WorkerMapEntry = {
    workerId: existing?.workerId ?? workerId,
    firstName: updates.firstName ?? existing?.firstName ?? '',
    lastName: updates.lastName ?? existing?.lastName ?? '',
    email: updates.email ?? existing?.email ?? '',
    unit: updates.unit ?? existing?.unit ?? '',
    role: (updates.role as any) ?? existing?.role ?? 'worker',
    isOfficer: updates.isOfficer ?? existing?.isOfficer ?? false,
    activity: (updates.activity as any) ?? existing?.activity ?? 'active',
    qualifications: updates.qualifications ?? existing?.qualifications ?? [],
    closingInterval: updates.closingInterval ?? existing?.closingInterval ?? 0,
    createdAt: existing?.createdAt ?? (serverTimestamp() as Timestamp),
    updatedAt: serverTimestamp() as Timestamp
  };

  await updateDoc(mapRef, {
    [`workers.${workerId}`]: nextEntry,
    updatedAt: serverTimestamp()
  });
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
    // Initialize consolidated workers map entry (no per-worker doc creation)
    await upsertWorkersMapEntry(departmentId, workerId, {
      workerId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      unit: '',
      role: userData.role,
      isOfficer: false,
      activity: 'active',
      qualifications: [],
      closingInterval: 0
    } as Partial<WorkerMapEntry>);

    // Initialize closingInterval in workersIndex entry as well
    await setWorkerClosingInterval(departmentId, workerId, 0);

    // Create per-worker combined document under workers/index/byWorker/{workerId}
    // This document will store worker-specific assignments and preferences for efficient lookups
    const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
    await setDoc(
      byWorkerRef,
      {
        workerId,
        // identity & role context for convenience
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        role: userData.role,
        // mutable worker attributes defaults
        unit: '',
        isOfficer: false,
        activity: 'active',
        qualifications: [],
        closingInterval: 0,
        // assignment-related fields (worker-specific)
        primaryTasksMap: [], // Array<{ startDate: Timestamp; endDate: Timestamp; taskId: string; taskName: string; scheduleId?: string }>
        secondaryTaskDates: [], // Array<{ date: Timestamp; taskId: string }>
        preferences: [], // Array<{ date: Timestamp; taskId: string | null }>
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return {
      success: true,
      message: 'Worker initialized successfully'
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
  if (updates.unit !== undefined) workerOnlyFields.unit = updates.unit;
  if (updates.closingInterval !== undefined) workerOnlyFields.closingInterval = updates.closingInterval;

    // Add updatedAt timestamp to both
    const timestamp = serverTimestamp();
    syncedFields.updatedAt = timestamp;
    workerOnlyFields.updatedAt = timestamp;

    // Prepare updates
    const updatePromises: Promise<any>[] = [];

    // Only update users collection if synced fields changed
    // (Admins don't have permission to update users collection)
    if (Object.keys(syncedFields).length > 1) { // > 1 because updatedAt is always there
      updatePromises.push(updateDoc(userRef, syncedFields));
    }

    await Promise.all(updatePromises);

    // Mirror changes into consolidated workers map doc
    const mapUpdates: Partial<WorkerMapEntry> = {};
    if (updates.firstName !== undefined) mapUpdates.firstName = updates.firstName as any;
    if (updates.lastName !== undefined) mapUpdates.lastName = updates.lastName as any;
    if (updates.email !== undefined) mapUpdates.email = updates.email as any;
    if (updates.role !== undefined) mapUpdates.role = updates.role as any;
    if (updates.isOfficer !== undefined) mapUpdates.isOfficer = updates.isOfficer as any;
    if (updates.activity !== undefined) mapUpdates.activity = updates.activity as any;
    if (updates.qualifications !== undefined) mapUpdates.qualifications = updates.qualifications as any;
    if (updates.unit !== undefined) mapUpdates.unit = updates.unit as any;
    if (updates.closingInterval !== undefined) mapUpdates.closingInterval = updates.closingInterval as any;

    if (Object.keys(mapUpdates).length > 0) {
      await upsertWorkersMapEntry(departmentId, workerId, mapUpdates);
    }

    // Keep workersIndex.closingInterval in sync
    if (updates.closingInterval !== undefined) {
      await setWorkerClosingInterval(departmentId, workerId, updates.closingInterval);
    }

    // Sync qualifications into workersIndex for quick reads
    if (updates.qualifications !== undefined) {
      const { upsertWorkerIndexEntry } = await import('./workersIndex');
      await upsertWorkerIndexEntry(departmentId, workerId, { qualifications: updates.qualifications as any });
    }

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

    // Update user and department only (no per-worker doc writes)
    await Promise.all([
      updateDoc(userRef, { role: newRole, updatedAt: timestamp }),
      updateDoc(deptRef, countUpdates)
    ]);

    // Mirror role change in consolidated workers map
    await upsertWorkersMapEntry(departmentId, workerId, { role: newRole } as Partial<WorkerMapEntry>);

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
    const userRef = doc(db, 'users', workerId);
    const deptRef = doc(db, 'departments', departmentId);

    const timestamp = serverTimestamp();

    // Legacy: per-worker doc not updated anymore

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

    // Update users and department only (no per-worker doc writes)
    await Promise.all([
      updateDoc(userRef, userUpdates),
      updateDoc(deptRef, countUpdates)
    ]);

    // Mirror activity change in consolidated workers map
    await upsertWorkersMapEntry(departmentId, workerId, { activity: 'deleted' } as Partial<WorkerMapEntry>);

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

// ============================================================================
// WORKER PREFERENCES (byWorker) OPERATIONS
// ============================================================================

/**
 * Replace a worker's preferences in the byWorker document only.
 * Path: departments/{departmentId}/workers/index/byWorker/{workerId}
 */
export async function replaceWorkerPreferencesByWorker(
  departmentId: string,
  workerId: string,
  preferences: Array<{ date: Timestamp; taskId: string | null }>
): Promise<void> {
  const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
  await setDoc(
    byWorkerRef,
    {
      preferences: preferences || [],
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Merge preferences only within the provided date range. Outside the range remains unchanged.
 * For each date (day granularity), only a single entry is kept. If multiple entries exist for the
 * same date in the new set, priority is: blocked (taskId=null) > last specified.
 */
export async function setWorkerPreferencesByWorkerForRange(
  departmentId: string,
  workerId: string,
  rangeStart: Date,
  rangeEnd: Date,
  newPreferencesInRange: Array<{ date: Timestamp; taskId: string | null; status: 'preferred' | 'blocked' }>
): Promise<void> {
  const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
  const snap = await getDoc(byWorkerRef);
  const existing = (snap.exists() ? (snap.data() as any).preferences : []) || [];

  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);

  const isInRange = (ts: Timestamp) => {
    const d = ts.toDate();
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  };

  // Preserve existing entries outside range
  const preserved: Array<{ date: Timestamp; taskId: string | null; status?: 'preferred' | 'blocked' }> = (existing as any[]).filter((p) => !isInRange(p.date));

  // Deduplicate new entries by date (keep blocked if any for that date)
  // Deduplicate by (day, taskId) where taskId may be null for legacy blocked-day entries
  type Pref = { date: Timestamp; taskId: string | null; status: 'preferred' | 'blocked' };
  const byKey = new Map<string, Pref>();
  for (const p of newPreferencesInRange || []) {
    const day = p.date.toDate();
    day.setHours(0, 0, 0, 0);
    const key = `${day.getTime()}|${p.taskId ?? 'NULL'}`;
    const existingForKey = byKey.get(key);
    if (!existingForKey) {
      byKey.set(key, p);
    } else {
      // If any entry for this (date,task) is blocked, keep blocked; else keep latest
      const blocked = existingForKey.status === 'blocked' || p.status === 'blocked';
      byKey.set(key, { date: p.date, taskId: p.taskId ?? null, status: blocked ? 'blocked' : 'preferred' });
    }
  }

  const merged = [...preserved, ...Array.from(byKey.values())];

  await setDoc(
    byWorkerRef,
    {
      preferences: merged,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

