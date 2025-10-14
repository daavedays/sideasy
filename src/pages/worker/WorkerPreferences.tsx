/**
 * Worker Preferences Page
 * 
 * Allows workers to submit preferences for secondary task assignments.
 * Workers can:
 * - Select date range
 * - Mark preferred tasks
 * - Block unavailable dates
 * - Submit preferences to Firestore
 * 
 * Location: src/pages/worker/WorkerPreferences.tsx
 * Purpose: Worker preference submission interface
 * 
 * COST OPTIMIZATION: Workers only fetch their own data (not all workers)
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import SecondaryTaskTable, { 
  SecondaryTask, 
  CellData, 
  getCellKey,
  CellStatus 
} from '../../components/shared/SecondaryTaskTable';
import Modal from '../../components/ui/Modal';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';


interface Worker {
  workerId: string;
  firstName: string;
  lastName: string;
  qualifications: string[]; // Array of task IDs
  preferences: {
    date: Timestamp;
    task: string | null;
  }[];
}

interface WorkerPreference {
  date: Timestamp;
  task: string | null;
}

type PreferenceAction = 'prefer' | 'blockDay' | 'blockTask' | 'clear';

const WorkerPreferences: React.FC = () => {
  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Data state
  const [tasks, setTasks] = useState<SecondaryTask[]>([]);
  const [currentWorkerPreferences, setCurrentWorkerPreferences] = useState<WorkerPreference[]>([]);
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ taskId: string; date: Date } | null>(null);
  
  // User state
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
  const [departmentId, setDepartmentId] = useState<string>('');

  /**
   * Get today's date at midnight (for comparison purposes)
   * Used to prevent workers from submitting preferences for past dates
   */
  const getTodayMidnight = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  /**
   * Validate and set start date
   * VALIDATION: Prevents selecting dates before today
   * TODO: Add deadline validation based on department settings
   */
  const handleStartDateChange = (date: string) => {
    if (!date) {
      setStartDate('');
      return;
    }

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const today = getTodayMidnight();

    if (selectedDate < today) {
      alert('לא ניתן לבחור תאריך התחלה בעבר');
      return;
    }

    setStartDate(date);
  };

  /**
   * Validate and set end date
   * VALIDATION: Prevents selecting dates before today
   * TODO: Add deadline validation based on department settings
   */
  const handleEndDateChange = (date: string) => {
    if (!date) {
      setEndDate('');
      return;
    }

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const today = getTodayMidnight();

    if (selectedDate < today) {
      alert('לא ניתן לבחור תאריך סיום בעבר');
      return;
    }

    setEndDate(date);
  };

  /**
   * Initialize: Fetch user's department
   */
  useEffect(() => {
    const fetchUserDepartment = async () => {
      if (!auth.currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDepartmentId(userData.departmentId);
        }
      } catch (error) {
        console.error('Error fetching user department:', error);
      }
    };

    fetchUserDepartment();
  }, []);

  /**
   * Fetch secondary tasks and current worker's data when department is loaded
   * COST OPTIMIZATION: Only fetch current worker's document, not all workers
   */
  useEffect(() => {
    if (!departmentId || !auth.currentUser) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch secondary tasks
        const tasksDoc = await getDoc(doc(db, 'departments', departmentId, 'taskDefinitions', 'config'));
        if (tasksDoc.exists()) {
          const data = tasksDoc.data();
          const secondaryTasks = data.secondary_tasks?.definitions || [];
          setTasks(secondaryTasks);
          console.log('✅ Loaded secondary tasks:', secondaryTasks);
        } else {
          console.warn('⚠️ No task definitions found for department:', departmentId);
        }

        // Fetch ONLY current worker's data (cost optimization)
        // Safe to use ! because we check auth.currentUser in useEffect guard above
        const workerDocRef = doc(db, 'departments', departmentId, 'workers', auth.currentUser!.uid);
        const workerDoc = await getDoc(workerDocRef);
        
        if (workerDoc.exists()) {
          const data = workerDoc.data();
          const worker: Worker = {
            workerId: workerDoc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            qualifications: data.qualifications || [],
            preferences: data.preferences || []
          };
          
          setCurrentWorker(worker);
          setCurrentWorkerPreferences(data.preferences || []);
          console.log('✅ Loaded current worker data');
        } else {
          console.error('❌ Worker document not found');
        }

      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [departmentId]);

  /**
   * Build cell data from current worker's preferences only
   * COST OPTIMIZATION: Only show current worker's preferences
   */
  useEffect(() => {
    if (!startDate || !endDate || !currentWorker) return;

    const newCellData = new Map<string, CellData>();
    
    // If no preferences, just set empty map (allows showing empty table)
    if (currentWorkerPreferences.length === 0) {
      setCellData(newCellData);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    currentWorkerPreferences.forEach((pref) => {
      const prefDate = pref.date.toDate();
      
      // Only include preferences within date range
      if (prefDate >= start && prefDate <= end) {
        const taskId = pref.task || 'blocked';
        const key = getCellKey(taskId, prefDate);
        
        const status: CellStatus = pref.task ? 'preferred' : 'blocked';
        
        const workerInCell = {
          workerId: currentWorker.workerId,
          workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
          status
        };

        // Create cell with only current worker
        newCellData.set(key, {
          workers: [workerInCell],
          taskId,
          date: prefDate
        });
      }
    });

    setCellData(newCellData);
  }, [startDate, endDate, currentWorker, currentWorkerPreferences]);

  /**
   * Handle cell click - open modal for preference selection
   * VALIDATION: Prevents workers from submitting preferences for past dates
   * TODO: Add deadline functionality - prevent submissions after a certain date/time
   * TODO: Make deadline configurable per department (e.g., 48 hours before schedule)
   * TODO: Add UI indicator showing when deadline expires
   */
  const handleCellClick = (taskId: string, date: Date) => {
    // Prevent setting preferences for past dates (today is allowed)
    const today = getTodayMidnight();
    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);
    
    if (clickedDate < today) {
      alert('לא ניתן להגיש בקשות לתאריכים שעברו');
      return;
    }
    
    setSelectedCell({ taskId, date });
    setShowModal(true);
  };

  /**
   * Handle preference action from modal
   */
  const handlePreferenceAction = (action: PreferenceAction) => {
    if (!selectedCell || !currentWorker) return;

    const { taskId, date } = selectedCell;
    const key = getCellKey(taskId, date);
    const newCellData = new Map(cellData);

    if (action === 'clear') {
      // Remove ONLY current worker's preference for this cell
      const existingCell = newCellData.get(key);
      if (existingCell) {
        const updatedWorkers = existingCell.workers.filter(
          w => w.workerId !== currentWorker.workerId
        );
        
        if (updatedWorkers.length > 0) {
          // Other workers still have preferences, keep cell with remaining workers
          newCellData.set(key, {
            ...existingCell,
            workers: updatedWorkers
          });
        } else {
          // No workers left, remove cell entirely
          newCellData.delete(key);
        }
      }
    } else if (action === 'prefer') {
      // Add/update current worker's preferred task
      const existingCell = newCellData.get(key);
      const newWorkerData = {
        workerId: currentWorker.workerId,
        workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
        status: 'preferred' as CellStatus
      };

      if (existingCell) {
        // Check if current worker already has a preference here
        const workerIndex = existingCell.workers.findIndex(
          w => w.workerId === currentWorker.workerId
        );
        
        if (workerIndex >= 0) {
          // Update existing preference
          existingCell.workers[workerIndex] = newWorkerData;
        } else {
          // Add new worker to cell
          existingCell.workers.push(newWorkerData);
        }
        newCellData.set(key, existingCell);
      } else {
        // Create new cell
        newCellData.set(key, {
          workers: [newWorkerData],
          taskId,
          date
        });
      }
    } else if (action === 'blockTask') {
      // Block this specific task on this date for current worker
      const existingCell = newCellData.get(key);
      const newWorkerData = {
        workerId: currentWorker.workerId,
        workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
        status: 'blocked' as CellStatus
      };

      if (existingCell) {
        const workerIndex = existingCell.workers.findIndex(
          w => w.workerId === currentWorker.workerId
        );
        
        if (workerIndex >= 0) {
          existingCell.workers[workerIndex] = newWorkerData;
        } else {
          existingCell.workers.push(newWorkerData);
        }
        newCellData.set(key, existingCell);
      } else {
        newCellData.set(key, {
          workers: [newWorkerData],
          taskId,
          date
        });
      }
    } else if (action === 'blockDay') {
      // Block ENTIRE day - add blocked entry for ALL tasks on this date
      tasks.forEach(task => {
        const dayKey = getCellKey(task.id, date);
        const existingCell = newCellData.get(dayKey);
        const newWorkerData = {
          workerId: currentWorker.workerId,
          workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
          status: 'blocked' as CellStatus
        };

        if (existingCell) {
          const workerIndex = existingCell.workers.findIndex(
            w => w.workerId === currentWorker.workerId
          );
          
          if (workerIndex >= 0) {
            existingCell.workers[workerIndex] = newWorkerData;
          } else {
            existingCell.workers.push(newWorkerData);
          }
          newCellData.set(dayKey, existingCell);
        } else {
          newCellData.set(dayKey, {
            workers: [newWorkerData],
            taskId: task.id,
            date
          });
        }
      });
    }

    setCellData(newCellData);
    setHasUnsavedChanges(true);
    setShowModal(false);
    setSelectedCell(null);
  };

  /**
   * Clear all preferences in date range for current worker only
   */
  const handleClearAll = () => {
    if (!currentWorker) return;
    
    const newCellData = new Map(cellData);
    
    // Remove current worker from all cells
    Array.from(newCellData.entries()).forEach(([key, cell]) => {
      const updatedWorkers = cell.workers.filter(
        w => w.workerId !== currentWorker.workerId
      );
      
      if (updatedWorkers.length > 0) {
        // Keep cell with remaining workers
        newCellData.set(key, {
          ...cell,
          workers: updatedWorkers
        });
      } else {
        // No workers left, remove cell
        newCellData.delete(key);
      }
    });

    setCellData(newCellData);
    setHasUnsavedChanges(true);
  };

  /**
   * Save preferences to Firestore
   * Merges new preferences with existing ones outside the current date range
   * VALIDATION: Filters out any preferences for past dates before saving
   * TODO: Add deadline validation - prevent save if past deadline
   * TODO: Show warning message when approaching deadline
   */
  const handleSavePreferences = async () => {
    if (!currentWorker || !departmentId || !startDate || !endDate) return;

    try {
      // Get current date range boundaries
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);

      // Get today's date for validation
      const today = getTodayMidnight();

      // Fetch existing preferences from Firestore
      const workerRef = doc(db, 'departments', departmentId, 'workers', currentWorker.workerId);
      const workerDoc = await getDoc(workerRef);
      const existingPreferences = workerDoc.exists() ? (workerDoc.data().preferences || []) : [];

      // Filter out existing preferences that fall within current date range
      // We'll replace these with new ones
      const preferencesOutsideRange = existingPreferences.filter((pref: any) => {
        const prefDate = pref.date.toDate();
        return prefDate < rangeStart || prefDate > rangeEnd;
      });

      // Collect new preferences for current worker from cellData (current date range only)
      const newPreferencesInRange: { date: Timestamp; task: string | null }[] = [];
      
      Array.from(cellData.values()).forEach((cell) => {
        // Find current worker in this cell
        const currentWorkerInCell = cell.workers.find(
          w => w.workerId === currentWorker.workerId
        );
        
        if (currentWorkerInCell) {
          // VALIDATION: Only include preferences for today or future dates
          const cellDate = new Date(cell.date);
          cellDate.setHours(0, 0, 0, 0);
          
          if (cellDate >= today) {
            newPreferencesInRange.push({
              date: Timestamp.fromDate(cell.date),
              task: currentWorkerInCell.status === 'blocked' ? null : cell.taskId
            });
          }
        }
      });

      // Check if any preferences were filtered out due to past dates
      const totalCurrentWorkerPrefs = Array.from(cellData.values()).filter(cell => 
        cell.workers.find(w => w.workerId === currentWorker.workerId)
      ).length;
      
      if (totalCurrentWorkerPrefs > newPreferencesInRange.length) {
        const filteredCount = totalCurrentWorkerPrefs - newPreferencesInRange.length;
        alert(`שים לב: ${filteredCount} בקשות לתאריכים שעברו לא נשמרו`);
      }

      // Merge: preferences outside range + new preferences in range
      const mergedPreferences = [...preferencesOutsideRange, ...newPreferencesInRange];

      console.log('✅ Preference Save Summary:');
      console.log('  - Existing preferences:', existingPreferences.length);
      console.log('  - Preferences outside range (kept):', preferencesOutsideRange.length);
      console.log('  - New preferences in range:', newPreferencesInRange.length);
      console.log('  - Total after merge:', mergedPreferences.length);

      // Update Firestore with merged preferences
      await updateDoc(workerRef, {
        preferences: mergedPreferences,
        updatedAt: Timestamp.now()
      });

      setHasUnsavedChanges(false);
      alert('העדפות נשמרו בהצלחה!');

    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('שגיאה בשמירת העדפות. נסה שוב.');
    }
  };

  /**
   * Format date for display in modal
   * CRITICAL: DD/MM/YYYY format - Israel timezone
   */
  const formatDateForDisplay = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getTaskName = (taskId: string): string => {
    const task = tasks.find(t => t.id === taskId);
    return task?.name || '';
  };

  if (loading) {
    return (
      <div dir="rtl" className="relative flex-1 min-h-screen">
        <Background singleImage="/images/image_1.png" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-white text-2xl">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">
              מערכת הגשת בקשות
            </h1>
            <p className="text-lg md:text-xl text-white/80">
              בחר טווח תאריכים וסמן העדפות עבור משימות משניות
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative z-10">
            <h2 className="text-2xl font-bold text-white mb-4">בחר טווח תאריכים וסמן העדפות</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <HebrewDatePicker
                label="תאריך התחלה"
                value={startDate}
                onChange={handleStartDateChange}
              />
              <HebrewDatePicker
                label="תאריך סיום"
                value={endDate}
                onChange={handleEndDateChange}
              />
              <div className="flex items-end">
                <button
                  onClick={handleClearAll}
                  disabled={!hasUnsavedChanges}
                  className="w-full bg-slate-700/70 hover:bg-slate-600/90 disabled:bg-gray-600/30 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 border border-slate-500/30"
                >
                  נקה הכל
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSavePreferences}
                  disabled={!hasUnsavedChanges}
                  className={`w-full font-bold py-3 px-6 rounded-xl transition-all duration-200 border-2 ${
                    hasUnsavedChanges 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400/50 shadow-lg shadow-blue-500/30 animate-pulse' 
                      : 'bg-gray-700/30 border-gray-600/30 cursor-not-allowed'
                  } text-white`}
                >
                  שלח העדפות
                </button>
              </div>
            </div>
          </div>

          {/* Debug Info - TODO: REMOVE THIS BEFORE PRODUCTION DEPLOYMENT */}
          {/* Temporarily disabled - remove entire block before production
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4 text-yellow-200 text-sm">
              <p><strong>Debug Info (Development Only):</strong></p>
              <p>Department ID: {departmentId || 'Not loaded'}</p>
              <p>Tasks loaded: {tasks.length}</p>
              <p>Workers loaded: {workers.length}</p>
              <p>Current worker: {currentWorker ? `${currentWorker.firstName} ${currentWorker.lastName}` : 'Not found'}</p>
            </div>
          )}
          */}

          {/* Table */}
          {startDate && endDate && tasks.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative z-0">
              <SecondaryTaskTable
                startDate={new Date(startDate)}
                endDate={new Date(endDate)}
                tasks={tasks}
                cellData={cellData}
                onCellClick={handleCellClick}
                currentWorkerId={currentWorker?.workerId}
                currentWorkerQualifications={currentWorker?.qualifications || []}
              />
            </div>
          )}

          {/* No tasks message */}
          {startDate && endDate && tasks.length === 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-white text-xl font-bold mb-2">
                אין משימות משניות במחלקה
              </p>
              <p className="text-white/70">
                בקש מהמנהל או בעל המחלקה להוסיף משימות משניות בהגדרות
              </p>
            </div>
          )}

          {/* No date range selected */}
          {(!startDate || !endDate) && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 text-center">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-white/70 text-lg">
                בחר טווח תאריכים כדי להתחיל
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preference Selection Modal */}
      {showModal && selectedCell && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
          <div className="p-6" dir="rtl">
            <h2 className="text-2xl font-bold text-white mb-4">בחר פעולה</h2>
            <p className="text-white/80 mb-4">
              תאריך: {formatDateForDisplay(selectedCell.date)} | משימה: {getTaskName(selectedCell.taskId)}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => handlePreferenceAction('prefer')}
                className="w-full bg-green-600/80 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">✓</span>
                <span>העדף משימה זו</span>
              </button>
              
              <button
                onClick={() => handlePreferenceAction('blockDay')}
                className="w-full bg-red-600/80 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">✕</span>
                <span>חסום יום שלם</span>
              </button>
              
              <button
                onClick={() => handlePreferenceAction('blockTask')}
                className="w-full bg-orange-600/80 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">⊗</span>
                <span>חסום משימה זו</span>
              </button>
              
              {/* Only show clear button if current worker has a preference here */}
              {(() => {
                const key = getCellKey(selectedCell.taskId, selectedCell.date);
                const cell = cellData.get(key);
                const currentWorkerInCell = currentWorker && cell?.workers.find(
                  w => w.workerId === currentWorker.workerId
                );
                
                return currentWorkerInCell && (
                  <button
                    onClick={() => handlePreferenceAction('clear')}
                    className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">○</span>
                    <span>נקה את ההעדפה שלי</span>
                  </button>
                );
              })()}
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-600/80 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
              >
                ביטול
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WorkerPreferences;

