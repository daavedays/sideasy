import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { COLLECTIONS, USER_ROLES, USER_STATUS } from '../../config/appConfig';

/**
 * Sign Up Owner
 * 
 * Creates a new owner account with a department.
 * Automatically approves owner accounts.
 * 
 * Location: src/lib/auth/signUpOwner.ts
 * Purpose: Owner registration logic
 */

interface OwnerSignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentName: string;
}

export const signUpOwner = async (data: OwnerSignUpData): Promise<string> => {
  const { email, password, firstName, lastName, departmentName } = data;

  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Create department document
    const departmentRef = doc(db, COLLECTIONS.DEPARTMENTS, `dept_${userId}`);
    await setDoc(departmentRef, {
      name: departmentName,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxWorkers: 100,
        shiftTypes: ['morning', 'afternoon', 'evening', 'night']
      }
    });

    // Create user document
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, {
      email,
      firstName,
      lastName,
      role: USER_ROLES.OWNER,
      status: USER_STATUS.APPROVED, // Owners are auto-approved
      departmentId: departmentRef.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return userId;
  } catch (error) {
    console.error('Error signing up owner:', error);
    throw error;
  }
};

export default signUpOwner;

