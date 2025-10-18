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
import { doc, getDoc, Timestamp } from 'firebase/firestore';
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
import { getTaskDefinitions } from '../../lib/firestore/taskDefinitions';
import { getPrimarySchedules, getScheduleAssignments } from '../../lib/firestore/primarySchedules';


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

interface WorkerPreference { date: Timestamp; taskId: string | null; status?: 'preferred' | 'blocked'; }

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
  const [disabledDateKeys, setDisabledDateKeys] = useState<Set<string>>(new Set());
  const [disabledTooltips, setDisabledTooltips] = useState<Map<string, string>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preferences configuration (loaded from department)
  type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  const [maxBlockedTasksPerWeek, setMaxBlockedTasksPerWeek] = useState<number | null>(null); // null = unlimited
  const [weeklyCutoff, setWeeklyCutoff] = useState<{ enabled: boolean; dayOfWeek: DayOfWeek; hour: number; minute: number }>({
    enabled: false,
    dayOfWeek: 'thu',
    hour: 23,
    minute: 59
  });

  // Helper: compute locked week window (Sun..Sat) for "upcoming week" after this week's cutoff passes
  const getLockedWeekWindow = (): { start: Date; end: Date } | null => {
    if (!weeklyCutoff.enabled) return null;
    const now = new Date();
    const dayOfWeekMap: Record<DayOfWeek, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const dow = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const cutoffDow = dayOfWeekMap[weeklyCutoff.dayOfWeek];
    const cutoff = new Date(weekStart);
    cutoff.setDate(weekStart.getDate() + cutoffDow);
    cutoff.setHours(weeklyCutoff.hour, weeklyCutoff.minute, 0, 0);

    if (now.getTime() > cutoff.getTime()) {
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(weekStart.getDate() + 7);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      nextWeekEnd.setHours(23, 59, 59, 999);
      return { start: nextWeekStart, end: nextWeekEnd };
    }
    return null;
  };

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

  const handleRefresh = async () => {
    if (!departmentId || !auth.currentUser) return;
    try {
      setIsRefreshing(true);
      // Force re-fetch of tasks and byWorker (clear any potential caches)
      const defs = await getTaskDefinitions(departmentId);
      setTasks(defs?.secondary_tasks?.definitions || []);

      const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', auth.currentUser!.uid);
      const byWorkerSnap = await getDoc(byWorkerRef);
      const prefs = byWorkerSnap.exists() ? (((byWorkerSnap.data() as any).preferences || []) as any[]) : [];
      const mapped = (prefs || []).map((p: any) => ({ date: p.date, taskId: p.taskId ?? null, status: p.status || (p.taskId ? 'preferred' : 'blocked') }));
      setCurrentWorkerPreferences(mapped);
    } catch (e) {
      console.error('שגיאה ברענון נתונים', e);
      try { alert('שגיאה ברענון הנתונים'); } catch {}
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Fetch secondary tasks and current worker's data when department is loaded
   * COST OPTIMIZATION: Only fetch current worker's document, not all workers
   */
  useEffect(() => {
    if (!departmentId || !auth.currentUser) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch secondary tasks via local cache helper
        const defs = await getTaskDefinitions(departmentId);
        const secondaryTasks = defs?.secondary_tasks?.definitions || [];
        setTasks(secondaryTasks);

        // Load worker summary (name) from users and qualifications from byWorker
        const userDocRef = doc(db, 'users', auth.currentUser!.uid);
        const userSnap = await getDoc(userDocRef);
        const firstName = userSnap.exists() ? (userSnap.data() as any).firstName : '';
        const lastName = userSnap.exists() ? (userSnap.data() as any).lastName : '';

        // Read qualifications and preferences from byWorker
        const byWorkerRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', auth.currentUser!.uid);
        const byWorkerSnap = await getDoc(byWorkerRef);
        let qualifications: string[] = [];
        let preferencesFromByWorker: any[] = [];
        if (byWorkerSnap.exists()) {
          const bw = byWorkerSnap.data() as any;
          qualifications = bw.qualifications || [];
          preferencesFromByWorker = bw.preferences || [];
        }

        // Load department preferencesConfig
        try {
          const deptDocRef = doc(db, 'departments', departmentId);
          const deptSnap = await getDoc(deptDocRef);
          if (deptSnap.exists()) {
            const data = deptSnap.data() as any;
            const prefs = data.preferencesConfig || {};
            setMaxBlockedTasksPerWeek(
              prefs.maxBlockedTasksPerWeek === null || prefs.maxBlockedTasksPerWeek === undefined
                ? (prefs.maxBlockedTasksPerDay === null || prefs.maxBlockedTasksPerDay === undefined ? null : Number(prefs.maxBlockedTasksPerDay))
                : Number(prefs.maxBlockedTasksPerWeek)
            );
            const wc = prefs.weeklyCutoff || {};
            setWeeklyCutoff({
              enabled: Boolean(wc.enabled),
              dayOfWeek: (wc.dayOfWeek as DayOfWeek) || 'thu',
              hour: typeof wc.hour === 'number' ? wc.hour : 23,
              minute: typeof wc.minute === 'number' ? wc.minute : 59
            });
          }
        } catch (e) {
          // Non-fatal
        }

        const worker: Worker = {
          workerId: auth.currentUser!.uid,
          firstName: firstName,
          lastName: lastName,
          qualifications: qualifications || [],
          preferences: []
        };
        setCurrentWorker(worker);

        // Use preferences from byWorker
        const prefs = (preferencesFromByWorker || []).map((p: any) => ({ date: p.date, taskId: p.taskId ?? null, status: p.status || (p.taskId ? 'preferred' : 'blocked') }));
        setCurrentWorkerPreferences(prefs);
        console.log('✅ Loaded worker info, qualifications and preferences');

      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [departmentId]);

  // Compute disabled dates due to primary tasks (with hover tooltip)
  useEffect(() => {
    if (!departmentId || !auth.currentUser || !startDate || !endDate) return;

    const run = async () => {
      try {
        const schedules = await getPrimarySchedules(departmentId);
        const toLocalNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
        const fmt = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        const keyOf = (d: Date) => fmt(d);

        const rs = toLocalNoon(new Date(startDate));
        const re = toLocalNoon(new Date(endDate));
        const keys = new Set<string>();
        const tips = new Map<string, string>();

        for (const s of schedules) {
          const sStart = toLocalNoon(s.startDate);
          const sEnd = toLocalNoon(s.endDate);
          const overlaps = !(re < sStart || rs > sEnd);
          if (!overlaps) continue;
          const map = await getScheduleAssignments(departmentId, s.scheduleId);
          map.forEach((a) => {
            if (a.workerId !== auth.currentUser!.uid) return;
            // clip to range using local noon to avoid DST/UTC drift
            const aStart = toLocalNoon(a.startDate);
            const aEnd = toLocalNoon(a.endDate);
            const d0 = aStart < rs ? rs : aStart;
            const d1 = aEnd > re ? re : aEnd;
            const startStr = fmt(aStart);
            const endStr = fmt(aEnd);
            for (let cur = new Date(d0); cur.getTime() <= d1.getTime(); cur.setDate(cur.getDate() + 1)) {
              const k = keyOf(cur);
              keys.add(k);
              if (!tips.has(k)) tips.set(k, `לא ניתן לבחור: משימה ראשית ${startStr}–${endStr}`);
            }
          });
        }
        setDisabledDateKeys(keys);
        setDisabledTooltips(tips);

        // Apply locked-week window (disable those dates additionally)
        const locked = getLockedWeekWindow();
        if (locked) {
          const fmt = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
          const from = new Date(Math.max(locked.start.getTime(), rs.getTime()));
          const to = new Date(Math.min(locked.end.getTime(), re.getTime()));
          if (from.getTime() <= to.getTime()) {
            for (let cur = new Date(from); cur.getTime() <= to.getTime(); cur.setDate(cur.getDate() + 1)) {
              const k = fmt(cur);
              keys.add(k);
              tips.set(k, 'לא ניתן לבחור: חלון ההגשה לשבוע הקרוב נסגר');
            }
            setDisabledDateKeys(new Set(keys));
            setDisabledTooltips(new Map(tips));
          }
        }
      } catch (e) {
        console.warn('primaryTasks disable compute failed', e);
        setDisabledDateKeys(new Set());
        setDisabledTooltips(new Map());
      }
    };

    run();
  }, [departmentId, startDate, endDate]);

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
      if (prefDate < start || prefDate > end) return;

      const resolvedStatus: CellStatus = pref.status === 'blocked' ? 'blocked' : 'preferred';

      // If taskId is provided, update that specific task cell
      if (pref.taskId) {
        const key = getCellKey(pref.taskId, prefDate);
        const workerInCell = {
          workerId: currentWorker.workerId,
          workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
          status: resolvedStatus
        };
        newCellData.set(key, {
          workers: [workerInCell],
          taskId: pref.taskId,
          date: prefDate
        });
      } else {
        // Legacy or whole-day block without specific taskId: apply to all tasks
        tasks.forEach((t) => {
          const key = getCellKey(t.id, prefDate);
          const workerInCell = {
            workerId: currentWorker.workerId,
            workerName: `${currentWorker.firstName} ${currentWorker.lastName}`,
            status: 'blocked' as CellStatus
          };
          newCellData.set(key, {
            workers: [workerInCell],
            taskId: t.id,
            date: prefDate
          });
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

    // Weekly cutoff enforcement: after this week's cutoff passes, block NEXT week (Sun..Sat)
    const locked = getLockedWeekWindow();
    if (locked && clickedDate.getTime() >= locked.start.getTime() && clickedDate.getTime() <= locked.end.getTime()) {
      alert('המועד להגשת העדפות לשבוע הקרוב עבר. ניתן להגיש לשבועות הבאים.');
      return;
    }
    
    setSelectedCell({ taskId, date });
    setShowModal(true);
  };

  /**
   * Handle preference action from modal
   */
  const handlePreferenceAction = (action: PreferenceAction) => {
    if (!selectedCell) return;

    const workerId = currentWorker?.workerId || auth.currentUser?.uid || '';
    if (!workerId) return;
    const workerName = currentWorker ? `${currentWorker.firstName} ${currentWorker.lastName}` : '';

    const { taskId, date } = selectedCell;
    const key = getCellKey(taskId, date);
    const newCellData = new Map(cellData);

    if (action === 'clear') {
      // Remove ONLY current worker's preference for this cell
      const existingCell = newCellData.get(key);
      if (existingCell) {
        const updatedWorkers = existingCell.workers.filter(
          w => w.workerId !== workerId
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
        workerId: workerId,
        workerName: workerName,
        status: 'preferred' as CellStatus
      };

      if (existingCell) {
        // Check if current worker already has a preference here
        const workerIndex = existingCell.workers.findIndex(
          w => w.workerId === workerId
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
      // Enforce per-week max blocked tasks limit (ignore disabled-by-primary dates)
      if (maxBlockedTasksPerWeek !== null) {
        // Compute current week start/end (Sun..Sat)
        const base = new Date(date);
        const dow = base.getDay(); // 0..6
        const weekStart = new Date(base);
        weekStart.setDate(base.getDate() - dow);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const fmt = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

        const blockedCountThisWeek = Array.from(newCellData.values()).reduce((acc, cell) => {
          const cellDate = new Date(cell.date);
          // count only within the same week window
          if (cellDate.getTime() < weekStart.getTime() || cellDate.getTime() > weekEnd.getTime()) return acc;
          // skip primary-disabled dates
          const dateKey = fmt(cellDate);
          if (disabledDateKeys.has(dateKey)) return acc;
          // count this worker's blocked entries
          const workerRec = cell.workers.find(w => w.workerId === workerId);
          if (!workerRec) return acc;
          return workerRec.status === 'blocked' ? acc + 1 : acc;
        }, 0);

        const existingForThisTask = newCellData.get(key)?.workers.find(w => w.workerId === workerId && w.status === 'blocked');
        if (!existingForThisTask && blockedCountThisWeek >= maxBlockedTasksPerWeek) {
          alert('הגעת למספר המקסימלי של חסימות בשבוע');
          return;
        }
      }
      // Block this specific task on this date for current worker
      const existingCell = newCellData.get(key);
      const newWorkerData = {
        workerId: workerId,
        workerName: workerName,
        status: 'blocked' as CellStatus
      };

      if (existingCell) {
        const workerIndex = existingCell.workers.findIndex(
          w => w.workerId === workerId
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
      // Product decision: hide whole-day block UI when limit is active; as a safety, no-op here
      if (maxBlockedTasksPerWeek !== null) {
        alert('חסימת יום שלם אינה זמינה כאשר קיימת מגבלה יומית על חסימות.');
        setShowModal(false);
        setSelectedCell(null);
        return;
      }
      // If unlimited, apply legacy whole-day block behavior
      tasks.forEach(task => {
        const dayKey = getCellKey(task.id, date);
        const existingCell = newCellData.get(dayKey);
        const newWorkerData = {
          workerId: workerId,
          workerName: workerName,
          status: 'blocked' as CellStatus
        };

        if (existingCell) {
          const workerIndex = existingCell.workers.findIndex(
            w => w.workerId === workerId
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
      // Note: rangeStart/rangeEnd previously used for merging legacy data; no longer needed

      // Get today's date for validation
      const today = getTodayMidnight();

      // Existing preferences from workers doc are ignored; byWorker is the source of truth

      // Collect and normalize preferences per date (support both whole-day block and task-specific)
      type DayAgg = { blocked: Set<string>; preferred: Set<string> };
      const byDay = new Map<number, DayAgg>();

      const locked = getLockedWeekWindow();
      Array.from(cellData.values()).forEach((cell) => {
        const currentWorkerInCell = cell.workers.find(w => w.workerId === currentWorker.workerId);
        if (!currentWorkerInCell) return;

        const cellDate = new Date(cell.date);
        cellDate.setHours(0, 0, 0, 0);
        if (cellDate < today) return;
        if (locked && cellDate.getTime() >= locked.start.getTime() && cellDate.getTime() <= locked.end.getTime()) return; // skip locked upcoming week

        const key = cellDate.getTime();
        const group = byDay.get(key) || { blocked: new Set<string>(), preferred: new Set<string>() };
        if (currentWorkerInCell.status === 'blocked') {
          group.blocked.add(cell.taskId);
        } else if (currentWorkerInCell.status === 'preferred') {
          group.preferred.add(cell.taskId);
        }
        byDay.set(key, group);
      });

      const allTaskIds = (tasks || []).map(t => t.id);
      const newPreferencesInRange: { date: Timestamp; taskId: string | null; status: 'preferred' | 'blocked' }[] = [];
      byDay.forEach((group, key) => {
        const dateObj = new Date(key);
        const ts = Timestamp.fromDate(dateObj);
        // Whole-day block only when all tasks are blocked and no preferred tasks
        const isWholeDayBlocked = group.preferred.size === 0 && group.blocked.size === allTaskIds.length && allTaskIds.length > 0;
        if (isWholeDayBlocked) {
          newPreferencesInRange.push({ date: ts, taskId: null, status: 'blocked' });
        } else {
          // Task-specific blocked entries
          group.blocked.forEach(taskId => {
            newPreferencesInRange.push({ date: ts, taskId, status: 'blocked' });
          });
          // Preferred entries
          group.preferred.forEach(taskId => {
            newPreferencesInRange.push({ date: ts, taskId, status: 'preferred' });
          });
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

      // Merge-by-date inside the selected range only (update only changed days)
      const { setWorkerPreferencesByWorkerForRange } = await import('../../lib/firestore/workers');
      await setWorkerPreferencesByWorkerForRange(
        departmentId,
        currentWorker.workerId,
        new Date(startDate),
        new Date(endDate),
        newPreferencesInRange as any
      );

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
            <div className="mt-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm"
              >
                {isRefreshing ? '⏳ מרענן…' : '🔄 רענן נתונים'}
              </button>
            </div>
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
                disabledDates={disabledDateKeys}
                disabledTooltips={disabledTooltips}
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
              
              {/* Hide whole-day block when weekly limit is active */}
              {maxBlockedTasksPerWeek === null && (
                <button
                  onClick={() => handlePreferenceAction('blockDay')}
                  className="w-full bg-red-600/80 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">✕</span>
                  <span>חסום יום שלם</span>
                </button>
              )}
              
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

