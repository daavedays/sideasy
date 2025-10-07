import { useState, useCallback } from 'react';
import { useFirestore } from './useFirestore';
import { COLLECTIONS } from '../config/appConfig';

/**
 * useSchedule Hook
 * 
 * Custom hook for managing schedule operations.
 * Handles CRUD operations for schedules and shifts.
 * 
 * Location: src/hooks/useSchedule.ts
 * Purpose: Schedule management operations
 */

interface Schedule {
  id?: string;
  departmentId: string;
  startDate: Date;
  endDate: Date;
  shifts: any[];
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const useSchedule = () => {
  const { loading, error, addDocument, updateDocument, deleteDocument, queryDocuments } = useFirestore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const createSchedule = useCallback(async (scheduleData: Omit<Schedule, 'id'>) => {
    try {
      const scheduleId = await addDocument(COLLECTIONS.SCHEDULES, scheduleData);
      return scheduleId;
    } catch (err) {
      console.error('Error creating schedule:', err);
      throw err;
    }
  }, [addDocument]);

  const updateSchedule = useCallback(async (scheduleId: string, updates: Partial<Schedule>) => {
    try {
      await updateDocument(COLLECTIONS.SCHEDULES, scheduleId, updates);
    } catch (err) {
      console.error('Error updating schedule:', err);
      throw err;
    }
  }, [updateDocument]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    try {
      await deleteDocument(COLLECTIONS.SCHEDULES, scheduleId);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      throw err;
    }
  }, [deleteDocument]);

  const getSchedulesByDepartment = useCallback(async (departmentId: string) => {
    try {
      const results = await queryDocuments<Schedule>(
        COLLECTIONS.SCHEDULES,
        'departmentId',
        '==',
        departmentId
      );
      setSchedules(results);
      return results;
    } catch (err) {
      console.error('Error fetching schedules:', err);
      throw err;
    }
  }, [queryDocuments]);

  return {
    loading,
    error,
    schedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedulesByDepartment
  };
};

export default useSchedule;

