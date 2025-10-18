/**
 * Admin Secondary Tasks Page
 * Independent admin UI for secondary tasks (separate from worker preferences).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, collection, doc, getDoc, getDocs, setDoc, orderBy, query, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import SecondaryTaskTable, { SecondaryTask, CellData, WorkerInCell, getCellKey } from '../../components/shared/SecondaryTaskTable';
import { getTaskDefinitions } from '../../lib/firestore/taskDefinitions';
import { ClosingScheduleCalculator } from '../../lib/utils/closingScheduleCalculator';
import { generateSecondarySchedule } from '../../lib/utils/secondaryScheduleEngine';
import { formatDateDDMMYYYY } from '../../lib/utils/dateUtils';

/**
 * Secondary schedule engine (local storage edition)
 * Reads payload from localStorage (key: `secondaryPlanning:{departmentId}`) and builds a full plan.
 * Returns assignments and diagnostics without writing to Firestore.
 */
// Types below are kept for historical context; the active engine is imported.
// type PreferenceEntry = { date: string; taskId: string | null; status?: 'preferred' | 'blocked' };
// type WorkerProfile = { firstName: string; lastName: string; closingInterval: number; qualifications: string[] };
// type WorkerPayload = { profile: WorkerProfile; primaryTasks: Array<{ taskId: string; taskName: string; startDate: string; endDate: string; scheduleId: string }>; mandatoryClosingDates: string[]; optimalClosingDates: string[]; preferencesInWindow: PreferenceEntry[] };
// type PlanningPayload = { generatedAt: string; departmentId: string; selectedRange: { start: string; end: string }; window: { start: string; end: string }; fridays: string[]; schedulesUsed: string[]; workers: Record<string, WorkerPayload> };
// type GenerateOptions = { weeklyCapSequence?: number[]; scarcityThreshold?: number; skipManualOnlyTasks?: boolean };
// type WeekendCloserDecision = { workerId: string; reason: 'missed_optimal' | 'on_optimal' | 'due' | 'fairness' };
// type Assignment = { date: string; taskId: string; workerId: string };
// type PlanResult = { closersByFriday: Record<string, { forced: string[]; assigned: WeekendCloserDecision[]; requiredCount: number }>; assignments: Assignment[]; warnings: string[]; logs: string[] };

