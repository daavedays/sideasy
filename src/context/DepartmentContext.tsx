import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useRoleContext } from './RoleContext';
import { COLLECTIONS } from '../config/appConfig';

/**
 * Department Context
 * 
 * Manages department information for the current user.
 * Listens to Firestore for real-time department updates.
 * 
 * Location: src/context/DepartmentContext.tsx
 * Purpose: Department state management
 */

interface Department {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  settings?: {
    maxWorkers?: number;
    shiftTypes?: string[];
  };
}

interface DepartmentContextType {
  department: Department | null;
  loading: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export const useDepartmentContext = () => {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartmentContext must be used within DepartmentProvider');
  }
  return context;
};

interface DepartmentProviderProps {
  children: ReactNode;
}

export const DepartmentProvider: React.FC<DepartmentProviderProps> = ({ children }) => {
  const { userData } = useRoleContext();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const departmentId = userData?.departmentId;

    if (!departmentId) {
      setDepartment(null);
      setLoading(false);
      return;
    }

    // Listen to department document for real-time updates
    const departmentDocRef = doc(db, COLLECTIONS.DEPARTMENTS, departmentId);
    const unsubscribe = onSnapshot(departmentDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDepartment({
          id: docSnap.id,
          ...docSnap.data()
        } as Department);
      } else {
        setDepartment(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.departmentId]);

  const value: DepartmentContextType = {
    department,
    loading
  };

  return (
    <DepartmentContext.Provider value={value}>
      {!loading && children}
    </DepartmentContext.Provider>
  );
};

export default DepartmentContext;

