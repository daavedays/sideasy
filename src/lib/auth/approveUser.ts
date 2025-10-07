import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS, USER_STATUS } from '../../config/appConfig';

/**
 * Approve User
 * 
 * Approves a pending user (typically a worker).
 * Only owners and admins can approve users.
 * 
 * Location: src/lib/auth/approveUser.ts
 * Purpose: User approval logic
 */

export const approveUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      status: USER_STATUS.APPROVED,
      approvedAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
};

export const rejectUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      status: USER_STATUS.REJECTED,
      rejectedAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error rejecting user:', error);
    throw error;
  }
};

export const suspendUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      status: USER_STATUS.SUSPENDED,
      suspendedAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

export default approveUser;

