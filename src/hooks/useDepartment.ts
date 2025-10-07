import { useDepartmentContext } from '../context/DepartmentContext';

/**
 * useDepartment Hook
 * 
 * Custom hook for accessing department information.
 * Provides easy access to current user's department data.
 * 
 * Location: src/hooks/useDepartment.ts
 * Purpose: Simplified department data access
 */

export const useDepartment = () => {
  const { department, loading } = useDepartmentContext();

  return {
    department,
    loading,
    hasDepartment: !!department,
    departmentId: department?.id || null,
    departmentName: department?.name || null
  };
};

export default useDepartment;

