/**
 * Secondary Schedule Engine (Local Storage Edition)
 *
 * Purpose
 * - Generate secondary-task assignments using only client-side data cached in localStorage.
 * - Enforce weekend triads (Thu–Fri–Sat) per task: one worker per task across the whole weekend.
 * - Fill weekdays (Sun–Wed) for auto-assign tasks while respecting constraints and fairness.
 *
 * Data Source (see docs/LOCAL_STORAGE.md)
 * - Reads `secondaryPlanning:{departmentId}` from localStorage.
 * - Payload contains: workers, profile signals, primary tasks (clipped), mandatoryClosingDates, optimalClosingDates,
 *   preferencesInWindow, and window fridays.
 *
 * Key Rules Implemented
 * - Weekend closers (based on available weekend-assignable tasks):
 *   - Forced closers: workers with `mandatoryClosingDates` matching Friday.
 *   - Candidate filters: closingInterval>0, not forced, no primary spanning Thu–Sat, no back-to-back closes.
 *   - Ranking: missed optimal → on optimal → weeksUntilDue (asc) → fairness (stable id).
 *   - Weekend triads: for each weekend-assignable task pick a worker and assign Thu+Fri+Sat (within selected range).
 * - Weekday Y-task assignment (Sun–Wed):
 *   - Only tasks with `autoAssign=true` and `assign_weekends=false` are considered on weekdays.
 *   - Constraints: one secondary per worker per day, primary overlap hard-block, preference ‘blocked’ hard-block.
 *   - Progressive weekly caps for fairness (0→1→2→3), scarcity-first ordering, and preference bonuses.
 * - Preferences: ‘blocked’ is a hard block; ‘preferred’ increases the candidate score.
 * - Fairness: progressive cap sequence + tie-breakers (lower week count/total count → better).
 *
 * Integration
 * - The engine is pure (no Firestore writes). The caller paints results into the UI and persists on Save.
 * - Merge behavior is up to the caller (the Admin page merges into existing manual picks and preferences).
 */

export type SecondaryTaskInput = {
  id: string;
  name: string;
  requiresQualification: boolean;
  autoAssign: boolean;
  assign_weekends: boolean;
};

type PreferenceEntry = { date: string; taskId: string | null; status?: 'preferred' | 'blocked' };

type WorkerProfile = {
  firstName: string;
  lastName: string;
  closingInterval: number;            // 0 ⇒ never close
  qualifications: string[];
};

type WorkerPayload = {
  profile: WorkerProfile;
  // New ledger-based fields (preferred)
  primaryBusyDaysDDMM?: string[];      // DD/MM/YYYY for Thu/Fri/Sat derived from primary closings
  lastClosingFridayDDMM?: string | null; // DD/MM/YYYY (last closing from ledger)
  // Backward-compatibility (legacy):
  primaryTasks?: Array<{
    taskId: string;
    taskName: string;
    startDate: string;                // ISO (clipped to window)
    endDate: string;                  // ISO (clipped to window)
    scheduleId: string;
  }>;
  mandatoryClosingDates: string[];     // DD/MM/YYYY (primary closings)
  optimalClosingDates: string[];       // DD/MM/YYYY
  preferencesInWindow: PreferenceEntry[];
};

type PlanningPayload = {
  generatedAt: string;                 // ISO
  departmentId: string;
  selectedRange: { start: string; end: string };  // ISO
  window: { start: string; end: string };         // ISO
  fridays: string[];                    // DD/MM/YYYY (window)
  schedulesUsed: string[];              // primary schedule IDs (legacy; optional)
  stats?: {
    updatedAt?: string;
    perWorker: Record<string, { totalSecondary?: number; closingAccuracyPct?: number | null }>;
  };
  workers: Record<string, WorkerPayload>; // workerId → payload
};

export type GenerateOptions = {
  weeklyCapSequence?: number[];        // Progressive caps to try (e.g., [0,1,2,3])
  scarcityThreshold?: number;          // <= threshold → scarce
  skipManualOnlyTasks?: boolean;       // Skip tasks with autoAssign=false
};

export type WeekendCloserDecision = {
  workerId: string;
  reason: 'missed_optimal' | 'on_optimal' | 'due' | 'fairness';
};

