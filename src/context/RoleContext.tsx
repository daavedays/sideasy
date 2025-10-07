import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthContext } from './AuthContext';
import { COLLECTIONS, UserRole, UserStatus } from '../config/appConfig';

/**
 * Role Context
 * 
 * Manages user role and permissions throughout the app.
 * Listens to Firestore for real-time role updates.
 * 
 * Location: src/context/RoleContext.tsx
 * Purpose: Role-based access control state management
 */

interface UserData {
  role: UserRole;
  status: UserStatus;
  departmentId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface RoleContextType {
  userRole: UserRole | null;
  userStatus: UserStatus | null;
  userData: UserData | null;
  loading: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  isApproved: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRoleContext = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used within RoleProvider');
  }
  return context;
};

interface RoleProviderProps {
  children: ReactNode;
}

export const RoleProvider: React.FC<RoleProviderProps> = ({ children }) => {
  const { currentUser } = useAuthContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      setLoading(false);
      return;
    }

    // Listen to user document for real-time role updates
    const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserData);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const value: RoleContextType = {
    userRole: userData?.role || null,
    userStatus: userData?.status || null,
    userData,
    loading,
    isDeveloper: userData?.role === 'developer',
    isOwner: userData?.role === 'owner',
    isAdmin: userData?.role === 'admin',
    isWorker: userData?.role === 'worker',
    isApproved: userData?.status === 'approved'
  };

  return (
    <RoleContext.Provider value={value}>
      {!loading && children}
    </RoleContext.Provider>
  );
};

export default RoleContext;

