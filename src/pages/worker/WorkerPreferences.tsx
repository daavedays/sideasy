/**
 * Worker Preferences Page
 * 
 * Allows workers to submit preferences for secondary task assignments.
 * Workers can:
 * - Select date range
 * - Mark preferred tasks
 * - Block unavailable dates
 * - See other workers' preferences
 * - Submit preferences to Firestore
 * 
 * Location: src/pages/worker/WorkerPreferences.tsx
 * Purpose: Worker preference submission interface
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
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

type PreferenceAction = 'prefer' | 'blockDay' | 'blockTask' | 'clear';

const WorkerPreferences: React.FC = () => {
  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Data state
  const [tasks, setTasks] = useState<SecondaryTask[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
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
   * Fetch secondary tasks and workers when department is loaded
   */
  useEffect(() => {
    if (!departmentId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch secondary tasks - CORRECT PATH
        const tasksDoc = await getDoc(doc(db, 'departments', departmentId, 'taskDefinitions', 'config'));
        if (tasksDoc.exists()) {
          const data = tasksDoc.data();
          const secondaryTasks = data.secondary_tasks?.definitions || [];
          setTasks(secondaryTasks);
          console.log('✅ Loaded secondary tasks:', secondaryTasks);
        } else {
          console.warn('⚠️ No task definitions found for department:', departmentId);
        }

        // Fetch all workers in department - CORRECT PATH
        const workersSnapshot = await getDocs(collection(db, 'departments', departmentId, 'workers'));
        const workersData: Worker[] = [];
        
        workersSnapshot.forEach((doc) => {
          const data = doc.data();
          workersData.push({
            workerId: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            qualifications: data.qualifications || [],
            preferences: data.preferences || []
          });
        });
        
        setWorkers(workersData);
        console.log('✅ Loaded workers:', workersData.length);
        
        // Find current worker
        const current = workersData.find(w => w.workerId === auth.currentUser?.uid);
        setCurrentWorker(current || null);

      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [departmentId]);

  /**
   * Build cell data from workers' preferences when date range or workers change
   */
  useEffect(() => {
    if (!startDate || !endDate || workers.length === 0) return;

    const newCellData = new Map<string, CellData>();
    const start = new Date(startDate);
    const end = new Date(endDate);

    workers.forEach((worker) => {
      worker.preferences.forEach((pref) => {
        const prefDate = pref.date.toDate();
        
        // Only include preferences within date range
        if (prefDate >= start && prefDate <= end) {
          const taskId = pref.task || 'blocked';
          const key = getCellKey(taskId, prefDate);
          
          const status: CellStatus = pref.task ? 'preferred' : 'blocked';
          
          newCellData.set(key, {
            workerId: worker.workerId,
            workerName: `${worker.firstName} ${worker.lastName}`,
            status,
            taskId,
            date: prefDate
          });
        }
      });
    });

    setCellData(newCellData);
  }, [startDate, endDate, workers]);

  /**
   * Handle cell click - open modal for preference selection
   */
  const handleCellClick = (taskId: string, date: Date) => {
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
      // Remove preference for this specific cell
      newCellData.delete(key);
    } else if (action === 'prefer') {
      // Add/update preferred task
      newCellData.set(key, {
        workerId: currentWorker.workerId,
        workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
        status: 'preferred',
        taskId,
        date
      });
    } else if (action === 'blockTask') {
      // Block this specific task on this date
      newCellData.set(key, {
        workerId: currentWorker.workerId,
        workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
        status: 'blocked',
        taskId,
        date
      });
    } else if (action === 'blockDay') {
      // Block ENTIRE day - add blocked entry for ALL tasks on this date
      tasks.forEach(task => {
        const dayKey = getCellKey(task.id, date);
        newCellData.set(dayKey, {
          workerId: currentWorker.workerId,
          workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
          status: 'blocked',
          taskId: task.id,
          date
        });
      });
    }

    setCellData(newCellData);
    setHasUnsavedChanges(true);
    setShowModal(false);
    setSelectedCell(null);
  };

  /**
   * Clear all preferences in date range
   */
  const handleClearAll = () => {
    if (!currentWorker) return;
    
    const newCellData = new Map(cellData);
    
    // Remove all cells belonging to current worker
    Array.from(newCellData.entries()).forEach(([key, cell]) => {
      if (cell.workerId === currentWorker.workerId) {
        newCellData.delete(key);
      }
    });

    setCellData(newCellData);
    setHasUnsavedChanges(true);
  };

  /**
   * Save preferences to Firestore
   */
  const handleSavePreferences = async () => {
    if (!currentWorker || !departmentId) return;

    try {
      // Collect all preferences for current worker from cellData
      const preferences: { date: Timestamp; task: string | null }[] = [];
      
      Array.from(cellData.values()).forEach((cell) => {
        if (cell.workerId === currentWorker.workerId) {
          preferences.push({
            date: Timestamp.fromDate(cell.date),
            task: cell.status === 'blocked' ? null : cell.taskId
          });
        }
      });

      // Update Firestore - CORRECT PATH
      const workerRef = doc(db, 'departments', departmentId, 'workers', currentWorker.workerId);
      await updateDoc(workerRef, {
        preferences,
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
                onChange={setStartDate}
              />
              <HebrewDatePicker
                label="תאריך סיום"
                value={endDate}
                onChange={setEndDate}
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
            <p className="text-white/80 mb-6">
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
              
              <button
                onClick={() => handlePreferenceAction('clear')}
                className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
              >
                <span className="text-2xl">○</span>
                <span>נקה</span>
              </button>
              
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

