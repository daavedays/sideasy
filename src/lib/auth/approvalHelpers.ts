/**
 * User Approval Helper Functions
 * 
 * Functions for approving and rejecting pending users.
 * 
 * Location: src/lib/auth/approvalHelpers.ts
 * Purpose: User approval/rejection logic
 */

import { 
  doc, 
  updateDoc, 
  setDoc,
  getDoc,
  collection,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { UserData } from './authHelpers';
import { initializeDepartmentCollections } from '../firestore/initializeDepartment';
import { createWorkerDocument } from '../firestore/workers';
import { ensureWorkersIndex, upsertWorkerIndexEntry } from '../firestore/workersIndex';

/**
 * Approve a user
 */
export async function approveUser(
  userId: string,
  userData: UserData,
  approverId: string
): Promise<{ success: boolean; message: string; departmentId?: string }> {
  try {
    // Step 1: Update user status to approved
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      userId: userId,  // ✅ CRITICAL: Ensure userId field is set
      status: 'approved',
      approvedBy: approverId,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Step 2: Handle department logic based on role
    let finalDepartmentId = userData.departmentId;
    
    if (userData.role === 'owner') {
      // Owner of custom department (departmentId is null, customDepartmentName exists)
      if (!userData.departmentId && userData.customDepartmentName) {
        // Create new custom department with auto-generated ID
        const departmentRef = doc(collection(db, 'departments'));
        finalDepartmentId = departmentRef.id;
        
        const departmentData = {
          departmentId: finalDepartmentId,
          name: userData.customDepartmentName,
          type: 'custom',
          ownerId: userId,
          ownerName: `${userData.firstName} ${userData.lastName}`,
          ownerEmail: userData.email,
          adminCount: 0,
          workerCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: approverId
        };
        
        await setDoc(departmentRef, departmentData);
        
        // Initialize ALL collections for the new department
        await initializeDepartmentCollections(finalDepartmentId);
        
        // Update user with the new department ID
        await updateDoc(userRef, {
          departmentId: finalDepartmentId,
          departmentName: userData.customDepartmentName
        });
      } 
      // Owner of predefined department (departmentId exists)
      else if (userData.departmentId) {
        const departmentRef = doc(db, 'departments', userData.departmentId);
        
        // Get existing department data
        const departmentSnap = await getDoc(departmentRef);
        
        if (!departmentSnap.exists()) {
          // This shouldn't happen for predefined departments
          console.error('Predefined department not found:', userData.departmentId);
          throw new Error('מחלקה לא נמצאה במערכת');
        }
        
        // Update existing department with owner info (don't overwrite, just add owner)
        await updateDoc(departmentRef, {
          ownerId: userId,
          ownerName: `${userData.firstName} ${userData.lastName}`,
          ownerEmail: userData.email,
          updatedAt: serverTimestamp()
        });
      }
    }
    // Step 3: If admin or worker, increment department counts
    else if ((userData.role === 'admin' || userData.role === 'worker') && userData.departmentId) {
      const departmentRef = doc(db, 'departments', userData.departmentId);
      
      // Check if department exists
      const departmentSnap = await getDoc(departmentRef);
      if (departmentSnap.exists()) {
        // Increment the appropriate count
        const updateData: any = {
          updatedAt: serverTimestamp()
        };
        
        if (userData.role === 'admin') {
          updateData.adminCount = increment(1);
        } else if (userData.role === 'worker') {
          updateData.workerCount = increment(1);
        }
        
        await updateDoc(departmentRef, updateData);
      }
    }

    // Step 4: Create worker document for the approved user (minimal schema)
    // Workers collection includes: owner, admin, and worker roles
    if (finalDepartmentId) {
      const workerResult = await createWorkerDocument(
        finalDepartmentId,
        userId,
        {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          role: userData.role as 'owner' | 'admin' | 'worker'
        }
      );

      if (!workerResult.success) {
        console.warn('Failed to create worker document:', workerResult.message);
        // Don't fail the approval if worker doc creation fails
      }

      // Step 5: Ensure workersIndex exists and upsert initial entry for this worker
      try {
        await ensureWorkersIndex(finalDepartmentId);
        await upsertWorkerIndexEntry(finalDepartmentId, userId, {
          lastClosingDate: null,
          primaryTasksMap: [],
          optimalClosingDates: [],
          preferences: [],
          score: 0
        });
      } catch (indexError) {
        console.warn('Failed to initialize workersIndex entry:', indexError);
        // Non-fatal; index can be rebuilt lazily
      }
    }

    return {
      success: true,
      message: 'המשתמש אושר בהצלחה',
      departmentId: finalDepartmentId || undefined
    };

  } catch (error: any) {
    console.error('Approval error:', error);
    return {
      success: false,
      message: 'שגיאה באישור המשתמש'
    };
  }
}

/**
 * Reject a user
 */
export async function rejectUser(
  userId: string,
  rejecterId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Update user status to rejected
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'rejected',
      rejectedBy: rejecterId,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      success: true,
      message: 'המשתמש נדחה בהצלחה'
    };

  } catch (error: any) {
    console.error('Rejection error:', error);
    return {
      success: false,
      message: 'שגיאה בדחיית המשתמש'
    };
  }
}

/**
 * Get pending users count by role
 */
export function getPendingCountByRole(users: UserData[]): {
  owners: number;
  admins: number;
  workers: number;
  total: number;
} {
  const counts = {
    owners: 0,
    admins: 0,
    workers: 0,
    total: 0
  };

  users.forEach(user => {
    if (user.status === 'pending') {
      counts.total++;
      if (user.role === 'owner') counts.owners++;
      else if (user.role === 'admin') counts.admins++;
      else if (user.role === 'worker') counts.workers++;
    }
  });

  return counts;
}

