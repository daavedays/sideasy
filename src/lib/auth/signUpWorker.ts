import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { COLLECTIONS, USER_ROLES, USER_STATUS } from '../../config/appConfig';

/**
 * Sign Up Worker
 * 
 * Creates a new worker account within a department.
 * Worker accounts require approval from owner/admin.
 * 
 * Location: src/lib/auth/signUpWorker.ts
 * Purpose: Worker registration logic
 */

interface WorkerSignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  qualificationLevel?: number;
}

export const signUpWorker = async (data: WorkerSignUpData): Promise<string> => {
  const { email, password, firstName, lastName, departmentId, qualificationLevel = 1 } = data;

  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Create user document with pending status
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, {
      email,
      firstName,
      lastName,
      role: USER_ROLES.WORKER,
      status: USER_STATUS.PENDING, // Workers need approval
      departmentId,
      qualificationLevel,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return userId;
  } catch (error) {
    console.error('Error signing up worker:', error);
    throw error;
  }
};

export default signUpWorker;

