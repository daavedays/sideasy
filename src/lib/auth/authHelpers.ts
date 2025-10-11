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
import { DEPARTMENT_IDS } from '../../config/departmentIds';

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
  activity: 'active' | 'deleted' | 'inactive';
  isOfficer: boolean;
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

    // Step 3: Map department keys to actual Firestore IDs and names
    let finalDepartmentId: string | null = null;
    let departmentName = '';
    
    if (departmentId === 'other' && customDepartmentName) {
      // Custom department - will be created after approval
      finalDepartmentId = null;
      departmentName = customDepartmentName;
    } else {
      // Map string keys to actual Firestore IDs
      const departmentKeyToId: Record<string, string> = {
        'ground_support': DEPARTMENT_IDS.GROUND_SUPPORT,
        'logistics': DEPARTMENT_IDS.LOGISTICS,
        'medical': DEPARTMENT_IDS.MEDICAL
      };
      
      // Map department IDs to names
      const departmentNames: Record<string, string> = {
        'ground_support': 'שירותי קרקע',
        'logistics': 'לוגיסטיקה',
        'medical': 'מרפאה'
      };
      
      finalDepartmentId = departmentKeyToId[departmentId] || null;
      departmentName = departmentNames[departmentId] || customDepartmentName || 'אחר';
    }

    // Step 4: Create Firestore user document
    const userData: any = {
      userId: user.uid,
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role,
      departmentId: finalDepartmentId,
      departmentName: departmentName,
      status: 'pending',
      emailVerified: false,
      activity: 'active',       // Default: active
      isOfficer: false,         // Default: not an officer
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
      message: '✅ ההרשמה הושלמה בהצלחה!\n\n📋 השלבים הבאים:\n1️⃣ בדוק את תיבת האימייל שלך\n2️⃣ לחץ על קישור האימות\n3️⃣ חזור לאתר ונסה להתחבר (חשוב! כדי להשלים את התהליך)\n4️⃣ המתן לאישור מנהל המערכת\n\n💡 תקבל הודעה כאשר החשבון יאושר',
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
    // Check BOTH Firebase Auth AND Firestore (admin might manually verify in Firestore)
    const isEmailVerified = user.emailVerified || userData.emailVerified;
    
    if (!isEmailVerified && userData.role !== 'developer') {
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
        message: '✅ מעולה! האימות הושלם בהצלחה\n\n⏳ חשבונך כעת ממתין לאישור מנהל המערכת\n\n📧 תקבל אישור בהקדם האפשרי\n\n💡 תוכל להתחבר מיד לאחר קבלת האישור',
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

    // Step 5.5: Check if user is deleted (soft delete)
    if (userData.activity === 'deleted') {
      await firebaseSignOut(auth);
      return {
        success: false,
        message: 'חשבון זה הוסר מהמערכת. נא ליצור קשר עם מנהל המחלקה.'
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

