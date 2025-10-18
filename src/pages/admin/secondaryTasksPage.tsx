/**
 * Admin Secondary Tasks Page
 * Independent admin UI for secondary tasks (separate from worker preferences).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Timestamp, collection, doc, getDoc, getDocs, setDoc, orderBy, query, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';
import Button from '../../components/ui/Button';
import SaveProgress from '../../components/ui/SaveProgress';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import SecondaryTaskTable, { SecondaryTask, CellData, WorkerInCell, getCellKey } from '../../components/shared/SecondaryTaskTable';
import { getTaskDefinitions } from '../../lib/firestore/taskDefinitions';
import { ClosingScheduleCalculator } from '../../lib/utils/closingScheduleCalculator';
import { generateSecondarySchedule } from '../../lib/utils/secondaryScheduleEngine';
import { formatDateDDMMYYYY } from '../../lib/utils/dateUtils';
import { updateSummaryForSecondarySave } from '../../lib/firestore/statistics';


const AdminSecondaryTasksPage: React.FC = () => {
  const location = useLocation();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [tasks, setTasks] = useState<SecondaryTask[]>([]);
  const [customTasks, setCustomTasks] = useState<SecondaryTask[]>([]);
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  const [assignedByDate, setAssignedByDate] = useState<Record<string, Set<string>>>({});
  const [currentSecondaryScheduleId, setCurrentSecondaryScheduleId] = useState<string | null>(null);
  const [pastSchedules, setPastSchedules] = useState<Array<{ id: string; startDate: Date; endDate: Date; updatedAt: Date }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ phase: 'idle'|'writingSchedule'|'updatingLedgers'|'updatingStats'|'done'; processed: number; total: number }>({ phase: 'idle', processed: 0, total: 0 });

  // Selection modal state
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionTask, setSelectionTask] = useState<SecondaryTask | null>(null);
  const [selectionDate, setSelectionDate] = useState<Date | null>(null);
  const [selectionLists, setSelectionLists] = useState<{
    preferred: Array<{ workerId: string; name: string; note?: string }>;
    neutral: Array<{ workerId: string; name: string; note?: string }>;
    blocked: Array<{ workerId: string; name: string; note?: string }>;
    assigned: Array<{ workerId: string; name: string; note?: string }>;
    primaryBusy: Array<{ workerId: string; name: string; primaryTaskName: string }>; 
    currentAssigned?: { workerId: string; name: string } | null;
  }>({ preferred: [], neutral: [], blocked: [], assigned: [], primaryBusy: [], currentAssigned: null });

  useEffect(() => {
    const fetchDept = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const u = userDoc.data() as any;
          if (u.departmentId) setDepartmentId(u.departmentId as string);
        }
      } catch (e) {
        console.error('שגיאה בטעינת מחלקה:', e);
      }
    };
    fetchDept();
  }, []);

  // Prefill from query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD&autoload=1
  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const s = params.get('start');
        const e = params.get('end');
        const autoload = params.get('autoload');
        if (s) setStartDate(s);
        if (e) setEndDate(e);
        if (autoload === '1' && s && e && departmentId) {
          const [sy, sm, sd] = s.split('-').map(Number);
          const [ey, em, ed] = e.split('-').map(Number);
          const rangeStart = new Date(sy, sm - 1, sd);
          const rangeEnd = new Date(ey, em - 1, ed);
          // Find most recent overlapping secondary schedule and load it
          try {
            const colRef = collection(db, 'departments', departmentId, 'secondarySchedules');
            const snap = await getDocs(colRef);
            let best: { id: string; updatedAt: Date } | null = null;
            snap.forEach((d) => {
              const data = d.data() as any;
              const sdTs = (data.startDate as Timestamp | undefined)?.toDate();
              const edTs = (data.endDate as Timestamp | undefined)?.toDate();
              if (!sdTs || !edTs) return;
              const overlap = (
                (rangeStart >= sdTs && rangeStart <= edTs) ||
                (rangeEnd >= sdTs && rangeEnd <= edTs) ||
                (rangeStart <= sdTs && rangeEnd >= edTs)
              );
              if (!overlap) return;
              const up = (data.updatedAt as Timestamp | undefined)?.toDate() || new Date(0);
              if (!best || up > best.updatedAt) best = { id: d.id, updatedAt: up };
            });
            if (best) {
              const selectedId = (best as { id: string; updatedAt: Date }).id;
              await handleSelectPastSchedule(selectedId);
            }
          } catch {}
        }
      } catch {}
    };
    run();
  }, [location.search, departmentId]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!departmentId) return;
      try {
        // Use centralized cache with realtime updates
        const defs = await getTaskDefinitions(departmentId);
        const mapped: SecondaryTask[] = (defs?.secondary_tasks?.definitions || []).map((d: any) => ({
          id: String(d.id),
          name: String(d.name),
          requiresQualification: Boolean(d.requiresQualification),
          autoAssign: Boolean(d.autoAssign),
          assign_weekends: Boolean(d.assign_weekends)
        }));
        setTasks(mapped);
      } catch (e) {
        console.error('שגיאה בטעינת משימות:', e);
        setTasks([]);
      }
    };
    fetchTasks();
  }, [departmentId]);

  // Utility helpers for planning window and weekend logic
  function addMonths(base: Date, months: number): Date {
    const d = new Date(base);
    const day = d.getDate();
    d.setDate(15);
    d.setMonth(d.getMonth() + months);
    return new Date(d.getFullYear(), d.getMonth(), Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }

  function getAllFridaysInRange(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    const d = new Date(start);
    d.setHours(12, 0, 0, 0);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 7); }
    return out;
  }

  /* function spansThuFriSat(startDate: Date, endDate: Date): boolean {
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
    const d = new Date(s);
    let hasThu = false, hasFri = false, hasSat = false;
    while (d <= e) {
      const dow = d.getDay();
      if (dow === 4) hasThu = true;
      if (dow === 5) hasFri = true;
      if (dow === 6) hasSat = true;
      if (hasThu && hasFri && hasSat) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  } */

  /* function fridaysInsideSpan(startDate: Date, endDate: Date): Date[] {
    const out: Date[] = [];
    const d = new Date(startDate);
    d.setHours(12, 0, 0, 0);
    while (d <= endDate) { if (d.getDay() === 5) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  } */

  // Main planning loader: fetch → compute → store → console.debug
  useEffect(() => {
    const run = async () => {
      if (!departmentId || !startDate || !endDate) return;
      try {
        // loading state intentionally omitted from UI for now

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const rangeStart = new Date(sy, sm - 1, sd);
        const rangeEnd = new Date(ey, em - 1, ed);

        const windowStart = addMonths(rangeStart, -2);
        const windowEnd = addMonths(rangeEnd, 2);
        const fridays = getAllFridaysInRange(windowStart, windowEnd);

        // 1) Consolidated workers map (names, interval, quals) from departments/{dep}/workers/index
        const workersIndexSnap = await getDoc(doc(db, 'departments', departmentId, 'workers', 'index'));
        const workersIndex = (workersIndexSnap.exists() ? (workersIndexSnap.data() as any).workers || {} : {}) as Record<string, any>;
        // Exclude owners from all downstream computations and the local save
        const eligibleWorkerIds = Object.keys(workersIndex).filter((wid) => {
          const w = workersIndex[wid];
          if (!w) return false;
          if (w.activity && w.activity !== 'active') return false;
          if ((w.role || '').toLowerCase && (w.role || '').toLowerCase() === 'owner') return false;
          return true;
        });

        // 2) Read byWorker docs once (preferences + ledgers)
        const byWorkerSnap = await getDocs(collection(db, 'departments', departmentId, 'workers', 'index', 'byWorker'));
        const prefsByWorker: Record<string, Array<{ date: string; taskId: string | null; status?: 'preferred' | 'blocked' }>> = {};
        const mandatoryByWorker: Record<string, string[]> = {};
        const primaryBusyDaysByWorker: Record<string, Set<string>> = {};
        const lastClosingFridayByWorker: Record<string, string | null> = {};
        byWorkerSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          // Preferences filtered to window
          const arr = (data?.preferences || []) as Array<{ date: Timestamp; taskId: string | null; status?: 'preferred' | 'blocked' }>;
          const filtered = arr
            .map((p) => ({ date: (p.date as Timestamp).toDate() as Date, taskId: p.taskId ?? null, status: p.status }))
            .filter((p) => p.date >= windowStart && p.date <= windowEnd)
            .map((p) => ({ date: formatDateDDMMYYYY(p.date), taskId: p.taskId, status: p.status }));
          prefsByWorker[docSnap.id] = filtered;

          // Mandatory closings based on ledgers (source: 'primary' only)
          type ClosingEntry = { friday: Timestamp; source: 'primary'|'secondary'; scheduleId: string };
          const history: ClosingEntry[] = Array.isArray(data?.closingHistory) ? data.closingHistory : [];
          const future: ClosingEntry[] = Array.isArray(data?.futureClosings) ? data.futureClosings : [];
          const all = [...history, ...future];
          const fridaysPrimary = all
            .filter((e) => e && e.source === 'primary')
            .map((e) => (e.friday as Timestamp).toDate())
            .filter((d) => d >= windowStart && d <= windowEnd)
            .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
          const ddmm = Array.from(new Set(fridaysPrimary.map((d) => formatDateDDMMYYYY(d)))).sort((a, b) => {
            const [da, ma, ya] = a.split('/').map(Number);
            const [db, mb, yb] = b.split('/').map(Number);
            return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
          });
          mandatoryByWorker[docSnap.id] = ddmm;

          // Primary busy days (Thu/Fri/Sat) derived from primary closing Fridays
          const busy = new Set<string>();
          fridaysPrimary.forEach((fr) => {
            const thu = new Date(fr); thu.setDate(thu.getDate() - 1);
            const sat = new Date(fr); sat.setDate(sat.getDate() + 1);
            [thu, fr, sat].forEach((d) => {
              if (d >= windowStart && d <= windowEnd) busy.add(formatDateDDMMYYYY(d));
            });
          });
          primaryBusyDaysByWorker[docSnap.id] = busy;

          // Last closing date (any source) for recency checks
          const lastTs = (data?.lastClosingDate as Timestamp | undefined);
          lastClosingFridayByWorker[docSnap.id] = lastTs ? formatDateDDMMYYYY(lastTs.toDate()) : null;
        });

        // 3) Optimal closing dates via calculator for the window Fridays (required = primary closings from ledger)
        const calc = new ClosingScheduleCalculator();
        const optimalByWorker: Record<string, string[]> = {};
        eligibleWorkerIds.forEach((wid) => {
          const entry = workersIndex[wid];
          const interval: number = typeof entry.closingInterval === 'number' ? entry.closingInterval : 0;
          if (interval === 0) { optimalByWorker[wid] = []; return; }
          const requiredDates = (mandatoryByWorker[wid] || []).map((k) => {
            const [d, m, y] = k.split('/').map(Number);
            return new Date(y, m - 1, d);
          });
          const res = calc.calculateWorkerSchedule({
            workerId: wid,
            workerName: `${entry.firstName || ''} ${entry.lastName || ''}`.trim() || wid,
            closingInterval: interval,
            mandatoryClosingDates: requiredDates
          }, fridays);
          optimalByWorker[wid] = res.optimalDates.map((d) => formatDateDDMMYYYY(d));
        });

        // 4) Pull statistics summary (per-worker minimal fields)
        let statsPerWorker: Record<string, { totalSecondary?: number; closingAccuracyPct?: number | null }> = {};
        try {
          const sumSnap = await getDoc(doc(db, 'departments', departmentId, 'statistics', 'summary'));
          const sum = (sumSnap.exists() ? (sumSnap.data() as any) : null) as any;
          if (sum && sum.perWorker) {
            Object.entries(sum.perWorker as Record<string, any>).forEach(([wid, entry]) => {
              statsPerWorker[wid] = {
                totalSecondary: typeof entry.totalSecondary === 'number' ? entry.totalSecondary : 0,
                closingAccuracyPct: typeof entry.closingAccuracyPct === 'number' ? entry.closingAccuracyPct : null,
              };
            });
          }
        } catch {}

        // 5) Build local payload and save to localStorage (schedule-free)
        const payload = {
          generatedAt: new Date().toISOString(),
          departmentId,
          selectedRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
          window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
          fridays: fridays.map((d) => formatDateDDMMYYYY(d)),
          schedulesUsed: [],
          stats: { updatedAt: new Date().toISOString(), perWorker: statsPerWorker },
          workers: eligibleWorkerIds.reduce((acc: Record<string, any>, wid) => {
            const w = workersIndex[wid];
            acc[wid] = {
              profile: {
                firstName: w.firstName || '',
                lastName: w.lastName || '',
                closingInterval: typeof w.closingInterval === 'number' ? w.closingInterval : 0,
                qualifications: Array.isArray(w.qualifications) ? w.qualifications : []
              },
              primaryTasks: [],
              primaryBusyDaysDDMM: Array.from(primaryBusyDaysByWorker[wid] || new Set<string>()),
              mandatoryClosingDates: mandatoryByWorker[wid] || [],
              optimalClosingDates: optimalByWorker[wid] || [],
              lastClosingFridayDDMM: lastClosingFridayByWorker[wid] || null,
              preferencesInWindow: prefsByWorker[wid] || []
            };
            return acc;
          }, {})
        };

        const key = `secondaryPlanning:${departmentId}`;
        try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}

        // 6) Debug output
        try {
          /* eslint-disable no-console */
          console.groupCollapsed('[SecondaryPlanning] Saved to localStorage');
          console.log('key:', key);
          console.log('schedulesUsed:', payload.schedulesUsed);
          console.log('fridaysCount:', payload.fridays.length);
          const workerIds = Object.keys(payload.workers);
          console.log('workersCount:', workerIds.length);
          // Print all workers with concise counters
          workerIds.forEach((wid) => {
            const w = payload.workers[wid];
            const name = `${w.profile.firstName || ''} ${w.profile.lastName || ''}`.trim() || wid;
            console.log('[Worker]', wid, name, {
              closingInterval: w.profile.closingInterval,
              qualifications: w.profile.qualifications?.length || 0,
              mandatoryClosingDates: (w.mandatoryClosingDates || []).length,
              optimalClosingDates: (w.optimalClosingDates || []).length,
              preferencesInWindow: (w.preferencesInWindow || []).length
            });
          });
          // Also print the full JSON payload for verification
          console.log('[Payload JSON]', JSON.stringify(payload, null, 2));
          console.groupEnd();
          /* eslint-enable no-console */
        } catch {}

      } catch (e) {
        try { console.error('[SecondaryPlanning] load/store error', e); } catch {}
      } finally {
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, startDate, endDate]);

  const visibleTasks = useMemo(() => [...tasks, ...customTasks], [tasks, customTasks]);
  const allTaskIds = useMemo(() => visibleTasks.map(t => t.id), [visibleTasks]);
  const hasAtLeastOneRenderableAssignment = useMemo(() => {
    for (const [, cell] of cellData) {
      if (cell.workers.some(w => w.status === 'assigned')) return true;
      const preferredCount = cell.workers.filter(w => w.status === 'preferred').length;
      if (preferredCount === 1) return true;
    }
    return false;
  }, [cellData]);
  const canSave = Boolean(startDate && endDate && hasAtLeastOneRenderableAssignment);
  const hasAnyAmbiguousCell = useMemo(() => {
    for (const [, cell] of cellData) {
      const preferredCount = cell.workers.filter(w => w.status === 'preferred').length;
      if (preferredCount > 1) return true;
    }
    return false;
  }, [cellData]);

  const handleAddCustomTask = () => {
    const trimmed = newTaskName.trim();
    if (!trimmed) return;
    const newTask: SecondaryTask = {
      id: `custom-${Math.random().toString(36).slice(2, 9)}`,
      name: trimmed,
      requiresQualification: false,
      autoAssign: false,
      assign_weekends: false
    };
    setCustomTasks(prev => [...prev, newTask]);
    setNewTaskName('');
    setShowAddTaskModal(false);
  };

  // Fetch list of past secondary schedules
  useEffect(() => {
    const run = async () => {
      if (!departmentId) return;
      try {
        const colRef = collection(db, 'departments', departmentId, 'secondarySchedules');
        const q = query(colRef, orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        const list: Array<{ id: string; startDate: Date; endDate: Date; updatedAt: Date }> = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const sd = (data.startDate as Timestamp | undefined)?.toDate();
          const ed = (data.endDate as Timestamp | undefined)?.toDate();
          const up = (data.updatedAt as Timestamp | undefined)?.toDate() || new Date(0);
          if (sd && ed) list.push({ id: d.id, startDate: sd, endDate: ed, updatedAt: up });
        });
        setPastSchedules(list);
      } catch (e) {
        console.warn('שגיאה בטעינת סידורים משניים קיימים:', e);
      }
    };
    run();
  }, [departmentId]);

  const toInputDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSelectPastSchedule = async (scheduleId: string) => {
    if (!departmentId) return;
    try {
      const ref = doc(db, 'departments', departmentId, 'secondarySchedules', scheduleId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as any;

      const sd = (data.startDate as Timestamp).toDate();
      const ed = (data.endDate as Timestamp).toDate();
      setStartDate(toInputDate(sd));
      setEndDate(toInputDate(ed));

      const map = new Map<string, CellData>();
      const assignments: Record<string, any> = data.assignmentsMap || {};
      Object.entries(assignments).forEach(([key, a]) => {
        const ts = (a as any).date as Timestamp | undefined;
        const date = ts ? ts.toDate() : null;
        if (!date) return;
        const taskId = String((a as any).taskId || '');
        const workerId = String((a as any).workerId || '');
        const workerName = String((a as any).workerName || workerId);
        if (!taskId || !workerId) return;
        map.set(key, {
          taskId,
          date,
          workers: [{ workerId, workerName, status: 'assigned' } as WorkerInCell]
        });
      });

      // rebuild assignedByDate
      const newAssigned: Record<string, Set<string>> = {};
      map.forEach((cell) => {
        const assigned = cell.workers.find(w => w.status === 'assigned');
        if (!assigned) return;
        const ds = formatDateDDMMYYYY(cell.date);
        const setForDate = newAssigned[ds] ? new Set(newAssigned[ds]) : new Set<string>();
        setForDate.add(assigned.workerId);
        newAssigned[ds] = setForDate;
      });

      setCellData(map);
      setAssignedByDate(newAssigned);
      setCurrentSecondaryScheduleId(scheduleId);
    } catch (e) {
      console.error('שגיאה בטעינת סידור משני שמור:', e);
    }
  };

  // Helpers for cache access
  const getPlanningCache = (): any | null => {
    if (!departmentId) return null;
    const key = `secondaryPlanning:${departmentId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const generatedAt = parsed?.generatedAt ? new Date(parsed.generatedAt).getTime() : 0;
      const ttlOk = generatedAt > 0 ? (Date.now() - generatedAt) < (5 * 60 * 1000) : true; // 5 minutes TTL
      return ttlOk ? parsed : null;
    } catch {
      return null;
    }
  };

  const withinSelectedRange = (d: string): boolean => {
    if (!startDate || !endDate) return false;
    const [sdY, sdM, sdD] = startDate.split('-').map(Number);
    const [edY, edM, edD] = endDate.split('-').map(Number);
    const s = new Date(sdY, sdM - 1, sdD).getTime();
    const e = new Date(edY, edM - 1, edD).getTime();
    const [dd, mm, yy] = d.split('/').map(Number);
    const dt = new Date(yy, mm - 1, dd).getTime();
    return dt >= s && dt <= e;
  };

  // Load preferences into the table cells
  const handleLoadPreferences = () => {
    const cache = getPlanningCache();
    if (!cache) {
      try { alert('לא נמצאו נתונים. בחר טווח תאריכים כדי לטעון נתונים מחדש.'); } catch {}
      return;
    }

    const newMap: Map<string, CellData> = new Map();

    Object.entries(cache.workers as Record<string, any>).forEach(([wid, w]) => {
      const profile = w.profile || {};
      const quals: string[] = Array.isArray(profile.qualifications) ? profile.qualifications : [];
      const prefs: Array<{ date: string; taskId: string | null; status?: 'preferred' | 'blocked' }> = w.preferencesInWindow || [];

      prefs.forEach((p) => {
        if (!withinSelectedRange(p.date)) return;
        if (!p.taskId || p.status === 'blocked') return; // skip blocked/all-task blocks
        const task = visibleTasks.find(t => String(t.id) === String(p.taskId));
        if (!task) return;
        if (task.requiresQualification && !quals.includes(task.id)) return; // respect qualification

        const [d, m, y] = p.date.split('/').map(Number);
        const cellDate = new Date(y, m - 1, d);
        const key = getCellKey(task.id, cellDate);
        const existing = newMap.get(key);
        const workerName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || wid;
        const worker: WorkerInCell = { workerId: wid, workerName, status: 'preferred' } as WorkerInCell;
        if (existing) {
          existing.workers.push(worker);
        } else {
          newMap.set(key, { taskId: task.id, date: cellDate, workers: [worker] });
        }
      });
    });

    setCellData(newMap);
    // reset assignedByDate based on current assignments in map (none at this stage)
    setAssignedByDate({});
  };

  const assignWorkerToCell = (wid: string, name: string, task: SecondaryTask, date: Date) => {
    const key = getCellKey(task.id, date);
    // warn if already assigned elsewhere on same date
    const ds = formatDateDDMMYYYY(date);
    const assignedSet = assignedByDate[ds] || new Set<string>();
    if (assignedSet.has(wid)) {
      try {
        const proceed = confirm('אזהרה: העובד כבר שובץ למשימה אחרת בתאריך זה. לשבץ בכל זאת?');
        if (!proceed) return;
      } catch {}
    }

    const updated = new Map(cellData);
    updated.set(key, { taskId: task.id, date, workers: [{ workerId: wid, workerName: name, status: 'assigned' }] as WorkerInCell[] });
    setCellData(updated);

    // update assignedByDate
    const newAssigned = { ...assignedByDate };
    const setForDate = newAssigned[ds] ? new Set(newAssigned[ds]) : new Set<string>();
    setForDate.add(wid);
    newAssigned[ds] = setForDate;
    setAssignedByDate(newAssigned);
    setSelectionOpen(false);
  };

  const removeAssignmentFromCell = (task: SecondaryTask, date: Date) => {
    const key = getCellKey(task.id, date);
    const existing = cellData.get(key);
    if (!existing) { setSelectionOpen(false); return; }
    const assigned = existing.workers.find(w => w.status === 'assigned');
    const updated = new Map(cellData);
    updated.delete(key);
    setCellData(updated);
    if (assigned) {
      const ds = formatDateDDMMYYYY(date);
      const newAssigned = { ...assignedByDate };
      const setForDate = newAssigned[ds] ? new Set(newAssigned[ds]) : new Set<string>();
      setForDate.delete(assigned.workerId);
      newAssigned[ds] = setForDate;
      setAssignedByDate(newAssigned);
    }
    setSelectionOpen(false);
  };

  const handleCellClick = (taskId: string, date: Date) => {
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;
    const cache = getPlanningCache();
    if (!cache) {
      try { alert('לא נמצאו נתונים. בחר טווח תאריכים כדי לטעון נתונים מחדש.'); } catch {}
      return;
    }

    const dateKey = formatDateDDMMYYYY(date);
    const assignedSet = assignedByDate[dateKey] || new Set<string>();
    const currentCellKey = getCellKey(taskId, date);
    const currentCell = cellData.get(currentCellKey);
    const currentAssigned = currentCell?.workers.find(w => w.status === 'assigned');

    // Build lists
    const preferred: Array<{ workerId: string; name: string; note?: string }> = [];
    const neutral: Array<{ workerId: string; name: string; note?: string }> = [];
    const blocked: Array<{ workerId: string; name: string; note?: string }> = [];
    const assigned: Array<{ workerId: string; name: string; note?: string }> = [];
    const primaryBusy: Array<{ workerId: string; name: string; primaryTaskName: string }> = [];

    Object.entries(cache.workers as Record<string, any>).forEach(([wid, w]) => {
      const profile = w.profile || {};
      const active = w.activity ? w.activity === 'active' : true;
      if (!active) return;
      const quals: string[] = Array.isArray(profile.qualifications) ? profile.qualifications : [];
      if (task.requiresQualification && !quals.includes(task.id)) return;
      const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || wid;
      const prefs: Array<{ date: string; taskId: string | null; status?: 'preferred' | 'blocked' }> = w.preferencesInWindow || [];
      const prefForDate = prefs.find(p => p.date === dateKey);
      const primaryTasks: Array<{ taskId: string; taskName: string; startDate: string; endDate: string }> = Array.isArray(w.primaryTasks) ? w.primaryTasks : [];
      const hasPrimaryToday = primaryTasks.find(pt => {
        const s = new Date(pt.startDate);
        const e = new Date(pt.endDate);
        const d = new Date(date);
        d.setHours(12,0,0,0);
        return d >= s && d <= e;
      });

      // Skip the worker if currently assigned to this exact cell (will be exposed via remove button)
      if (currentAssigned && currentAssigned.workerId === wid) return;

      const isAssignedElsewhere = assignedSet.has(wid);

      if (hasPrimaryToday) {
        primaryBusy.push({ workerId: wid, name, primaryTaskName: hasPrimaryToday.taskName || 'משימה ראשית' });
        return;
      }

      if (prefForDate && (prefForDate.status === 'blocked' || prefForDate.taskId === null)) {
        blocked.push({ workerId: wid, name });
        return;
      }

      if (prefForDate && prefForDate.taskId === task.id && prefForDate.status !== 'blocked') {
        if (isAssignedElsewhere) {
          assigned.push({ workerId: wid, name, note: 'משובץ' });
        } else {
          preferred.push({ workerId: wid, name });
        }
        return;
      }

      // No preference for this date OR different task chosen
      const note = prefForDate && prefForDate.taskId && prefForDate.taskId !== task.id ? 'העדיף משימה אחרת' : undefined;
      if (isAssignedElsewhere) {
        assigned.push({ workerId: wid, name, note });
      } else {
        neutral.push({ workerId: wid, name, note });
      }
    });

    // Sort neutral alphabetically by first name
    neutral.sort((a, b) => a.name.localeCompare(b.name, 'he'));

    setSelectionTask(task);
    setSelectionDate(date);
    setSelectionLists({ preferred, neutral, blocked, assigned, primaryBusy, currentAssigned: currentAssigned ? { workerId: currentAssigned.workerId, name: currentAssigned.workerName } : null });
    setSelectionOpen(true);
  };

  const handleClearAll = () => {
    setCellData(new Map());
    setAssignedByDate({});
  };

  // Auto-assign using the in-file engine
  const handleAutoAssign = () => {
    try {
      if (!departmentId || !startDate || !endDate) {
        try { alert('נא לבחור מחלקה וטווח תאריכים לפני שיבוץ אוטומטי'); } catch {}
        return;
      }

      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const rangeStart = new Date(sy, sm - 1, sd);
      const rangeEnd = new Date(ey, em - 1, ed);

      const plan = generateSecondarySchedule(
        departmentId,
        rangeStart,
        rangeEnd,
        visibleTasks,
        { skipManualOnlyTasks: true }
      );

      // Paint plan into table (merge into existing UI picks and preferences)
      const newMap: Map<string, CellData> = new Map(cellData);
      plan.assignments.forEach((a) => {
        const [dd, mm, yy] = a.date.split('/').map(Number);
        const date = new Date(yy, mm - 1, dd);
        const key = getCellKey(a.taskId, date);
        const existing = newMap.get(key);
        const workerId = a.workerId;
        // Worker name is not present in plan; pull from cache for display
        const cache = getPlanningCache();
        const w = cache?.workers?.[workerId];
        const workerName = w ? `${w.profile?.firstName || ''} ${w.profile?.lastName || ''}`.trim() || workerId : workerId;
        const worker: WorkerInCell = { workerId, workerName, status: 'assigned' } as WorkerInCell;
        if (existing) {
          // Respect existing explicit admin assignment; otherwise set assigned
          const alreadyAssigned = existing.workers.find((x) => x.status === 'assigned');
          if (!alreadyAssigned) existing.workers = [worker];
        } else {
          newMap.set(key, { taskId: a.taskId, date, workers: [worker] });
        }
      });

      setCellData(newMap);

      // Rebuild assignedByDate
      const newAssigned: Record<string, Set<string>> = {};
      newMap.forEach((cell) => {
        const assigned = cell.workers.find(w => w.status === 'assigned');
        if (!assigned) return;
        const ds = formatDateDDMMYYYY(cell.date);
        const setForDate = newAssigned[ds] ? new Set(newAssigned[ds]) : new Set<string>();
        setForDate.add(assigned.workerId);
        newAssigned[ds] = setForDate;
      });
      setAssignedByDate(newAssigned);

      // Diagnostics to console
      try {
        /* eslint-disable no-console */
        console.groupCollapsed('[Secondary AUTO] Diagnostics');
        console.log('warnings:', plan.warnings);
        console.log('logs:', plan.logs);
        console.log('closersByFriday:', plan.closersByFriday);
        console.groupEnd();
        /* eslint-enable no-console */
      } catch {}

      // Only show warnings; no success toast
      if (plan.warnings.length > 0) {
        try { alert('הושלם עם אזהרות. בדוק את הקונסול לפרטים.'); } catch {}
      }
    } catch (e) {
      console.error('Auto-assign failed', e);
      try { alert('שגיאה בשיבוץ האוטומטי'); } catch {}
    }
  };

  const reloadPastSchedules = async () => {
    if (!departmentId) return;
    try {
      const colRef = collection(db, 'departments', departmentId, 'secondarySchedules');
      const q = query(colRef, orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const list: Array<{ id: string; startDate: Date; endDate: Date; updatedAt: Date }> = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const sd = (data.startDate as Timestamp | undefined)?.toDate();
        const ed = (data.endDate as Timestamp | undefined)?.toDate();
        const up = (data.updatedAt as Timestamp | undefined)?.toDate() || new Date(0);
        if (sd && ed) list.push({ id: d.id, startDate: sd, endDate: ed, updatedAt: up });
      });
      setPastSchedules(list);
    } catch {}
  };

  const hasOverlapSecondary = async (rangeStart: Date, rangeEnd: Date, excludeId?: string): Promise<boolean> => {
    try {
      const colRef = collection(db, 'departments', departmentId, 'secondarySchedules');
      const snap = await getDocs(colRef);
      for (const docSnap of snap.docs) {
        if (excludeId && docSnap.id === excludeId) continue;
        const data = docSnap.data() as any;
        const sd = (data.startDate as Timestamp | undefined)?.toDate();
        const ed = (data.endDate as Timestamp | undefined)?.toDate();
        if (!sd || !ed) continue;
        if (
          (rangeStart >= sd && rangeStart <= ed) ||
          (rangeEnd >= sd && rangeEnd <= ed) ||
          (rangeStart <= sd && rangeEnd >= ed)
        ) {
          return true;
        }
      }
    } catch (e) {
      console.warn('Overlap check failed (secondarySchedules):', e);
    }
    return false;
  };

  const handleSave = async () => {
    if (!departmentId || !startDate || !endDate) {
      try { alert('נא לבחור מחלקה וטווח תאריכים לפני שמירה'); } catch {}
      return;
    }

    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const rangeStart = new Date(sy, sm - 1, sd);
    const rangeEnd = new Date(ey, em - 1, ed);

    // Build new assignments object from what the UI renders as a final choice:
    // 1) Explicit assigned workers
    // 2) Exactly one preferred worker in a cell (auto-resolve to that worker)
    const newAssignments: Record<string, any> = {};
    cellData.forEach((cell, key) => {
      let chosen: WorkerInCell | undefined = cell.workers.find(w => w.status === 'assigned');
      if (!chosen) {
        const preferred = cell.workers.filter(w => w.status === 'preferred');
        if (preferred.length === 1) chosen = preferred[0];
      }
      if (!chosen) return;
      newAssignments[key] = {
        taskId: cell.taskId,
        workerId: chosen.workerId,
        workerName: chosen.workerName,
        date: Timestamp.fromDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate())),
      };
    });

    // Warn if table has empty cells within the selected range
    if (Object.keys(newAssignments).length === 0) {
      try { alert('אין שיבוצים לשמירה. מלא לפחות תא אחד או טען העדפות.'); } catch {}
      return;
    }

    // Ambiguous cells gate with override option
    if (hasAnyAmbiguousCell) {
      const ok = confirm('יש תאים עם "..." (יותר מהעדפה אחת). האם לשמור בכל זאת?');
      if (!ok) return;
    }

    try {
      setIsSaving(true);
      setSaveProgress({ phase: 'writingSchedule', processed: 0, total: 1 });
      const colRef = collection(db, 'departments', departmentId, 'secondarySchedules');

      // Decide whether to update existing or create new: if existing range differs, create new
      let scheduleRef: ReturnType<typeof doc> | null = currentSecondaryScheduleId ? doc(colRef, currentSecondaryScheduleId) : null;
      let isUpdate = false;

      if (scheduleRef) {
        const existingSnap = await getDoc(scheduleRef);
        if (existingSnap.exists()) {
          const data = existingSnap.data() as any;
          const es = (data.startDate as Timestamp | undefined)?.toDate();
          const ee = (data.endDate as Timestamp | undefined)?.toDate();
          if (es && ee && es.getTime() === rangeStart.getTime() && ee.getTime() === rangeEnd.getTime()) {
            isUpdate = true;
          }
        }
      }

      if (!isUpdate) {
        // Check overlap with existing secondary schedules (no excludeId)
        if (await hasOverlapSecondary(rangeStart, rangeEnd)) {
          try { alert('קיימת חפיפה עם סידור משני קיים. עדכן טווח תאריכים או ערוך את הסידור הקיים.'); } catch {}
          return;
        }
        scheduleRef = doc(colRef);
        await setDoc(scheduleRef, {
          scheduleId: scheduleRef.id,
          type: 'secondary',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: auth.currentUser?.uid || 'unknown',
          startDate: Timestamp.fromDate(rangeStart),
          endDate: Timestamp.fromDate(rangeEnd),
          assignmentsMap: Object.keys(newAssignments).reduce((acc, k) => {
            acc[k] = { ...newAssignments[k], createdAt: Timestamp.now(), updatedAt: Timestamp.now(), updatedBy: auth.currentUser?.uid || 'unknown' };
            return acc;
          }, {} as Record<string, any>)
        });
        setCurrentSecondaryScheduleId(scheduleRef.id);
        await reloadPastSchedules();
        // Update byWorker ledgers for weekend closings (secondary)
        setSaveProgress({ phase: 'updatingLedgers', processed: 0, total: Object.keys(newAssignments).length || 1 });
        const affected = Array.from(new Set(Object.values(newAssignments).map((a) => String(a.workerId || '').trim()).filter(Boolean)));
        await updateByWorkerClosingsForSecondary(scheduleRef.id, newAssignments, departmentId, visibleTasks, affected);
        // Update department statistics summary (secondary deltas)
        setSaveProgress((p) => ({ ...p, phase: 'updatingStats' }));
        try { await updateSummaryForSecondarySave(departmentId, undefined, newAssignments); } catch {}
      } else {
        // Capture previous assignments BEFORE overwrite for proper deltas and affected workers
        const prevSnap = await getDoc(scheduleRef as any);
        const existing = (prevSnap.exists() ? (prevSnap.data() as any) : {}) || {};
        const prevAssignments = (existing.assignmentsMap || {}) as Record<string, { workerId: string; taskId: string; date: Timestamp }>;
        const createdAt: Timestamp = existing.createdAt || Timestamp.now();
        const createdBy: string = existing.createdBy || (auth.currentUser?.uid || 'unknown');

        await setDoc(scheduleRef as any, {
          scheduleId: (scheduleRef as any).id,
          type: 'secondary',
          createdAt,
          createdBy,
          updatedAt: Timestamp.now(),
          startDate: Timestamp.fromDate(rangeStart),
          endDate: Timestamp.fromDate(rangeEnd),
          assignmentsMap: Object.keys(newAssignments).reduce((acc, k) => {
            acc[k] = { ...newAssignments[k] };
            return acc;
          }, {} as Record<string, any>)
        }, { merge: false });
        await reloadPastSchedules();
        // Update byWorker ledgers for weekend closings (secondary)
        setSaveProgress({ phase: 'updatingLedgers', processed: 0, total: Object.keys(newAssignments).length || 1 });
        const prevWorkerIds = new Set(Object.values(prevAssignments).map((a) => String(a.workerId || '').trim()).filter(Boolean));
        const nextWorkerIds = new Set(Object.values(newAssignments).map((a) => String(a.workerId || '').trim()).filter(Boolean));
        const affected = Array.from(new Set([...Array.from(prevWorkerIds), ...Array.from(nextWorkerIds)]));
        await updateByWorkerClosingsForSecondary((scheduleRef as any).id, newAssignments, departmentId, visibleTasks, affected);
        // Update department statistics summary (secondary deltas)
        setSaveProgress((p) => ({ ...p, phase: 'updatingStats' }));
        try {
          await updateSummaryForSecondarySave(departmentId, prevAssignments, newAssignments);
        } catch {}
      }

      try { alert('נשמר בהצלחה'); } catch {}
      // Reset UI for new planning
      setStartDate('');
      setEndDate('');
      setCellData(new Map());
      setAssignedByDate({});
      setCurrentSecondaryScheduleId(null);
      setSaveProgress({ phase: 'done', processed: 0, total: 0 });
    } catch (e) {
      console.error('שגיאה בשמירת סידור משימות משניות:', e);
      try { alert('שגיאה בשמירה'); } catch {}
    }
    finally {
      setIsSaving(false);
    }
  };

  /**
   * Update byWorker closing ledgers for a saved secondary schedule.
   * Creates one closing per Friday for tasks that are weekend closers (assign_weekends=true).
   */
  async function updateByWorkerClosingsForSecondary(
    scheduleId: string,
    assignments: Record<string, { taskId: string; workerId: string; workerName: string; date: Timestamp }>,
    deptId: string,
    allTasks: SecondaryTask[],
    affectedWorkerIds?: string[]
  ): Promise<void> {
    try {
      // Build quick lookup for weekend tasks
      const weekendTaskIds = new Set(allTasks.filter(t => t.assign_weekends).map(t => String(t.id)));
      if (weekendTaskIds.size === 0) return;

      // Collect Friday closings per worker (from new assignments)
      const byWorkerFridays = new Map<string, Date[]>();
      Object.values(assignments).forEach((a) => {
        const taskId = String(a.taskId || '');
        if (!weekendTaskIds.has(taskId)) return;
        const d = (a.date as Timestamp).toDate();
        if (d.getDay() !== 5) return; // only Friday entries represent closing
        const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
        const wid = String(a.workerId || '').trim();
        if (!wid) return;
        const arr = byWorkerFridays.get(wid) || [];
        arr.push(normalized);
        byWorkerFridays.set(wid, arr);
      });

      // Determine target worker set: explicit list if provided; else keys from current assignments
      const targetWorkerIds = affectedWorkerIds && affectedWorkerIds.length > 0
        ? Array.from(new Set(affectedWorkerIds))
        : Array.from(byWorkerFridays.keys());

      // For each affected worker, remove all entries from this scheduleId, then add new Friday entries, re-bucket, prune, recompute actual interval
      // Concurrency limiting to reduce tail latency and retries under burst writes
      const processInBatches = async <T,>(items: T[], batchSize: number, worker: (item: T) => Promise<void>) => {
        if (batchSize <= 0) batchSize = 1;
        for (let i = 0; i < items.length; i += batchSize) {
          const slice = items.slice(i, i + batchSize);
          await Promise.all(slice.map((it) => worker(it)));
        }
      };

      const CONCURRENCY = 20;
      let processed = 0;
      const total = targetWorkerIds.length;
      await processInBatches<string>(targetWorkerIds, CONCURRENCY, async (workerId) => {
        const fridays = byWorkerFridays.get(workerId) || [];
        await (async () => {
          const ref = doc(db, 'departments', deptId, 'workers', 'index', 'byWorker', workerId);
          const snap = await getDoc(ref);
          const data = (snap.exists() ? (snap.data() as any) : {}) || {};
          type ClosingEntry = { friday: Timestamp; source: 'primary'|'secondary'; scheduleId: string };
          const existingHistory: ClosingEntry[] = Array.isArray(data.closingHistory) ? data.closingHistory : [];
          const existingFuture: ClosingEntry[] = Array.isArray(data.futureClosings) ? data.futureClosings : [];

          const historySansSchedule = existingHistory.filter((e) => e && e.scheduleId !== scheduleId);
          const futureSansSchedule = existingFuture.filter((e) => e && e.scheduleId !== scheduleId);

          const nowNoon = new Date(); nowNoon.setHours(12,0,0,0);
          const additionsHistory: ClosingEntry[] = [];
          const additionsFuture: ClosingEntry[] = [];
          fridays.forEach((d) => {
            const entry: ClosingEntry = { friday: Timestamp.fromDate(d), source: 'secondary', scheduleId };
            if (d < nowNoon) additionsHistory.push(entry); else additionsFuture.push(entry);
          });

          let mergedHistory = [...historySansSchedule, ...additionsHistory]
            .sort((a,b) => a.friday.toMillis() - b.friday.toMillis());
          let mergedFuture = [...futureSansSchedule, ...additionsFuture]
            .sort((a,b) => a.friday.toMillis() - b.friday.toMillis());

          // Prune: keep only last N history entries and limit future horizon
          const HISTORY_CAP = 150; // ~5-10 years
          if (mergedHistory.length > HISTORY_CAP) {
            mergedHistory = mergedHistory.slice(mergedHistory.length - HISTORY_CAP);
          }
          const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
          const horizon = new Date(nowNoon.getTime() + ONE_YEAR_MS);
          mergedFuture = mergedFuture.filter((e) => e.friday.toDate() <= horizon);

          let actualIntervalWeeks = 0;
          if (mergedHistory.length >= 2) {
            let sum = 0; let gaps = 0;
            for (let i=1;i<mergedHistory.length;i++) {
              const prev = mergedHistory[i-1].friday.toDate();
              const cur = mergedHistory[i].friday.toDate();
              const diffDays = Math.floor((cur.getTime()-prev.getTime())/(24*60*60*1000));
              sum += diffDays/7; gaps += 1;
            }
            actualIntervalWeeks = Math.round(sum/Math.max(1,gaps));
          }

          // Derive lastClosingDate as latest history Friday
          const lastClosingDate = mergedHistory.length > 0 ? mergedHistory[mergedHistory.length - 1].friday : (data.lastClosingDate || null);

          await setDoc(ref, {
            closingHistory: mergedHistory,
            futureClosings: mergedFuture,
            actualClosingInterval: actualIntervalWeeks,
            lastClosingDate,
            updatedAt: Timestamp.now()
          }, { merge: true });
        })();
        processed += 1;
        setSaveProgress((p) => (p.phase === 'updatingLedgers' ? { ...p, processed, total } : p));
      });
    } catch (err) {
      try { console.warn('[SecondaryClosings] ledger update failed (non-fatal):', err); } catch {}
    }
  }

  return (
    <>
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />

      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">משימות משניות - מנהל</h1>
            <p className="text-lg md:text-xl text-white/80">נהל משימות משניות עבור המחלקה</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative z-10">
            <h2 className="text-2xl font-bold text-white mb-4">בחר טווח תאריכים</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HebrewDatePicker label="תאריך התחלה" value={startDate} onChange={setStartDate} />
              <HebrewDatePicker label="תאריך סיום" value={endDate} onChange={setEndDate} />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">פעולות</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button size="md" fullWidth variant="secondary" onClick={handleLoadPreferences}>טען העדפות</Button>
              <Button size="md" fullWidth variant="primary" onClick={handleAutoAssign}>שבץ אוטומטית</Button>
              <Button size="md" fullWidth variant="secondary" onClick={handleClearAll}>נקה הכל</Button>
              <Button size="md" fullWidth variant="attention" className="brightness-110" onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? '⏳ שומר…' : 'שמור'}
              </Button>
            </div>
            <SaveProgress
              visible={isSaving}
              phase={saveProgress.phase}
              processed={saveProgress.processed}
              total={saveProgress.total}
            />
          </div>

          {startDate && endDate ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative z-0">
              <SecondaryTaskTable
                startDate={new Date(startDate)}
                endDate={new Date(endDate)}
                tasks={visibleTasks}
                cellData={cellData}
                onCellClick={handleCellClick}
                isReadOnly={false}
                currentWorkerId={undefined}
                currentWorkerQualifications={allTaskIds}
                hideLegend
                showAddRow
                onAddRowClick={() => setShowAddTaskModal(true)}
                adminMode
              />
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 text-center">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-white/70 text-lg">בחר טווח תאריכים כדי להציג את הטבלה</p>
            </div>
          )}

          {/* Past Secondary Schedules - card list with delete */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">סידורים שנשמרו</h3>
              {/* Simple refresh button and capped view */}
              <button
                onClick={async () => { try { await reloadPastSchedules(); } catch {} }}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm"
              >
                רענן רשימה
              </button>
            </div>
            {pastSchedules.length === 0 ? (
              <div className="text-white/60">אין סידורים שמורים</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pastSchedules.slice(0, 6).map((s) => (
                  <div key={s.id} className={`group relative rounded-xl border border-white/20 bg-white/10 p-4 hover:bg-white/15 transition cursor-pointer ${currentSecondaryScheduleId === s.id ? 'ring-2 ring-purple-400/60' : ''}`}
                       onClick={() => handleSelectPastSchedule(s.id)}>
                    <div className="text-white font-semibold text-sm mb-1">{formatDateDDMMYYYY(s.startDate)} — {formatDateDDMMYYYY(s.endDate)}</div>
                    <div className="text-white/60 text-xs">עודכן {formatDateDDMMYYYY(s.updatedAt)}</div>
                    <button
                      className="absolute top-2 left-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-md p-1 border border-white/20"
                      title="מחק"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = confirm(`Are you sure you want to delete schedule ${formatDateDDMMYYYY(s.startDate)} - ${formatDateDDMMYYYY(s.endDate)}?`);
                        if (!ok) return;
                        try {
                          // Load prev assignments before delete to update ledgers and statistics
                          const ref = doc(db, 'departments', departmentId, 'secondarySchedules', s.id);
                          const snap = await getDoc(ref);
                          const prev = (snap.exists() ? (snap.data() as any) : {}) || {};
                          const prevAssignments = (prev.assignmentsMap || {}) as Record<string, { workerId: string; taskId: string; date: Timestamp }>;

                          await deleteDoc(ref);

                          // Affected workers
                          const affected = Array.from(new Set(Object.values(prevAssignments).map((a) => String(a.workerId || '').trim()).filter(Boolean)));
                          // Clean ledgers for affected workers
                          try {
                            await updateByWorkerClosingsForSecondary(s.id, {}, departmentId, visibleTasks, affected);
                          } catch {}
                          // Update statistics (secondary deltas negative)
                          try {
                            await updateSummaryForSecondarySave(departmentId, prevAssignments, {} as any);
                          } catch {}
                          if (currentSecondaryScheduleId === s.id) {
                            setCurrentSecondaryScheduleId(null);
                            setCellData(new Map());
                            setAssignedByDate({});
                          }
                          await reloadPastSchedules();
                        } catch (err) {
                          console.error('מחיקת סידור נכשלה', err);
                          alert('מחיקה נכשלה');
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {pastSchedules.length > 6 && (
                  <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-right">
                    <div className="text-white/70 text-sm mb-2">מוצגים 6 אחרונים</div>
                    <details className="bg-white/5 rounded-lg">
                      <summary className="cursor-pointer text-white/90 px-3 py-2 select-none">הצג היסטוריה</summary>
                      <div className="max-h-64 overflow-y-auto mt-2 pr-1">
                        {pastSchedules.slice(6).map((s) => (
                          <button
                            key={`more-${s.id}`}
                            onClick={() => { handleSelectPastSchedule(s.id); /* collapsible auto-closes natively */ }}
                            className="w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white text-sm border border-transparent hover:border-white/10"
                          >
                            {formatDateDDMMYYYY(s.startDate)} — {formatDateDDMMYYYY(s.endDate)}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <Modal isOpen={showAddTaskModal} onClose={() => setShowAddTaskModal(false)} title="הוסף משימה חדשה">
        <div className="space-y-4">
          <Input
            label="שם משימה"
            placeholder="לדוגמה: כוננות לילה"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomTask(); }}
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAddTaskModal(false)}>ביטול</Button>
            <Button onClick={handleAddCustomTask} disabled={!newTaskName.trim()}>הוסף</Button>
          </div>
        </div>
      </Modal>

      {/* Selection Modal */}
      <Modal isOpen={selectionOpen} onClose={() => setSelectionOpen(false)} title="בחר עובד" dynamicHeight>
        <div className="space-y-6" dir="rtl">
          {selectionTask && selectionDate && (
            <div className="text-white/80 text-sm">{selectionTask.name} • {formatDateDDMMYYYY(selectionDate)}</div>
          )}

          {selectionLists.currentAssigned && selectionTask && selectionDate && (
            <div className="flex items-center justify-between bg-blue-600/20 border border-blue-400/30 rounded-xl p-3">
              <div className="text-white">משובץ כעת: <span className="font-semibold">{selectionLists.currentAssigned.name}</span></div>
              <Button variant="attention" onClick={() => removeAssignmentFromCell(selectionTask, selectionDate!)}>הסר שיוך</Button>
            </div>
          )}

          {/* Preferred */}
          <div>
            <div className="text-white/70 text-xs mb-2">העדיפו משימה זו</div>
            <div className="flex flex-col gap-2">
              {selectionLists.preferred.length === 0 && (
                <div className="text-white/40 text-sm">אין</div>
              )}
              {selectionLists.preferred.map((w) => (
                <button key={`pref-${w.workerId}`} onClick={() => selectionTask && selectionDate && assignWorkerToCell(w.workerId, w.name, selectionTask, selectionDate)} className="w-full text-right text-white bg-green-600/20 hover:bg-green-600/30 border border-green-400/30 rounded-xl px-4 py-2">
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          {/* Neutral */}
          <div>
            <div className="text-white/70 text-xs mb-2">ללא העדפה</div>
            <div className="flex flex-col gap-2">
              {selectionLists.neutral.length === 0 && (
                <div className="text-white/40 text-sm">אין</div>
              )}
              {selectionLists.neutral.map((w) => (
                <button key={`neut-${w.workerId}`} onClick={() => selectionTask && selectionDate && assignWorkerToCell(w.workerId, w.name, selectionTask, selectionDate)} className="w-full text-right text-white bg-slate-600/20 hover:bg-slate-600/30 border border-white/20 rounded-xl px-4 py-2">
                  <span>{w.name}</span>
                  {w.note && <span className="text-white/60 text-xs mr-2">• {w.note}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Blocked */}
          <div>
            <div className="text-white/70 text-xs mb-2">חסמו תאריך/משימה</div>
            <div className="flex flex-col gap-2">
              {selectionLists.blocked.length === 0 && (
                <div className="text-white/40 text-sm">אין</div>
              )}
              {selectionLists.blocked.map((w) => (
                <button key={`blk-${w.workerId}`} onClick={() => selectionTask && selectionDate && assignWorkerToCell(w.workerId, w.name, selectionTask, selectionDate)} className="w-full text-right text-white bg-red-600/20 hover:bg-red-600/30 border border-red-400/30 rounded-xl px-4 py-2">
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned elsewhere */}
          <div>
            <div className="text-white/70 text-xs mb-2">כבר שובצו לתאריך זה</div>
            <div className="flex flex-col gap-2">
              {selectionLists.assigned.length === 0 && (
                <div className="text-white/40 text-sm">אין</div>
              )}
              {selectionLists.assigned.map((w) => (
                <button key={`asg-${w.workerId}`} onClick={() => selectionTask && selectionDate && assignWorkerToCell(w.workerId, w.name, selectionTask, selectionDate)} className="w-full text-right text-white bg-amber-600/20 hover:bg-amber-600/30 border border-amber-400/30 rounded-xl px-4 py-2">
                  <span>{w.name}</span>
                  {w.note && <span className="text-white/60 text-xs mr-2">• {w.note}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Primary task on same day (unclickable) */}
          <div>
            <div className="text-white/70 text-xs mb-2">בעלי משימה ראשית בתאריך זה</div>
            <div className="flex flex-col gap-2">
              {selectionLists.primaryBusy.length === 0 && (
                <div className="text-white/40 text-sm">אין</div>
              )}
              {selectionLists.primaryBusy.map((w) => (
                <div key={`pri-${w.workerId}`} className="w-full text-right text-white/60 bg-gray-700/30 border border-gray-600/30 rounded-xl px-4 py-2 cursor-not-allowed">
                  <span>{w.name}</span>
                  <span className="text-white/50 text-xs mr-2">• {w.primaryTaskName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button variant="secondary" onClick={() => setSelectionOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AdminSecondaryTasksPage;


