/**
 * Primary Tasks Table View Page
 * 
 * Dedicated page for viewing and editing primary task schedules.
 * Shows full table with worker assignments.
 * 
 * Location: src/pages/common/PrimaryTasksTableView.tsx
 * Purpose: Full-page view for primary task scheduling table
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useDepartment } from '../../hooks/useDepartment';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import PrimaryTaskTable from '../../components/shared/PrimaryTaskTable';
import PrimaryTaskCellModal from '../../components/shared/PrimaryTaskCellModal';
import Button from '../../components/ui/Button';
import {
  Week,
  Worker,
  Assignment,
  MainTask,
  PrimaryScheduleUI,
} from '../../types/primarySchedule.types';
import { calculateWeeksFromDateRange, sortWorkersAlphabetically, getYear } from '../../lib/utils/weekUtils';
import { generateCellKey } from '../../lib/utils/cellKeyUtils';
import { exportScheduleToCSV } from '../../lib/utils/csvExport';
import { WorkerData } from '../../lib/firestore/workers';
import { getTaskDefinitions } from '../../lib/firestore/taskDefinitions';
import {
  saveScheduleWithWorkerUpdates,
  getScheduleById,
  getScheduleAssignments,
} from '../../lib/firestore/primarySchedules';

interface LocationState {
  startDate: string;
  endDate: string;
  includeAdmins: boolean;
  scheduleId?: string;  // Optional: for editing existing schedules
}

const PrimaryTasksTableView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { departmentId, departmentName } = useDepartment();

  const state = location.state as LocationState;

  // Use ref to persist scheduleId across re-renders (more reliable than state alone)
  const scheduleIdRef = useRef<string | undefined>(undefined);

  // Schedule State
  const [scheduleId, setScheduleId] = useState<string | undefined>(undefined);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [admins, setAdmins] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [taskDefinitions, setTaskDefinitions] = useState<MainTask[]>([]);
  const [scheduleYear, setScheduleYear] = useState<number | undefined>(undefined);
  const [includeAdmins, setIncludeAdmins] = useState(false);

  // Change Tracking
  const [originalAssignments, setOriginalAssignments] = useState<Map<string, Assignment>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculatingClosing, setIsCalculatingClosing] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    workerId: string;
    workerName: string;
    weekNumber: number;
    weekDates: { start: Date; end: Date };
  } | null>(null);

  // Initialize schedule from location state
  useEffect(() => {
    console.log(`🔍 [useEffect-init] Running with state.scheduleId: ${state?.scheduleId || 'undefined'}`);
    console.log(`🔍 [useEffect-init] Current scheduleIdRef: ${scheduleIdRef.current || 'undefined'}`);
    
    if (!state || !state.startDate || !state.endDate) {
      // No state provided, redirect back
      navigate(-1);
      return;
    }

    // Convert string dates to Date objects
    const [startYear, startMonth, startDay] = state.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = state.endDate.split('-').map(Number);
    
    const startDateObj = new Date(startYear, startMonth - 1, startDay);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);

    // Calculate weeks
    const calculatedWeeks = calculateWeeksFromDateRange(startDateObj, endDateObj);
    setWeeks(calculatedWeeks);
    setScheduleYear(getYear(startDateObj));
    setIncludeAdmins(state.includeAdmins);
    
    // Set schedule ID if editing existing schedule OR if we already saved one
    // Priority: 1. Already saved (ref), 2. From location state, 3. undefined (new schedule)
    const effectiveScheduleId = scheduleIdRef.current || state.scheduleId;
    
    if (effectiveScheduleId) {
      console.log(`🔍 [useEffect-init] Setting scheduleId: ${effectiveScheduleId}`);
      scheduleIdRef.current = effectiveScheduleId;
      setScheduleId(effectiveScheduleId);
    } else {
      console.log(`🔍 [useEffect-init] No scheduleId, creating new schedule`);
    }
  }, [state, navigate]);

  // Load existing schedule assignments if editing
  useEffect(() => {
    const loadExistingSchedule = async () => {
      if (!scheduleId || !departmentId) return;

      try {
        // Load schedule metadata (for validation)
        const schedule = await getScheduleById(departmentId, scheduleId);
        if (!schedule) {
          console.error('Schedule not found');
          return;
        }

        // Load assignments
        const loadedAssignments = await getScheduleAssignments(departmentId, scheduleId);
        setAssignments(loadedAssignments);
        setOriginalAssignments(new Map(loadedAssignments)); // Deep copy for comparison
        console.log(`Loaded ${loadedAssignments.size} assignments from existing schedule`);
      } catch (error) {
        console.error('Error loading existing schedule:', error);
        alert('שגיאה בטעינת תורנות קיימת');
      }
    };

    loadExistingSchedule();
  }, [scheduleId, departmentId]);

  // Load workers and admins from consolidated map doc (single read)
  useEffect(() => {
    const loadWorkersOnce = async () => {
      if (!departmentId) return;

      try {
        const mapRef = doc(db, 'departments', departmentId, 'workers', 'index');
        const mapSnap = await getDoc(mapRef);
        const workersData: Worker[] = [];
        const adminsData: Worker[] = [];

        if (mapSnap.exists()) {
          const data = mapSnap.data() as any;
          const workersMap = (data.workers || {}) as Record<string, any>;
          Object.values(workersMap).forEach((entry: any) => {
            if (entry.activity === 'deleted') return;
            const worker: Worker = {
              workerId: entry.workerId,
              firstName: entry.firstName,
              lastName: entry.lastName,
              fullName: `${entry.firstName} ${entry.lastName}`,
              email: entry.email,
              role: entry.role,
              isActive: entry.activity === 'active',
            };
            if (entry.role === 'worker') {
              workersData.push(worker);
            } else if (entry.role === 'admin' || entry.role === 'owner') {
              adminsData.push(worker);
            }
          });
        }

        setWorkers(workersData);
        setAdmins(adminsData);
      } catch (error) {
        console.error('Error loading workers map:', error);
      }
    };

    loadWorkersOnce();
  }, [departmentId]);

  // Load task definitions from Firestore
  useEffect(() => {
    const loadTaskDefinitions = async () => {
      if (!departmentId) return;

      try {
        const taskDefs = await getTaskDefinitions(departmentId);
        
        if (taskDefs && taskDefs.main_tasks && taskDefs.main_tasks.definitions) {
          // Map main_tasks definitions to MainTask[]
          const mainTasks: MainTask[] = taskDefs.main_tasks.definitions.map(task => ({
            id: task.id,
            name: task.name,
            isDefault: task.isDefault,
            start_day: task.start_day,
            end_day: task.end_day,
            duration: task.duration,
          }));
          
          setTaskDefinitions(mainTasks);
        } else {
          setTaskDefinitions([]);
        }
      } catch (error) {
        console.error('Error loading task definitions:', error);
        setTaskDefinitions([]);
      }
    };

    loadTaskDefinitions();
  }, [departmentId]);

  // Track changes to assignments
  useEffect(() => {
    // Compare current assignments with original
    const hasChanges = 
      assignments.size !== originalAssignments.size ||
      Array.from(assignments.keys()).some(key => {
        const current = assignments.get(key);
        const original = originalAssignments.get(key);
        
        // If one exists and the other doesn't
        if (!current !== !original) return true;
        
        // If both exist, compare their properties
        if (current && original) {
          return (
            current.taskId !== original.taskId ||
            current.startDate.getTime() !== original.startDate.getTime() ||
            current.endDate.getTime() !== original.endDate.getTime()
          );
        }
        
        return false;
      });

    setHasUnsavedChanges(hasChanges);
  }, [assignments, originalAssignments]);

  // Handle cell click
  const handleCellClick = (
    workerId: string,
    weekNumber: number,
    weekDates: { start: Date; end: Date }
  ) => {
    const worker = [...workers, ...admins].find(w => w.workerId === workerId);
    if (!worker) return;

    setSelectedCell({
      workerId,
      workerName: worker.fullName,
      weekNumber,
      weekDates,
    });
    setModalOpen(true);
  };

  // Handle save assignment
  const handleSaveAssignment = (assignment: Assignment | null) => {
    if (!selectedCell) return;

    const newAssignments = new Map(assignments);

    if (assignment === null) {
      // Clear assignment from clicked cell only
      const key = generateCellKey(selectedCell.workerId, selectedCell.weekNumber);
      console.log('Deleting assignment for key:', key);
      newAssignments.delete(key);
    } else {
      // Calculate all weeks covered by the task's date range
      const startDate = assignment.startDate;
      const endDate = assignment.endDate;
      
      // Find all weeks that overlap with this date range
      const affectedWeeks: number[] = [];
      weeks.forEach(week => {
        // Check if week overlaps with task date range
        if (week.endDate >= startDate && week.startDate <= endDate) {
          affectedWeeks.push(week.weekNumber);
        }
      });

      console.log('Task spans weeks:', affectedWeeks);
      
      // Create assignment for each affected week
      affectedWeeks.forEach(weekNum => {
        const key = generateCellKey(selectedCell.workerId, weekNum);
        const weekAssignment: Assignment = {
          ...assignment,
          weekNumber: weekNum,
        };
        console.log('Setting assignment for week', weekNum, ':', key);
        newAssignments.set(key, weekAssignment);
      });
    }

    console.log('New assignments Map size:', newAssignments.size);
    setAssignments(newAssignments);
    setHasUnsavedChanges(true); // Mark as having unsaved changes
    setModalOpen(false);
    setSelectedCell(null);
  };

  // Handle save schedule
  const handleSaveSchedule = async () => {
    if (!departmentId || !departmentName || !user?.uid || !state) {
      alert('חסרים נתונים נדרשים');
      return;
    }
    if (assignments.size === 0) {
      alert('אין הקצאות לשמור');
      return;
    }

    // Use the ref value as the source of truth (persists across re-renders)
    const currentScheduleId = scheduleIdRef.current || scheduleId;
    
    console.log(`🔍 [handleSaveSchedule] Current scheduleId state: ${scheduleId || 'undefined'}`);
    console.log(`🔍 [handleSaveSchedule] Current scheduleIdRef: ${scheduleIdRef.current || 'undefined'}`);
    console.log(`🔍 [handleSaveSchedule] Using scheduleId: ${currentScheduleId || 'undefined'}`);
    console.log(`🔍 [handleSaveSchedule] Mode: ${currentScheduleId ? 'EDIT/UPDATE' : 'CREATE NEW'}`);

    setIsSaving(true);
    setIsCalculatingClosing(true);

    try {
      // Parse dates from state
      const [startYear, startMonth, startDay] = state.startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = state.endDate.split('-').map(Number);
      
      const startDateObj = new Date(startYear, startMonth - 1, startDay);
      const endDateObj = new Date(endYear, endMonth - 1, endDay);

      console.log(`🔍 [handleSaveSchedule] Calling saveScheduleWithWorkerUpdates with scheduleId: ${currentScheduleId || 'undefined'}`);

      // Save schedule with worker updates (includes optimal closing date calculation)
      const savedScheduleId = await saveScheduleWithWorkerUpdates(
        departmentId,
        departmentName,
        startDateObj,
        endDateObj,
        includeAdmins,
        weeks,
        assignments,
        user.uid,
        currentScheduleId  // Use the current value from ref or state
      );

      console.log(`🔍 [handleSaveSchedule] Save completed, savedScheduleId: ${savedScheduleId}`);

      // CRITICAL: Update BOTH state and ref to persist scheduleId for subsequent saves
      scheduleIdRef.current = savedScheduleId;
      setScheduleId(savedScheduleId);
      setOriginalAssignments(new Map(assignments)); // Update baseline
      setHasUnsavedChanges(false);

      console.log(`✅ [handleSaveSchedule] Schedule ID persisted: ${savedScheduleId}`);
      console.log(`✅ [handleSaveSchedule] Future saves will UPDATE this schedule, not create new ones`);

      alert(currentScheduleId ? 'תורנות ותאריכי סגירה עודכנו בהצלחה!' : 'תורנות ותאריכי סגירה נשמרו בהצלחה!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('שגיאה בשמירת תורנות');
    } finally {
      setIsSaving(false);
      setIsCalculatingClosing(false);
    }
  };

  // Handle export to CSV
  const handleExportCSV = () => {
    if (weeks.length === 0) return;

    try {
      // Create a temporary schedule object for export
      const tempSchedule: PrimaryScheduleUI = {
        scheduleId: 'temp',
        name: `תורנות ${state.startDate} - ${state.endDate}`,
        type: 'primary',
        startDate: new Date(),
        endDate: new Date(),
        includeAdmins,
        totalPeriods: weeks.length,
        periodDuration: 7,
        status: 'draft',
        departmentId: departmentId || '',
        departmentName: departmentName || '',
        createdAt: new Date(),
        createdBy: user?.uid || '',
        updatedAt: new Date(),
      };

      exportScheduleToCSV(
        tempSchedule,
        weeks,
        workers.map(w => ({ workerId: w.workerId, workerName: w.fullName })),
        admins.map(a => ({ workerId: a.workerId, workerName: a.fullName })),
        includeAdmins,
        assignments
      );
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('שגיאה בייצוא קובץ');
    }
  };

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Back Button and Title */}
          <div className="mb-6">
            <Button
              onClick={() => navigate(-1)}
              className="mb-4 bg-slate-700 hover:bg-slate-600"
            >
              ← חזרה
            </Button>
            
            <h1 className="text-4xl font-bold text-white mb-2">
              {scheduleId ? 'עריכת תורנות ראשית' : 'יצירת תורנות ראשית'}
            </h1>
            <p className="text-white/70">
              שנה: {scheduleYear} | שבועות: {weeks.length}
              {scheduleId && ' | עריכה'}
            </p>
          </div>

          {/* Table */}
          {weeks.length > 0 ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <PrimaryTaskTable
                  weeks={weeks}
                  workers={sortWorkersAlphabetically(workers)}
                  admins={sortWorkersAlphabetically(admins)}
                  includeAdmins={includeAdmins}
                  assignments={assignments}
                  taskDefinitions={taskDefinitions}
                  onCellClick={handleCellClick}
                  isReadOnly={false}
                  year={scheduleYear}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 items-center">
                {/* Loading Indicator */}
                {isSaving && (
                  <div className="px-8 py-3 bg-blue-600/20 border border-blue-500/50 rounded-xl text-blue-300 font-semibold animate-pulse">
                    {isCalculatingClosing ? '🧮 מחשב תאריכי סגירה מיטביים...' : '💾 שומר נתונים...'}
                  </div>
                )}
                
                {/* Buttons */}
                <div className="flex flex-wrap gap-4 justify-center">
                  {hasUnsavedChanges && (
                    <Button
                      onClick={handleSaveSchedule}
                      disabled={isSaving}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? '⏳ שומר...' : scheduleId ? '💾 עדכן תורנות' : '💾 שמור תורנות'}
                    </Button>
                  )}
                  {!hasUnsavedChanges && scheduleId && !isSaving && (
                    <div className="px-8 py-3 bg-green-600/20 border border-green-500/50 rounded-xl text-green-300 font-semibold">
                      ✅ כל השינויים נשמרו
                    </div>
                  )}
                  <Button
                    onClick={handleExportCSV}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📥 ייצא לאקסל
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                טוען נתונים...
              </h3>
              <p className="text-white/70">
                שבועות: {weeks.length} | עובדים: {workers.length} | מנהלים: {admins.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cell Assignment Modal */}
      {selectedCell && (
        <PrimaryTaskCellModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedCell(null);
          }}
          workerId={selectedCell.workerId}
          workerName={selectedCell.workerName}
          weekNumber={selectedCell.weekNumber}
          weekStartDate={selectedCell.weekDates.start}
          weekEndDate={selectedCell.weekDates.end}
          currentAssignment={assignments.get(generateCellKey(selectedCell.workerId, selectedCell.weekNumber)) || null}
          taskDefinitions={taskDefinitions}
          onSaveAssignment={handleSaveAssignment}
        />
      )}
    </div>
  );
};

export default PrimaryTasksTableView;

