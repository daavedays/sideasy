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
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { UserData } from './authHelpers';

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
      status: 'approved',
      approvedBy: approverId,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Step 2: Handle custom department creation
    let finalDepartmentId = userData.departmentId;
    
    if (!userData.departmentId && userData.customDepartmentName && userData.role === 'owner') {
      // Create new custom department
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
      
      // Update user with the new department ID
      await updateDoc(userRef, {
        departmentId: finalDepartmentId,
        departmentName: userData.customDepartmentName
      });
    } 
    // Step 3: If owner of predefined department, update department ownerId
    else if (userData.role === 'owner' && userData.departmentId) {
      const departmentRef = doc(db, 'departments', userData.departmentId);
      await updateDoc(departmentRef, {
        ownerId: userId,
        ownerName: `${userData.firstName} ${userData.lastName}`,
        ownerEmail: userData.email,
        updatedAt: serverTimestamp()
      });
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