// Engine moved to src/lib/utils/secondaryScheduleEngine.ts; the in-file version below is commented out.
/*
function generateSecondarySchedule(
  departmentId: string,
  start: Date,
  end: Date,
  tasks: SecondaryTask[],
  opts: GenerateOptions = {}
): PlanResult {
  // Helpers (scoped)
  const parseDDMM = (s: string): Date => {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };
  const fmtDDMM = (d: Date): string => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };
  const addDaysLocal = (d: Date, days: number): Date => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  };
  const isThuFriSat = (d: Date) => {
    const dow = d.getDay();
    return dow === 4 || dow === 5 || dow === 6;
  };
  const isFriday = (d: Date) => d.getDay() === 5;
  const dateKey = (d: Date) => fmtDDMM(d);
  const hasPrimaryOn = (worker: WorkerPayload, day: Date): boolean => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return (worker.primaryTasks || []).some((t) => {
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      return !(e < dayStart || s > dayEnd);
    });
  };
  const spansWeekend = (worker: WorkerPayload, friday: Date): boolean => {
    const thu = addDaysLocal(friday, -1);
    const sat = addDaysLocal(friday, +1);
    return (worker.primaryTasks || []).some((t) => {
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      return !(e < thu || s > sat);
    });
  };
  const previousFriday = (friday: Date): Date => addDaysLocal(friday, -7);
  const weeksSinceLastClose = (
    workerId: string,
    friday: Date,
    assignedClosers: Record<string, Set<string>>,
    payload: PlanningPayload
  ): number => {
    let last: Date | null = null;
    const fridays = payload.fridays.map(parseDDMM).sort((a, b) => a.getTime() - b.getTime());
    for (let i = fridays.length - 1; i >= 0; i--) {
      const f = fridays[i];
      if (f >= friday) continue;
      const k = dateKey(f);
      if (assignedClosers[k]?.has(workerId)) { last = f; break; }
    }
    if (!last) {
      const mandatory = payload.workers[workerId]?.mandatoryClosingDates || [];
      const prevs = mandatory.map(parseDDMM).filter((d) => d < friday);
      if (prevs.length > 0) last = prevs.sort((a, b) => a.getTime() - b.getTime())[prevs.length - 1];
    }
    if (!last) return 9999;
    const diffDays = Math.floor((friday.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
    return Math.floor(diffDays / 7);
  };
  const missedOptimal = (
    worker: WorkerPayload,
    workerId: string,
    friday: Date,
    assignedClosers: Record<string, Set<string>>,
    payload: PlanningPayload
  ): { missed: boolean; prevOptimal?: Date } => {
    const prevOpts = (worker.optimalClosingDates || [])
      .map(parseDDMM)
      .filter((d) => d < friday)
      .sort((a, b) => a.getTime() - b.getTime());
    if (prevOpts.length === 0) return { missed: false };
    const prev = prevOpts[prevOpts.length - 1];
    const wsl = weeksSinceLastClose(workerId, friday, assignedClosers, payload);
    const weeksSincePrev = Math.floor((friday.getTime() - prev.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const missed = wsl > weeksSincePrev;
    return { missed, prevOptimal: prev };
  };
  const isQualified = (task: SecondaryTask, worker: WorkerPayload): boolean => {
    if (!task.requiresQualification) return true;
    const quals = worker.profile.qualifications || [];
    return quals.includes(task.id);
  };
  const preferenceOn = (worker: WorkerPayload, day: Date, taskId: string) => {
    const key = dateKey(day);
    const prefs = worker.preferencesInWindow || [];
    const sameDay = prefs.filter((p) => p.date === key);
    const blocked = sameDay.some((p) => p.status === 'blocked');
    const preferred = sameDay.some((p) => p.status === 'preferred' && (p.taskId === null || p.taskId === taskId));
    return { blocked, preferred };
  };

  const options: Required<GenerateOptions> = {
    weeklyCapSequence: opts.weeklyCapSequence || [0, 1, 2, 3],
    scarcityThreshold: opts.scarcityThreshold ?? 3,
    skipManualOnlyTasks: opts.skipManualOnlyTasks ?? true,
  };

  // 1) Load payload
  const key = `secondaryPlanning:${departmentId}`;
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error(`Local payload not found for ${key}`);
  const payload: PlanningPayload = JSON.parse(raw);

  // 2) Build dates for selected range
  const dates: Date[] = [];
  {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
    while (cur <= endD) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  }

  // 3) Scarcity per task
  const qualifiedCountByTask: Record<string, number> = {};
  Object.keys(payload.workers).forEach((wid) => {
    const worker = payload.workers[wid];
    tasks.forEach((t) => { if (isQualified(t, worker)) qualifiedCountByTask[t.id] = (qualifiedCountByTask[t.id] || 0) + 1; });
  });

  // 4) Weekend closers plan
  const closersByFriday: PlanResult['closersByFriday'] = {};
  const assignedClosers: Record<string, Set<string>> = {};
  const fridaysInRange = dates.filter(isFriday);
  for (const friday of fridaysInRange) {
    const fKey = dateKey(friday);
    const forced = Object.keys(payload.workers).filter((wid) => payload.workers[wid].mandatoryClosingDates?.includes(fKey));
    const required = tasks.filter((t) => t.assign_weekends && t.autoAssign).length;
    const candidates: Array<{ wid: string; missed: boolean; onOptimal: boolean; weeksUntilDue: number }> = [];
    for (const wid of Object.keys(payload.workers)) {
      if (forced.includes(wid)) continue;
      const wp = payload.workers[wid];
      if (wp.profile.closingInterval === 0) continue;
      if (spansWeekend(wp, friday)) continue;
      const prevF = previousFriday(friday);
      const prevKey = dateKey(prevF);
      const closedPrevious = assignedClosers[prevKey]?.has(wid) || (wp.mandatoryClosingDates || []).includes(prevKey);
      if (closedPrevious) continue;
      const isOnOptimal = (wp.optimalClosingDates || []).includes(fKey);
      const { missed } = missedOptimal(wp, wid, friday, assignedClosers, payload);
      const weeksSince = weeksSinceLastClose(wid, friday, assignedClosers, payload);
      const weeksUntilDue = Math.max(0, (wp.profile.closingInterval || 0) - weeksSince);
      candidates.push({ wid, missed, onOptimal: isOnOptimal, weeksUntilDue });
    }
    candidates.sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? -1 : 1;
      if (a.onOptimal !== b.onOptimal) return a.onOptimal ? -1 : 1;
      if (a.weeksUntilDue !== b.weeksUntilDue) return a.weeksUntilDue - b.weeksUntilDue;
      return a.wid.localeCompare(b.wid);
    });
    const need = Math.max(0, required - forced.length);
    const chosen: WeekendCloserDecision[] = [];
    for (const c of candidates) {
      if (chosen.length >= need) break;
      const reason = c.missed ? 'missed_optimal' : c.onOptimal ? 'on_optimal' : c.weeksUntilDue === 0 ? 'due' : 'fairness';
      chosen.push({ workerId: c.wid, reason });
      (assignedClosers[fKey] = assignedClosers[fKey] || new Set()).add(c.wid);
    }
    closersByFriday[fKey] = { forced, assigned: chosen, requiredCount: required };
  }

  // 5) Assign secondary tasks across days (weekday + weekend)
  const assignments: Assignment[] = [];
  const yCountTotal: Record<string, number> = {};
  const yCountWeek: Record<string, Record<string, number>> = {};
  const assignedOnDay: Record<string, Set<string>> = {};
  const assignedCellByDayTask: Record<string, Set<string>> = {};
  const logs: string[] = [];
  const warnings: string[] = [];
  const getWeekKey = (d: Date): string => {
    const y = d.getFullYear();
    const firstDay = new Date(y, 0, 1);
    const days = Math.floor((d.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.floor((days + firstDay.getDay()) / 7);
    return `${y}-${week}`;
  };
  const tasksAuto = tasks.filter((t) => options.skipManualOnlyTasks ? t.autoAssign : true);
  const sortedTasksByScarcity = [...tasksAuto].sort((a, b) => {
    const qa = qualifiedCountByTask[a.id] ?? 0;
    const qb = qualifiedCountByTask[b.id] ?? 0;
    return qa - qb;
  });

  // 5a) Weekend triads: assign the same worker for Thu+Fri+Sat per task
  for (const friday of fridaysInRange) {
    const fKey = dateKey(friday);
    const weekendTasks = sortedTasksByScarcity.filter((t) => t.assign_weekends);
    if (weekendTasks.length === 0) continue;

    const thu = addDaysLocal(friday, -1);
    const sat = addDaysLocal(friday, +1);
    [thu, friday, sat].forEach((d) => {
      const dk = dateKey(d);
      assignedOnDay[dk] = assignedOnDay[dk] || new Set<string>();
      assignedCellByDayTask[dk] = assignedCellByDayTask[dk] || new Set<string>();
    });

    const forced = closersByFriday[fKey]?.forced || [];

    for (const task of weekendTasks) {
      let chosenWid: string | null = null;
      for (const cap of options.weeklyCapSequence) {
        let best: { wid: string; score: number } | null = null;
        for (const wid of Object.keys(payload.workers)) {
          const worker = payload.workers[wid];
          if (!isQualified(task, worker)) continue;
          if (spansWeekend(worker, friday)) continue; // primary across weekend
          if (forced.includes(wid)) continue; // do not give Y to forced closer

          const dkThu = dateKey(thu); const dkFri = fKey; const dkSat = dateKey(sat);
          if (assignedOnDay[dkThu]?.has(wid) || assignedOnDay[dkFri]?.has(wid) || assignedOnDay[dkSat]?.has(wid)) continue;

          const wk = getWeekKey(friday);
          const cnt = (yCountWeek[wid]?.[wk] || 0);
          if (cnt > cap) continue;

          const prefFri = preferenceOn(worker, friday, task.id);
          const scarcity = qualifiedCountByTask[task.id] ?? 0;
          const scarcityBonus = Math.max(0, (options.scarcityThreshold + 1) - scarcity);
          const totalCnt = (yCountTotal[wid] || 0);
          let s = 0;
          if (prefFri.preferred) s += 2;
          s += scarcityBonus;
          s += (cap - cnt);
          s += (5 - Math.min(5, totalCnt));

          if (!best || s > best.score || (s === best.score && wid.localeCompare((best as any).wid) < 0)) {
            best = { wid, score: s } as any;
          }
        }
        if (best) { chosenWid = best.wid; break; }
      }

      if (!chosenWid) {
        warnings.push(`Weekend ${fKey}: no candidate for task ${task.id}`);
        continue;
      }

      const triadDays = [thu, friday, sat].filter((d) => d >= dates[0] && d <= dates[dates.length - 1]);
      for (const d of triadDays) {
        const dk = dateKey(d);
        assignments.push({ date: dk, taskId: task.id, workerId: chosenWid });
        assignedOnDay[dk].add(chosenWid);
        assignedCellByDayTask[dk].add(task.id);
        const wkKey = getWeekKey(d);
        (yCountWeek[chosenWid] = yCountWeek[chosenWid] || {})[wkKey] = (yCountWeek[chosenWid][wkKey] || 0) + 1;
        yCountTotal[chosenWid] = (yCountTotal[chosenWid] || 0) + 1;
      }
    }
  }
  for (const day of dates) {
    const keyDay = dateKey(day);
    assignedOnDay[keyDay] = assignedOnDay[keyDay] || new Set();
    assignedCellByDayTask[keyDay] = assignedCellByDayTask[keyDay] || new Set();
    const fridayForWeekend = isThuFriSat(day) ? (() => {
      const dow = day.getDay();
      if (dow === 4) return addDaysLocal(day, +1);
      if (dow === 5) return day;
      return addDaysLocal(day, -1);
    })() : null;
    const fridayKey = fridayForWeekend ? dateKey(fridayForWeekend) : null;
    const forced = fridayKey ? closersByFriday[fridayKey!]?.forced || [] : [];
    for (const cap of options.weeklyCapSequence) {
      for (const task of sortedTasksByScarcity) {
        if (isThuFriSat(day)) {
          if (!task.assign_weekends) continue;
          if (assignedCellByDayTask[keyDay]?.has(task.id)) continue; // already filled by triad
        } else {
          if (task.assign_weekends) continue; // weekend-only tasks not on weekdays
        }
        let best: { wid: string; score: number } | null = null;
        for (const wid of Object.keys(payload.workers)) {
          const worker = payload.workers[wid];
          if (!isQualified(task, worker)) continue;
          if (hasPrimaryOn(worker, day)) continue;
          if (assignedOnDay[keyDay].has(wid)) continue;
          if (fridayKey && forced.includes(wid)) continue;
          if (fridayKey && spansWeekend(worker, fridayForWeekend!)) continue;
          const wk = getWeekKey(day);
          const countWeek = (yCountWeek[wid]?.[wk] || 0);
          if (countWeek > cap) continue;
          const pref = preferenceOn(worker, day, task.id);
          if (pref.blocked) continue;
          const scarcity = qualifiedCountByTask[task.id] ?? 0;
          const scarcityBonus = Math.max(0, (options.scarcityThreshold + 1) - scarcity);
          const weeklyCnt = (yCountWeek[wid]?.[wk] || 0);
          const totalCnt = (yCountTotal[wid] || 0);
          let s = 0;
          if (pref.preferred) s += 2;
          s += scarcityBonus;
          s += (cap - weeklyCnt);
          s += (5 - Math.min(5, totalCnt));
          if (!best || s > best.score || (s === best.score && wid.localeCompare((best as any).wid) < 0)) {
            best = { wid, score: s } as any;
          }
        }
        if (best) {
          assignments.push({ date: keyDay, taskId: task.id, workerId: best.wid });
          assignedOnDay[keyDay].add(best.wid);
          yCountTotal[best.wid] = (yCountTotal[best.wid] || 0) + 1;
          const wkKey = getWeekKey(day);
          (yCountWeek[best.wid] = yCountWeek[best.wid] || {})[wkKey] = (yCountWeek[best.wid][wkKey] || 0) + 1;
        }
      }
    }
  }

  // 6) Diagnostics
  Object.keys(closersByFriday).forEach((fk) => {
    const info = closersByFriday[fk];
    if (info.assigned.length + info.forced.length < info.requiredCount) {
      warnings.push(`Friday ${fk}: shortfall ${info.requiredCount - (info.assigned.length + info.forced.length)} (forced=${info.forced.length}, assigned=${info.assigned.length})`);
    }
  });
  for (const a of assignments) {
    const worker = payload.workers[a.workerId];
    const d = parseDDMM(a.date);
    if (hasPrimaryOn(worker, d)) warnings.push(`Primary overlap on ${a.date} for worker ${a.workerId}`);
    const pref = preferenceOn(worker, d, a.taskId);
    if (pref.blocked) warnings.push(`Blocked preference used on ${a.date} for worker ${a.workerId}`);
  }
  logs.push(`Generated ${assignments.length} secondary assignments.`);
  return { closersByFriday, assignments, warnings, logs };
}
*/