export type Assignment = {
  date: string;                        // DD/MM/YYYY
  taskId: string;
  workerId: string;
};

export type PlanResult = {
  closersByFriday: Record<string, { forced: string[]; assigned: WeekendCloserDecision[]; requiredCount: number }>;
  assignments: Assignment[];
  warnings: string[];
  logs: string[];
};

/**
 * Generate secondary schedule plan based on local cache and task definitions.
 *
 * @param departmentId - Firestore department id
 * @param start - Selected range start date
 * @param end - Selected range end date
 * @param tasks - Visible task definitions for the table (ids must match qualifications)
 * @param opts - Engine options (caps, scarcity threshold, manual-only skip)
 */
export function generateSecondarySchedule(
  departmentId: string,
  start: Date,
  end: Date,
  tasks: SecondaryTaskInput[],
  opts: GenerateOptions = {}
): PlanResult {
  // Local helpers
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
    // Prefer ledger-derived busy days; fallback to legacy primaryTasks
    const key = dateKey(day);
    if (Array.isArray(worker.primaryBusyDaysDDMM) && worker.primaryBusyDaysDDMM.length > 0) {
      return worker.primaryBusyDaysDDMM.includes(key);
    }
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return (worker.primaryTasks || []).some((t) => {
      const s = new Date(t.startDate);
      const e = new Date(t.endDate);
      return !(e < dayStart || s > dayEnd);
    });
  };
  const spansWeekend = (worker: WorkerPayload, friday: Date): boolean => {
    // Prefer ledger-based check: primary closing on this Friday implies weekend span
    const fKey = dateKey(friday);
    if (Array.isArray(worker.mandatoryClosingDates) && worker.mandatoryClosingDates.includes(fKey)) return true;
    if (Array.isArray(worker.primaryBusyDaysDDMM) && worker.primaryBusyDaysDDMM.includes(fKey)) return true;
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
    // Consult ledger last closing if available
    if (!last) {
      const lastDDMM = (payload.workers[workerId]?.lastClosingFridayDDMM || null) as string | null;
      if (lastDDMM) {
        const [d, m, y] = lastDDMM.split('/').map(Number);
        const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
        if (dt < friday) last = dt;
      }
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
  const isQualified = (task: SecondaryTaskInput, worker: WorkerPayload): boolean => {
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

  // Debug helpers (toggle-able)
  const DEBUG_ENGINE = true;
  const dbgGroup = (label: string) => { if (!DEBUG_ENGINE) return; try { /* eslint-disable no-console */ console.groupCollapsed(label); /* eslint-enable no-console */ } catch {} };
  const dbgLog = (...args: any[]) => { if (!DEBUG_ENGINE) return; try { /* eslint-disable no-console */ console.log(...args); /* eslint-enable no-console */ } catch {} };
  const dbgEnd = () => { if (!DEBUG_ENGINE) return; try { /* eslint-disable no-console */ console.groupEnd(); /* eslint-enable no-console */ } catch {} };

  // 1) Load payload
  const key = `secondaryPlanning:${departmentId}`;
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error(`Local payload not found for ${key}`);
  const payload: PlanningPayload = JSON.parse(raw);
  // TTL freshness validation (5 minutes)
  try {
    const genAt = payload?.generatedAt ? Date.parse(payload.generatedAt) : 0;
    if (!genAt || (Date.now() - genAt) > (5 * 60 * 1000)) {
      throw new Error('Planning cache is stale (>5m). Refresh the date range to regenerate.');
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error('Planning cache freshness validation failed');
  }

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
    // Prioritize workers whose optimalClosingDates contains this Friday.
    const need = Math.max(0, required - forced.length);
    const chosen: WeekendCloserDecision[] = [];
    const getStats = (wid: string) => {
      const s = (payload as any).stats?.perWorker?.[wid] || {};
      return { totalSecondary: (s.totalSecondary as number) || 0, closingAccuracyPct: (typeof s.closingAccuracyPct === 'number' ? (s.closingAccuracyPct as number) : null) };
    };
    const optFirst = candidates.filter((c) => c.onOptimal).sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? -1 : 1;
      if (a.weeksUntilDue !== b.weeksUntilDue) return a.weeksUntilDue - b.weeksUntilDue;
      // Use accuracy (lower first) then total secondary (lower first)
      const as = getStats(a.wid); const bs = getStats(b.wid);
      if ((as.closingAccuracyPct ?? 0) !== (bs.closingAccuracyPct ?? 0)) return (as.closingAccuracyPct ?? 0) - (bs.closingAccuracyPct ?? 0);
      if ((as.totalSecondary || 0) !== (bs.totalSecondary || 0)) return (as.totalSecondary || 0) - (bs.totalSecondary || 0);
      return a.wid.localeCompare(b.wid);
    });
    const rest = candidates.filter((c) => !c.onOptimal).sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? -1 : 1;
      if (a.weeksUntilDue !== b.weeksUntilDue) return a.weeksUntilDue - b.weeksUntilDue;
      const as = getStats(a.wid); const bs = getStats(b.wid);
      if ((as.closingAccuracyPct ?? 0) !== (bs.closingAccuracyPct ?? 0)) return (as.closingAccuracyPct ?? 0) - (bs.closingAccuracyPct ?? 0);
      if ((as.totalSecondary || 0) !== (bs.totalSecondary || 0)) return (as.totalSecondary || 0) - (bs.totalSecondary || 0);
      return a.wid.localeCompare(b.wid);
    });

    for (const c of [...optFirst, ...rest]) {
      if (chosen.length >= need) break;
      const reason = c.onOptimal ? 'on_optimal' : (c.missed ? 'missed_optimal' : (c.weeksUntilDue === 0 ? 'due' : 'fairness'));
      chosen.push({ workerId: c.wid, reason });
      (assignedClosers[fKey] = assignedClosers[fKey] || new Set()).add(c.wid);
    }
    closersByFriday[fKey] = { forced, assigned: chosen, requiredCount: required };

    // Debug weekend closer selection per Friday
    dbgGroup(`[Engine][WeekendClosers] Friday ${fKey}`);
    dbgLog('forced', forced);
    dbgLog('required', required);
    dbgLog('candidates', candidates.map(c => ({ wid: c.wid, onOptimal: c.onOptimal, missed: c.missed, weeksUntilDue: c.weeksUntilDue })));
    dbgLog('chosen', chosen);
    dbgEnd();
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

  // 5a) Weekend triads: same worker for Thu+Fri+Sat per task.
  // Use the precomputed closers for each Friday (assigned list),
  // never assign workers with closingInterval === 0, and enforce no-primary per triad day.
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
    const closerQueue = (closersByFriday[fKey]?.assigned || []).map((a) => a.workerId);

    for (const task of weekendTasks) {
      let chosenWid: string | null = null;
      let chosenFromClosers = false;
      // Pull from closerQueue first
      while (closerQueue.length > 0 && !chosenWid) {
        const wid = closerQueue.shift() as string;
        const worker = payload.workers[wid];
        if (!worker) continue;
        if (worker.profile.closingInterval === 0) continue;
        if (!isQualified(task, worker)) continue;
        if (spansWeekend(worker, friday)) continue; // has primary across weekend → skip
        if (forced.includes(wid)) continue;         // never give Y-task to forced closer (primary)
        const dkThu = dateKey(thu); const dkFri = fKey; const dkSat = dateKey(sat);
        if (assignedOnDay[dkThu]?.has(wid) || assignedOnDay[dkFri]?.has(wid) || assignedOnDay[dkSat]?.has(wid)) continue;
        // Weekly cap check on Friday's week
        const wk = getWeekKey(friday);
        const cnt = (yCountWeek[wid]?.[wk] || 0);
        if (cnt > options.weeklyCapSequence[options.weeklyCapSequence.length - 1]) continue;
        chosenWid = wid;
        chosenFromClosers = true;
      }

      // Fallback: if no closer available, search full candidate space (very rare)
      if (!chosenWid) {
        for (const cap of options.weeklyCapSequence) {
          for (const wid of Object.keys(payload.workers)) {
            const worker = payload.workers[wid];
            if (worker.profile.closingInterval === 0) continue;
            if (!isQualified(task, worker)) continue;
            if (spansWeekend(worker, friday)) continue;
            if (forced.includes(wid)) continue;
            const dkThu = dateKey(thu); const dkFri = fKey; const dkSat = dateKey(sat);
            if (assignedOnDay[dkThu]?.has(wid) || assignedOnDay[dkFri]?.has(wid) || assignedOnDay[dkSat]?.has(wid)) continue;
            const wk = getWeekKey(friday);
            const cnt = (yCountWeek[wid]?.[wk] || 0);
            if (cnt > cap) continue;
            chosenWid = wid; break;
          }
          if (chosenWid) break;
        }
      }

      if (!chosenWid) { warnings.push(`Weekend ${fKey}: no candidate for task ${task.id}`); continue; }

      const triadDays = [thu, friday, sat].filter((d) => d >= dates[0] && d <= dates[dates.length - 1]);
      for (const d of triadDays) {
        // Strict primary check per day (safety)
        if (hasPrimaryOn(payload.workers[chosenWid], d)) { warnings.push(`Primary overlap blocked on ${fmtDDMM(d)} for worker ${chosenWid}`); continue; }
        const dk = dateKey(d);
        assignments.push({ date: dk, taskId: task.id, workerId: chosenWid });
        assignedOnDay[dk].add(chosenWid);
        assignedCellByDayTask[dk].add(task.id);
        const wkKey = getWeekKey(d);
        (yCountWeek[chosenWid] = yCountWeek[chosenWid] || {})[wkKey] = (yCountWeek[chosenWid][wkKey] || 0) + 1;
        yCountTotal[chosenWid] = (yCountTotal[chosenWid] || 0) + 1;
      }

      // Debug weekend triad decision for this task
      dbgLog('[Engine][WeekendTriad]', { friday: fKey, taskId: task.id, chosen: chosenWid, source: chosenFromClosers ? 'closers' : 'fallback' });
    }
  }

  // 5b) Weekdays assignment and fill remaining weekend cells not covered by triads
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
          if (!task.assign_weekends) continue;                          // tasks without weekend permission are skipped on weekend
          if (assignedCellByDayTask[keyDay]?.has(task.id)) continue;    // filled by triad already
        } else {
          if (assignedCellByDayTask[keyDay]?.has(task.id)) { dbgLog('[Engine][WeekdaySkip]', { day: keyDay, taskId: task.id, reason: 'alreadyFilledThisDay' }); continue; }
        }

        let best: { wid: string; score: number, breakdown: { pref: number; scarcity: number; headroom: number; fairness: number } } | null = null;
        let candidatesCount = 0;
        let dbgNotQualified = 0, dbgPrimaryOverlap = 0, dbgAlreadyAssignedToday = 0, dbgForcedCloser = 0, dbgWeekendPrimarySpan = 0, dbgWeeklyCap = 0, dbgBlockedPref = 0;
        const considered: Array<any> = [];
        for (const wid of Object.keys(payload.workers)) {
          const worker = payload.workers[wid];
          if (!isQualified(task, worker)) { dbgNotQualified++; considered.push({ wid, skip: 'notQualified' }); continue; }
          if (hasPrimaryOn(worker, day)) { dbgPrimaryOverlap++; considered.push({ wid, skip: 'primaryOverlap' }); continue; }
          if (assignedOnDay[keyDay].has(wid)) { dbgAlreadyAssignedToday++; considered.push({ wid, skip: 'alreadyAssignedToday' }); continue; }
          if (fridayKey && forced.includes(wid)) { dbgForcedCloser++; considered.push({ wid, skip: 'forcedCloser' }); continue; }
          if (fridayKey && spansWeekend(worker, fridayForWeekend!)) { dbgWeekendPrimarySpan++; considered.push({ wid, skip: 'weekendPrimarySpan' }); continue; }

          const wk = getWeekKey(day);
          const countWeek = (yCountWeek[wid]?.[wk] || 0);
          if (countWeek > cap) { dbgWeeklyCap++; considered.push({ wid, skip: 'weeklyCap' }); continue; }

          const pref = preferenceOn(worker, day, task.id);
          if (pref.blocked) { dbgBlockedPref++; considered.push({ wid, skip: 'blockedPref' }); continue; }
          candidatesCount++;

          const scarcity = qualifiedCountByTask[task.id] ?? 0;
          const scarcityBonus = Math.max(0, (options.scarcityThreshold + 1) - scarcity);
          const weeklyCnt = (yCountWeek[wid]?.[wk] || 0);
          const totalCnt = (yCountTotal[wid] || 0);
          let s = 0;
          if (pref.preferred) s += 2;
          s += scarcityBonus;
          s += (cap - weeklyCnt);
          s += (5 - Math.min(5, totalCnt));

          if (!best || s > best.score) {
            best = { wid, score: s, breakdown: { pref: pref.preferred ? 2 : 0, scarcity: scarcityBonus, headroom: (cap - weeklyCnt), fairness: (5 - Math.min(5, totalCnt)) } } as any;
          } else if (s === best.score) {
            // Tie-breaker with department stats: prefer lower totalSecondary
            const sA = ((payload as any).stats?.perWorker?.[wid]?.totalSecondary as number) || 0;
            const sB = ((payload as any).stats?.perWorker?.[(best as any).wid]?.totalSecondary as number) || 0;
            if (sA !== sB) {
              if (sA < sB) best = { wid, score: s, breakdown: { pref: pref.preferred ? 2 : 0, scarcity: scarcityBonus, headroom: (cap - weeklyCnt), fairness: (5 - Math.min(5, totalCnt)) } } as any;
            } else if (wid.localeCompare((best as any).wid) < 0) {
              best = { wid, score: s, breakdown: { pref: pref.preferred ? 2 : 0, scarcity: scarcityBonus, headroom: (cap - weeklyCnt), fairness: (5 - Math.min(5, totalCnt)) } } as any;
            }
          }
          considered.push({ wid, score: s, breakdown: { pref: pref.preferred ? 2 : 0, scarcity: scarcityBonus, headroom: (cap - weeklyCnt), fairness: (5 - Math.min(5, totalCnt)) } });
        }

        if (best) {
          assignments.push({ date: keyDay, taskId: task.id, workerId: best.wid });
          assignedOnDay[keyDay].add(best.wid);
          assignedCellByDayTask[keyDay].add(task.id);
          yCountTotal[best.wid] = (yCountTotal[best.wid] || 0) + 1;
          const wkKey = getWeekKey(day);
          (yCountWeek[best.wid] = yCountWeek[best.wid] || {})[wkKey] = (yCountWeek[best.wid][wkKey] || 0) + 1;
          dbgLog('[Engine][WeekdayAssign]', { day: keyDay, taskId: task.id, chosen: best.wid, score: best.score, breakdown: best.breakdown, cap });
          // Show top 5 candidates considered (for tuning)
          const top = considered.filter(c => c.score !== undefined).sort((a, b) => (b.score - a.score)).slice(0, 5);
          dbgLog('[Engine][WeekdayPool]', { day: keyDay, taskId: task.id, cap, topCandidates: top });
        } else {
          // Debug: no candidate found for this cell
          dbgLog('[Engine][WeekdayNoCandidate]', { day: keyDay, taskId: task.id, cap, reasons: { notQualified: dbgNotQualified, primaryOverlap: dbgPrimaryOverlap, alreadyAssignedToday: dbgAlreadyAssignedToday, forcedCloser: dbgForcedCloser, weekendPrimarySpan: dbgWeekendPrimarySpan, weeklyCap: dbgWeeklyCap, blockedPref: dbgBlockedPref } });
          // And show a few close misses (those filtered only by cap or pref)
          const near = considered.filter(c => c.skip === 'weeklyCap' || c.skip === 'blockedPref').slice(0, 5);
          if (near.length > 0) dbgLog('[Engine][WeekdayNearMiss]', { day: keyDay, taskId: task.id, cap, near });
        }
      }
    }
  }

  // 6) Diagnostics
  Object.keys(closersByFriday).forEach((fk) => {
    const info = closersByFriday[fk];
    if (info.assigned.length + info.forced.length < info.requiredCount) {
      warnings.push(
        `Friday ${fk}: shortfall ${info.requiredCount - (info.assigned.length + info.forced.length)} (forced=${info.forced.length}, assigned=${info.assigned.length})`
      );
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


