/**
 * Authentication Helper Functions
 * 
 * This file contains all authentication-related functions for Firebase Auth
 * and Firestore user management.
 * 
 * Location: src/lib/auth/authHelpers.ts
 * Purpose: Centralized authentication logic
 */

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

/**
 * User data structure in Firestore
 */
export interface UserData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'developer' | 'owner' | 'admin' | 'worker';
  departmentId: string | null;
  departmentName: string;
  customDepartmentName?: string;
  status: 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'owner' | 'admin' | 'worker',
  departmentId: string,
  customDepartmentName?: string
): Promise<{ success: boolean; message: string; userId?: string }> {
  try {
    // Step 1: Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Step 2: Send email verification
    await sendEmailVerification(user);

    // Step 3: Determine department name
    let departmentName = '';
    if (departmentId === 'other' && customDepartmentName) {
      departmentName = customDepartmentName;
    } else {
      // Map department IDs to names
      const departmentNames: Record<string, string> = {
        'ground_support': 'שירותי קרקע',
        'logistics': 'לוגיסטיקה',
        'medical': 'מרפאה'
      };
      departmentName = departmentNames[departmentId] || customDepartmentName || 'אחר';
    }

    // Step 4: Create Firestore user document
    const userData: any = {
      userId: user.uid,
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role,
      departmentId: departmentId === 'other' ? null : departmentId,
      departmentName: departmentName,
      status: 'pending',
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Only add customDepartmentName if it exists (avoid undefined)
    if (departmentId === 'other' && customDepartmentName) {
      userData.customDepartmentName = customDepartmentName;
    }

    await setDoc(doc(db, 'users', user.uid), userData);

    // Step 5: Sign out immediately (user must verify email and get approved)
    await firebaseSignOut(auth);

    return {
      success: true,
      message: 'תודה על ההרשמה! שלב הבא:\n1️⃣ בדוק את האימייל שלך ולחץ על קישור האימות\n2️⃣ חזור לכאן ונסה להתחבר (כדי לעדכן את הסטטוס)\n3️⃣ המתן לאישור מנהל המערכת',
      userId: user.uid
    };

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle specific errors
    if (error.code === 'auth/email-already-in-use') {
      return {
        success: false,
        message: 'כתובת האימייל כבר קיימת במערכת'
      };
    }
    
    if (error.code === 'auth/weak-password') {
      return {
        success: false,
        message: 'הסיסמה חלשה מדי. יש להשתמש בסיסמה בת 8 תווים לפחות'
      };
    }
    
    if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        message: 'כתובת האימייל אינה תקינה'
      };
    }
    
    return {
      success: false,
      message: 'שגיאה בהרשמה. אנא נסה שוב'
    };
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ 
  success: boolean; 
  message: string; 
  user?: User;
  userData?: UserData;
  needsApproval?: boolean;
}> {
  try {
    // Step 1: Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Step 2: Get user data from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await firebaseSignOut(auth);
      return {
        success: false,
        message: 'משתמש לא נמצא במערכת'
      };
    }

    const userData = userDoc.data() as UserData;

    // Step 3: Sync emailVerified from Firebase Auth to Firestore
    // Firebase Auth updates emailVerified when user clicks verification link
    // We need to sync this to Firestore database
    if (user.emailVerified && !userData.emailVerified) {
      await setDoc(userDocRef, {
        emailVerified: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Update local userData object
      userData.emailVerified = true;
      
      console.log('✅ Email verification synced to Firestore');
    }

    // Step 4: Check if email is verified
    if (!user.emailVerified && userData.role !== 'developer') {
      await firebaseSignOut(auth);
      return {
        success: false,
        message: 'אנא אמת את כתובת האימייל שלך לפני ההתחברות',
        needsApproval: true
      };
    }

    // Step 5: Check user status
    if (userData.status === 'pending') {
      await firebaseSignOut(auth);
      return {
        success: false,
        message: '✅ האימייל שלך אומת בהצלחה!\n⏳ חשבונך ממתין לאישור מנהל המערכת.\n📧 תקבל הודעה כאשר החשבון יאושר.',
        needsApproval: true
      };
    }

    if (userData.status === 'rejected') {
      await firebaseSignOut(auth);
      return {
        success: false,
        message: 'חשבונך נדחה על ידי מנהל המערכת'
      };
    }

    // Step 6: Success - user is approved
    return {
      success: true,
      message: 'התחברת בהצלחה!',
      user: user,
      userData: userData
    };

  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle specific errors
    if (error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential') {
      return {
        success: false,
        message: 'אימייל או סיסמה שגויים'
      };
    }
    
    if (error.code === 'auth/too-many-requests') {
      return {
        success: false,
        message: 'יותר מדי ניסיונות התחברות. אנא נסה שוב מאוחר יותר'
      };
    }
    
    if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        message: 'כתובת אימייל לא תקינה'
      };
    }
    
    return {
      success: false,
      message: 'שגיאה בהתחברות. אנא נסה שוב'
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get current user data from Firestore
 */
export async function getCurrentUserData(userId: string): Promise<UserData | null> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return userDoc.data() as UserData;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Check if user needs approval
 */
export function userNeedsApproval(userData: UserData | null): boolean {
  if (!userData) return false;
  return userData.status === 'pending' || !userData.emailVerified;
}

/**
 * Get dashboard route based on user role
 */
export function getDashboardRoute(role: string): string {
  switch (role) {
    case 'developer':
      return '/developer';
    case 'owner':
      return '/owner';
    case 'admin':
      return '/admin';
    case 'worker':
      return '/worker';
    default:
      return '/dashboard';
  }
}