const AdminSecondaryTasksPage: React.FC = () => {
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

  function spansThuFriSat(startDate: Date, endDate: Date): boolean {
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
  }

  function fridaysInsideSpan(startDate: Date, endDate: Date): Date[] {
    const out: Date[] = [];
    const d = new Date(startDate);
    d.setHours(12, 0, 0, 0);
    while (d <= endDate) { if (d.getDay() === 5) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }

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

        // 2) Primary schedules overlapping the window (NEW PATH): /departments/{dep}/primarySchedules/*
        const schedCol = collection(db, 'departments', departmentId, 'primarySchedules');
        const schedSnap = await getDocs(schedCol);
        const usedSchedules = schedSnap.docs
          .map((d) => ({ id: d.id, data: d.data() as any }))
          .filter((s) => {
            const type = s.data.type || 'primary';
            const sd = (s.data.startDate as Timestamp).toDate();
            const ed = (s.data.endDate as Timestamp).toDate();
            return type === 'primary' && sd <= windowEnd && ed >= windowStart;
          });

        // 3) Build per-worker primary tasks (clipped to window)
        const primaryByWorker: Record<string, Array<{ taskId: string; taskName: string; startDate: string; endDate: string; scheduleId: string }>> = {};
        for (const sched of usedSchedules) {
          const sdata = sched.data;
          const assignmentsMap = (sdata.assignmentsMap || {}) as Record<string, any>;
          Object.keys(assignmentsMap).forEach((key) => {
            const a = assignmentsMap[key] || {};
            const sTs = a.startDate as Timestamp | undefined;
            const eTs = a.endDate as Timestamp | undefined;
            const workerId = String(a.workerId || '').trim();
            if (!workerId || !sTs || !eTs) return;
            const s = sTs.toDate();
            const e = eTs.toDate();
            if (e < windowStart || s > windowEnd) return;
            const clippedStart = s < windowStart ? windowStart : s;
            const clippedEnd = e > windowEnd ? windowEnd : e;
            if (!primaryByWorker[workerId]) primaryByWorker[workerId] = [];
            primaryByWorker[workerId].push({
              taskId: String(a.taskId || ''),
              taskName: String(a.taskName || ''),
              startDate: new Date(clippedStart).toISOString(),
              endDate: new Date(clippedEnd).toISOString(),
              scheduleId: sched.id
            });
          });
        }

        // 4) Mandatory closing dates (Fridays) per worker based on weekend-spanning primary tasks
        const mandatoryByWorker: Record<string, string[]> = {};
        Object.keys(primaryByWorker).forEach((wid) => {
          const spans = primaryByWorker[wid];
          const frSet = new Set<string>();
          spans.forEach((span) => {
            const s = new Date(span.startDate);
            const e = new Date(span.endDate);
            if (spansThuFriSat(s, e)) {
              fridaysInsideSpan(s, e).forEach((d) => frSet.add(formatDateDDMMYYYY(d)));
            }
          });
          mandatoryByWorker[wid] = Array.from(frSet).sort((a, b) => {
            // compare by dd/mm/yyyy
            const [da, ma, ya] = a.split('/').map(Number);
            const [db, mb, yb] = b.split('/').map(Number);
            return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
          });
        });

        // 5) Optimal closing dates via calculator for the window Fridays
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

        // 6) Preferences from byWorker filtered to window
        const byWorkerSnap = await getDocs(collection(db, 'departments', departmentId, 'workers', 'index', 'byWorker'));
        const prefsByWorker: Record<string, Array<{ date: string; taskId: string | null; status?: 'preferred' | 'blocked' }>> = {};
        byWorkerSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const arr = (data?.preferences || []) as Array<{ date: Timestamp; taskId: string | null; status?: 'preferred' | 'blocked' }>;
          const filtered = arr
            .map((p) => ({ date: (p.date as Timestamp).toDate() as Date, taskId: p.taskId ?? null, status: p.status }))
            .filter((p) => p.date >= windowStart && p.date <= windowEnd)
            .map((p) => ({ date: formatDateDDMMYYYY(p.date), taskId: p.taskId, status: p.status }));
          prefsByWorker[docSnap.id] = filtered;
        });

        // 7) Build local payload and save to localStorage
        const payload = {
          generatedAt: new Date().toISOString(),
          departmentId,
          selectedRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
          window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
          fridays: fridays.map((d) => formatDateDDMMYYYY(d)),
          schedulesUsed: usedSchedules.map((s) => s.id),
          workers: eligibleWorkerIds.reduce((acc: Record<string, any>, wid) => {
            const w = workersIndex[wid];
            acc[wid] = {
              profile: {
                firstName: w.firstName || '',
                lastName: w.lastName || '',
                closingInterval: typeof w.closingInterval === 'number' ? w.closingInterval : 0,
                qualifications: Array.isArray(w.qualifications) ? w.qualifications : []
              },
              primaryTasks: (primaryByWorker[wid] || []),
              mandatoryClosingDates: mandatoryByWorker[wid] || [],
              optimalClosingDates: optimalByWorker[wid] || [],
              preferencesInWindow: prefsByWorker[wid] || []
            };
            return acc;
          }, {})
        };

        const key = `secondaryPlanning:${departmentId}`;
        try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}

        // 8) Debug output
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
              primaryTasks: (w.primaryTasks || []).length,
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
      const ttlOk = generatedAt > 0 ? (Date.now() - generatedAt) < (2 * 60 * 60 * 1000) : true; // default accept if missing
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
      } else {
        // Simplified: overwrite the entire document (keep createdAt/createdBy)
        const snap = await getDoc(scheduleRef as any);
        const existing = (snap.data() as any) || {};
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
      }

      try { alert('נשמר בהצלחה'); } catch {}
      // Reset UI for new planning
      setStartDate('');
      setEndDate('');
      setCellData(new Map());
      setAssignedByDate({});
      setCurrentSecondaryScheduleId(null);
    } catch (e) {
      console.error('שגיאה בשמירת סידור משימות משניות:', e);
      try { alert('שגיאה בשמירה'); } catch {}
    }
  };

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
              <Button size="md" fullWidth variant="attention" className="brightness-110" onClick={handleSave} disabled={!canSave}>שמור</Button>
            </div>
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
            <h3 className="text-xl font-bold text-white mb-4">סידורים שנשמרו</h3>
            {pastSchedules.length === 0 ? (
              <div className="text-white/60">אין סידורים שמורים</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pastSchedules.map((s) => (
                  <div key={s.id} className={`group relative rounded-xl border border-white/20 bg-white/10 p-4 hover:bg-white/15 transition cursor-pointer ${currentSecondaryScheduleId === s.id ? 'ring-2 ring-purple-400/60' : ''}`}
                       onClick={() => handleSelectPastSchedule(s.id)}>
                    <div className="text-white font-semibold text-sm mb-1">{formatDateDDMMYYYY(s.startDate)} — {formatDateDDMMYYYY(s.endDate)}</div>
                    <div className="text-white/60 text-xs">עודכן {formatDateDDMMYYYY(s.updatedAt)}</div>
                    <button
                      className="absolute top-2 left-2 text-red-300 hover:text-red-400 hover:scale-110 transition"
                      title="מחק"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = confirm(`Are you sure you want to delete schedule ${formatDateDDMMYYYY(s.startDate)} - ${formatDateDDMMYYYY(s.endDate)}?`);
                        if (!ok) return;
                        try {
                          await deleteDoc(doc(db, 'departments', departmentId, 'secondarySchedules', s.id));
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


