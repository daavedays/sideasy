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
 * byWorker mirror: identity and role context (firstName, lastName, email, role, isOfficer, activity)
 * are mirrored for convenience and MUST remain consistent with users + workers map.
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
import { refreshSummaryForWorker } from './statistics';

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
  score: number;
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
    score: (updates as any).score ?? (existing as any)?.score ?? 0,
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
      closingInterval: 0,
      // initialize default performance score
      score: 0 as any
    } as Partial<WorkerMapEntry>);

    

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
        // default performance score for new workers
        score: 0,
        // worker-editable field
        preferences: [], // Array<{ date: Timestamp; taskId: string | null }>
        // statistics-related fields (admin-written)
        closingHistory: [], // Array<{ friday: Timestamp; source: 'primary'|'secondary'; scheduleId: string }>
        futureClosings: [], // Array<{ friday: Timestamp; source: 'primary'|'secondary'; scheduleId: string }>
        actualClosingInterval: 0, // rolling average interval in weeks
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

    // Mirror identity/role fields and worker-only fields into the quick-access byWorker document
    const hasAnySyncedChanges =
      updates.firstName !== undefined ||
      updates.lastName !== undefined ||
      updates.email !== undefined ||
      updates.role !== undefined ||
      updates.isOfficer !== undefined ||
      updates.activity !== undefined;

    const hasWorkerOnlyChanges =
      updates.qualifications !== undefined ||
      updates.unit !== undefined ||
      updates.closingInterval !== undefined;

    if (hasAnySyncedChanges || hasWorkerOnlyChanges) {
      const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
      const byWorkerPayload: any = { updatedAt: timestamp };

      // Synced fields mirrored for convenience
      if (updates.firstName !== undefined) byWorkerPayload.firstName = updates.firstName;
      if (updates.lastName !== undefined) byWorkerPayload.lastName = updates.lastName;
      if (updates.email !== undefined) byWorkerPayload.email = updates.email;
      if (updates.role !== undefined) byWorkerPayload.role = updates.role;
      if (updates.isOfficer !== undefined) byWorkerPayload.isOfficer = updates.isOfficer;
      if (updates.activity !== undefined) byWorkerPayload.activity = updates.activity;

      // Worker-only fields
      if (updates.qualifications !== undefined) byWorkerPayload.qualifications = updates.qualifications;
      if (updates.unit !== undefined) byWorkerPayload.unit = updates.unit;
      if (updates.closingInterval !== undefined) byWorkerPayload.closingInterval = updates.closingInterval;

      await setDoc(byWorkerRef, byWorkerPayload, { merge: true });
      // Keep statistics summary in sync for this worker (non-blocking)
      try { await refreshSummaryForWorker(departmentId, workerId); } catch {}
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
    const userRef = doc(db, 'users', workerId);
    const deptRef = doc(db, 'departments', departmentId);

    // Guard: cannot change owner role via this function
    if (currentRole === 'owner') {
      return { success: false, message: 'Cannot change owner role' };
    }

    // No change needed
    if (newRole === currentRole) {
      return { success: true, message: 'No role change needed' };
    }

    const timestamp = serverTimestamp();

    // Determine count changes
    const countUpdates: any = {};
    if (newRole === 'admin' && currentRole === 'worker') {
      // worker → admin
      countUpdates.adminCount = increment(1);
      countUpdates.workerCount = increment(-1);
    } else if (newRole === 'worker' && currentRole === 'admin') {
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

    // Mirror role change in byWorker document
    {
      const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
      await setDoc(byWorkerRef, { role: newRole, updatedAt: timestamp }, { merge: true });
    }

  // Update statistics summary for this worker (role/name may affect views)
  try { await refreshSummaryForWorker(departmentId, workerId); } catch {}

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

    // Mirror activity change in byWorker document
    {
      const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
      await setDoc(byWorkerRef, { activity: 'deleted', updatedAt: timestamp }, { merge: true });
    }

  // Update statistics summary for this worker (activity affects totals/UI)
  try { await refreshSummaryForWorker(departmentId, workerId); } catch {}

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

// ==========================================================================
// LEDGER MAINTENANCE (RE-BUCKET CLOSINGS HISTORY/FUTURE)
// ==========================================================================

/**
 * Re-bucket a worker's closing ledger by current time, pruning and
 * recomputing actualClosingInterval. Writes only if there is any stale
 * entry (future item in the past) or ordering/pruning changes.
 *
 * Used by background sweeps to keep data fresh without relying on saves.
 */
export async function rebucketWorkerLedgerIfStale(
  departmentId: string,
  workerId: string
): Promise<{ updated: boolean }> {
  const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId);
  const snap = await getDoc(byWorkerRef);
  if (!snap.exists()) return { updated: false };

  type ClosingEntry = { friday: Timestamp; source: 'primary'|'secondary'; scheduleId: string };
  const data = (snap.data() as any) || {};
  const existingHistory: ClosingEntry[] = Array.isArray(data.closingHistory) ? data.closingHistory : [];
  const existingFuture: ClosingEntry[] = Array.isArray(data.futureClosings) ? data.futureClosings : [];

  // If nothing in ledger, nothing to do
  if (existingHistory.length === 0 && existingFuture.length === 0) {
    return { updated: false };
  }

  const nowNoon = new Date();
  nowNoon.setHours(12, 0, 0, 0);

  // Classify all entries by current time
  const allEntries: ClosingEntry[] = [...existingHistory, ...existingFuture].filter(Boolean);
  let newHistory: ClosingEntry[] = [];
  let newFuture: ClosingEntry[] = [];
  for (const e of allEntries) {
    const d = (e.friday as Timestamp).toDate();
    if (d < nowNoon) newHistory.push(e); else newFuture.push(e);
  }

  // Sort
  newHistory = newHistory.sort((a, b) => a.friday.toMillis() - b.friday.toMillis());
  newFuture = newFuture.sort((a, b) => a.friday.toMillis() - b.friday.toMillis());

  // Prune
  const HISTORY_CAP = 150;
  if (newHistory.length > HISTORY_CAP) {
    newHistory = newHistory.slice(newHistory.length - HISTORY_CAP);
  }
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const horizon = new Date(nowNoon.getTime() + ONE_YEAR_MS);
  newFuture = newFuture.filter((e) => e.friday.toDate() <= horizon);

  // Compute actualClosingInterval (weeks) from history
  let actualIntervalWeeks = 0;
  if (newHistory.length >= 2) {
    let sum = 0; let gaps = 0;
    for (let i = 1; i < newHistory.length; i++) {
      const prev = newHistory[i - 1].friday.toDate();
      const cur = newHistory[i].friday.toDate();
      const diffDays = Math.floor((cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
      sum += diffDays / 7; gaps += 1;
    }
    actualIntervalWeeks = Math.round(sum / Math.max(1, gaps));
  }

  // Derive lastClosingDate as the latest history Friday (if any)
  const lastClosingDate: Timestamp | null = newHistory.length > 0
    ? newHistory[newHistory.length - 1].friday
    : (data.lastClosingDate || null);

  // Detect if an update is required
  const sameLength = newHistory.length === existingHistory.length && newFuture.length === existingFuture.length;
  const sameOrder = sameLength
    && newHistory.every((e, i) => existingHistory[i]?.friday?.toMillis?.() === e.friday.toMillis() && existingHistory[i]?.scheduleId === e.scheduleId && existingHistory[i]?.source === e.source)
    && newFuture.every((e, i) => existingFuture[i]?.friday?.toMillis?.() === e.friday.toMillis() && existingFuture[i]?.scheduleId === e.scheduleId && existingFuture[i]?.source === e.source);

  const intervalUnchanged = (typeof data.actualClosingInterval === 'number' ? data.actualClosingInterval : null) === actualIntervalWeeks;
  const lastClosingUnchanged = (data.lastClosingDate?.toMillis?.() ?? null) === (lastClosingDate?.toMillis?.() ?? null);

  const needsWrite = !(sameOrder && intervalUnchanged && lastClosingUnchanged);
  if (!needsWrite) return { updated: false };

  await setDoc(byWorkerRef, {
    closingHistory: newHistory,
    futureClosings: newFuture,
    actualClosingInterval: actualIntervalWeeks,
    lastClosingDate: lastClosingDate ?? null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return { updated: true };
}

