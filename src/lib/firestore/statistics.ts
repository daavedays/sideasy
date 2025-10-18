/**
 * Statistics Summary Updater
 *
 * Maintains department-level rollups under:
 *   departments/{departmentId}/statistics/summary
 *
 * Counting rules (confirmed):
 * - Primary tasks: count contiguous segments per worker within a schedule (not per-day). Adjacent weeks of the same task count as 1.
 * - Secondary tasks: weekdays (Sun–Wed) count per day; weekend triads (Thu+Fri+Sat) count as 1 by counting Friday only.
 * - Preferences do not count.
 * - Closing (separate from counts): handled in byWorker ledger; accuracy uses actualClosingInterval vs closingInterval target.
 */

import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Assignment } from '../../types/primarySchedule.types';

// === Types for summary doc (minimal and flexible) ===
type PerWorkerEntry = {
  name: string;
  role?: 'owner' | 'admin' | 'worker';
  totalPrimary: number;
  totalSecondary: number;
  combined: number;
  closingIntervalTarget?: number | null;
  actualClosingInterval?: number | null;
  closingAccuracyPct?: number | null;
  lastClosingDate?: Timestamp | null;
  updatedAt: Timestamp;
};

type StatisticsSummary = {
  totals: {
    workers: number;
    primaryTasks: number;
    secondaryTasks: number;
    combined: number;
    analyzedWorkers: number;
  };
  perWorker: Record<string, PerWorkerEntry>;
  accuracySummary: {
    medianPct: number;
    weightedAvgPct: number; // simple average for now
    medianAbsDeltaWeeks: number; // from actual vs target
    highAccuracyCount: number; // >= 80%
    lowAccuracyCount: number;  // < 50%
  };
  workloadSummary: {
    averageSecondary: number;
    medianSecondary: number;
    overworkedCount: number;
    underworkedCount: number;
    balancedCount: number;
    thresholds: { overPct: number; underPct: number };
  };
  charts?: {
    secondaryShareByWorker?: Record<string, number>;
  };
  updatedAt: Timestamp;
  version: number;
};

// === Public API ===

/**
 * Update summary after a primary schedule save/edit using deltas.
 * Only changed workers are required.
 */
export async function updateSummaryForPrimaryDelta(
  departmentId: string,
  originalAssignments: Map<string, Assignment>,
  newAssignments: Map<string, Assignment>,
  changedWorkerIds: Set<string>
): Promise<void> {
  // Build per-worker contiguous segment counts for original and new
  const beforeCounts = countPrimarySegmentsByWorker(originalAssignments);
  const afterCounts = countPrimarySegmentsByWorker(newAssignments);

  // Compute deltas only for changed workers
  const deltas: Record<string, { dPrimary: number }> = {};
  for (const wid of changedWorkerIds) {
    const before = beforeCounts.get(wid) || 0;
    const after = afterCounts.get(wid) || 0;
    deltas[wid] = { dPrimary: after - before };
  }

  await applyDeltasToSummary(departmentId, deltas, /*secondaryAdditives*/ undefined);
}

/**
 * Update summary after a secondary schedule save/edit using deltas.
 * Counting: weekdays (Sun–Wed) per day; weekend triads as 1 (count Friday only).
 */
export async function updateSummaryForSecondarySave(
  departmentId: string,
  prevAssignments: Record<string, { workerId: string; taskId: string; date: Timestamp }> | undefined,
  newAssignments: Record<string, { workerId: string; taskId: string; date: Timestamp }>
): Promise<void> {
  const beforeCounts = countSecondaryUnitsByWorker(prevAssignments || {});
  const afterCounts = countSecondaryUnitsByWorker(newAssignments || {});

  // Union of workerIds
  const workerIds = new Set<string>([
    ...Object.keys(beforeCounts),
    ...Object.keys(afterCounts),
  ]);

  const deltas: Record<string, { dSecondary: number }> = {};
  workerIds.forEach((wid) => {
    const d = (afterCounts[wid] || 0) - (beforeCounts[wid] || 0);
    if (d !== 0) deltas[wid] = { dSecondary: d };
  });

  await applyDeltasToSummary(departmentId, /*primaryDeltas*/ undefined, deltas);
}

/**
 * Refresh summary for a single worker by reloading latest byWorker ledger fields
 * and worker index info, then recomputing department aggregates.
 */
export async function refreshSummaryForWorker(
  departmentId: string,
  workerId: string
): Promise<void> {
  const summaryRef = doc(db, 'departments', departmentId, 'statistics', 'summary');
  const snap = await getDoc(summaryRef);
  const summary: StatisticsSummary = (snap.exists() ? (snap.data() as any) : null) as any || defaultSummary();

  // pull workers index and byWorker for this worker
  const indexSnap = await getDoc(doc(db, 'departments', departmentId, 'workers', 'index'));
  const workersIndex = (indexSnap.exists() ? (indexSnap.data() as any).workers || {} : {}) as Record<string, any>;

  const byWorkerSnap = await getDoc(doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', workerId));
  const bw = (byWorkerSnap.exists() ? (byWorkerSnap.data() as any) : {}) || {};
  const w = workersIndex[workerId] || {};

  const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || workerId;
  const entry = summary.perWorker[workerId] || {
    name,
    role: (w.role as any) || 'worker',
    totalPrimary: 0,
    totalSecondary: 0,
    combined: 0,
    closingIntervalTarget: typeof w.closingInterval === 'number' ? w.closingInterval : null,
    actualClosingInterval: null,
    closingAccuracyPct: null,
    lastClosingDate: null,
    updatedAt: Timestamp.now(),
  } as PerWorkerEntry;

  entry.name = name;
  entry.role = (w.role as any) || entry.role;
  entry.closingIntervalTarget = typeof w.closingInterval === 'number' ? w.closingInterval : entry.closingIntervalTarget ?? null;
  entry.actualClosingInterval = typeof bw.actualClosingInterval === 'number' ? bw.actualClosingInterval : entry.actualClosingInterval ?? null;
  entry.lastClosingDate = (bw.lastClosingDate || entry.lastClosingDate || null) as Timestamp | null;
  entry.closingAccuracyPct = computeAccuracyPct(entry.actualClosingInterval, entry.closingIntervalTarget);
  entry.updatedAt = Timestamp.now();

  summary.perWorker[workerId] = entry;

  // Update totals from current perWorker set
  summary.totals.workers = Object.keys(workersIndex).length;
  summary.totals.analyzedWorkers = Object.keys(summary.perWorker).length;
  summary.totals.combined = (summary.totals.primaryTasks || 0) + (summary.totals.secondaryTasks || 0);

  recomputeWorkloadSummary(summary);
  recomputeAccuracySummary(summary);
  recomputeCharts(summary);
  summary.updatedAt = Timestamp.now();

  if (!snap.exists()) {
    await setDoc(summaryRef, summary as any, { merge: false });
  } else {
    await setDoc(summaryRef, summary as any, { merge: true });
  }
}

// === Internal helpers ===

function countPrimarySegmentsByWorker(map: Map<string, Assignment>): Map<string, number> {
  const byWorker = new Map<string, Assignment[]>();
  map.forEach((a) => {
    const wid = String(a.workerId || '').trim();
    if (!wid) return;
    if (!byWorker.has(wid)) byWorker.set(wid, []);
    byWorker.get(wid)!.push(a);
  });

  const result = new Map<string, number>();
  byWorker.forEach((arr, wid) => {
    const sorted = [...arr].sort((x, y) => (x.weekNumber ?? 0) - (y.weekNumber ?? 0));
    let segments = 0;
    let lastWeek: number | null = null;
    let lastTask: string | null = null;
    for (const a of sorted) {
      const wk = (a.weekNumber ?? 0);
      const task = String(a.taskId || '');
      const isContiguous = lastWeek !== null && wk === (lastWeek + 1) && task === lastTask;
      if (!isContiguous) segments += 1;
      lastWeek = wk;
      lastTask = task;
    }
    result.set(wid, segments);
  });
  return result;
}

function countSecondaryUnitsByWorker(assignments: Record<string, { workerId: string; date: Timestamp }>): Record<string, number> {
  const counts: Record<string, number> = {};
  Object.values(assignments).forEach((a) => {
    const wid = String(a.workerId || '').trim();
    if (!wid) return;
    const d = (a.date as Timestamp).toDate();
    const day = d.getDay(); // 0..6 (Sun..Sat)
    // Weekdays Sun–Wed count per day; Friday counts as weekend unit; skip Thu/Sat to avoid triad double-count
    const isWeekday = day >= 0 && day <= 3;
    const isFriday = day === 5;
    const add = isWeekday || isFriday ? 1 : 0;
    if (add === 0) return;
    counts[wid] = (counts[wid] || 0) + add;
  });
  return counts;
}

async function applyDeltasToSummary(
  departmentId: string,
  primaryDeltas?: Record<string, { dPrimary: number }>,
  secondaryDeltas?: Record<string, { dSecondary: number }>
): Promise<void> {
  const summaryRef = doc(db, 'departments', departmentId, 'statistics', 'summary');
  const snap = await getDoc(summaryRef);
  const summary: StatisticsSummary = (snap.exists() ? (snap.data() as any) : null) as any || defaultSummary();

  // Load workers index for names/roles/targets
  const indexSnap = await getDoc(doc(db, 'departments', departmentId, 'workers', 'index'));
  const workersIndex = (indexSnap.exists() ? (indexSnap.data() as any).workers || {} : {}) as Record<string, any>;

  // Apply per-worker deltas
  let dPrimaryTotal = 0;
  let dSecondaryTotal = 0;

  const touchWorker = (wid: string) => {
    if (!summary.perWorker[wid]) {
      const w = workersIndex[wid] || {};
      const name = `${w.firstName || ''} ${w.lastName || ''}`.trim() || wid;
      summary.perWorker[wid] = {
        name,
        role: (w.role as any) || 'worker',
        totalPrimary: 0,
        totalSecondary: 0,
        combined: 0,
        closingIntervalTarget: typeof w.closingInterval === 'number' ? w.closingInterval : null,
        actualClosingInterval: null,
        closingAccuracyPct: null,
        lastClosingDate: null,
        updatedAt: Timestamp.now(),
      } as PerWorkerEntry;
    }
  };

  if (primaryDeltas) {
    Object.entries(primaryDeltas).forEach(([wid, v]) => {
      touchWorker(wid);
      const entry = summary.perWorker[wid];
      entry.totalPrimary = Math.max(0, (entry.totalPrimary || 0) + (v.dPrimary || 0));
      entry.combined = (entry.totalPrimary || 0) + (entry.totalSecondary || 0);
      entry.updatedAt = Timestamp.now();
      dPrimaryTotal += (v.dPrimary || 0);
    });
  }

  if (secondaryDeltas) {
    Object.entries(secondaryDeltas).forEach(([wid, v]) => {
      touchWorker(wid);
      const entry = summary.perWorker[wid];
      entry.totalSecondary = Math.max(0, (entry.totalSecondary || 0) + (v.dSecondary || 0));
      entry.combined = (entry.totalPrimary || 0) + (entry.totalSecondary || 0);
      entry.updatedAt = Timestamp.now();
      dSecondaryTotal += (v.dSecondary || 0);
    });
  }

  // Pull latest actualClosingInterval from byWorker and compute accuracy
  const affected = new Set<string>([
    ...Object.keys(primaryDeltas || {}),
    ...Object.keys(secondaryDeltas || {}),
  ]);
  for (const wid of affected) {
    const byWorker = await getDoc(doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', wid));
    const bw = (byWorker.exists() ? (byWorker.data() as any) : {}) || {};
    const target = summary.perWorker[wid]?.closingIntervalTarget ?? (typeof workersIndex[wid]?.closingInterval === 'number' ? workersIndex[wid].closingInterval : null);
    const actual: number | null = typeof bw.actualClosingInterval === 'number' ? bw.actualClosingInterval : null;
    const lastClosingDate: Timestamp | null = bw.lastClosingDate || null;
    const accPct = computeAccuracyPct(actual, target);
    const entry = summary.perWorker[wid];
    entry.actualClosingInterval = actual;
    entry.closingIntervalTarget = target;
    entry.closingAccuracyPct = accPct;
    entry.lastClosingDate = lastClosingDate || entry.lastClosingDate || null;
    entry.updatedAt = Timestamp.now();
  }

  // Update totals
  summary.totals.primaryTasks = Math.max(0, (summary.totals.primaryTasks || 0) + dPrimaryTotal);
  summary.totals.secondaryTasks = Math.max(0, (summary.totals.secondaryTasks || 0) + dSecondaryTotal);
  summary.totals.combined = (summary.totals.primaryTasks || 0) + (summary.totals.secondaryTasks || 0);
  summary.totals.workers = Object.keys(workersIndex).length;
  summary.totals.analyzedWorkers = Object.keys(summary.perWorker).length;

  // Recompute department-level summaries from perWorker
  recomputeWorkloadSummary(summary);
  recomputeAccuracySummary(summary);
  recomputeCharts(summary);

  summary.updatedAt = Timestamp.now();

  if (!snap.exists()) {
    await setDoc(summaryRef, summary as any, { merge: false });
  } else {
    await setDoc(summaryRef, summary as any, { merge: true });
  }
}

function defaultSummary(): StatisticsSummary {
  return {
    totals: {
      workers: 0,
      primaryTasks: 0,
      secondaryTasks: 0,
      combined: 0,
      analyzedWorkers: 0,
    },
    perWorker: {},
    accuracySummary: {
      medianPct: 0,
      weightedAvgPct: 0,
      medianAbsDeltaWeeks: 0,
      highAccuracyCount: 0,
      lowAccuracyCount: 0,
    },
    workloadSummary: {
      averageSecondary: 0,
      medianSecondary: 0,
      overworkedCount: 0,
      underworkedCount: 0,
      balancedCount: 0,
      thresholds: { overPct: 20, underPct: -20 },
    },
    charts: {},
    updatedAt: Timestamp.now(),
    version: 1,
  };
}

function computeAccuracyPct(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target <= 0) return null;
  const pct = 100 - Math.min(100, (Math.abs(actual - target) / Math.max(1, target)) * 100);
  return Math.round(pct * 10) / 10;
}

function recomputeWorkloadSummary(summary: StatisticsSummary) {
  const values = Object.values(summary.perWorker).map((w) => w.totalSecondary || 0);
  if (values.length === 0) {
    summary.workloadSummary.averageSecondary = 0;
    summary.workloadSummary.medianSecondary = 0;
    summary.workloadSummary.overworkedCount = 0;
    summary.workloadSummary.underworkedCount = 0;
    summary.workloadSummary.balancedCount = 0;
    return;
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const overPct = summary.workloadSummary.thresholds.overPct;
  const underPct = summary.workloadSummary.thresholds.underPct;
  let over = 0, under = 0, bal = 0;
  Object.values(summary.perWorker).forEach((w) => {
    const devPct = avg === 0 ? 0 : ((w.totalSecondary || 0) - avg) / avg * 100;
    if (devPct > overPct) over++; else if (devPct < underPct) under++; else bal++;
  });
  summary.workloadSummary.averageSecondary = Math.round(avg * 10) / 10;
  summary.workloadSummary.medianSecondary = Math.round(median * 10) / 10;
  summary.workloadSummary.overworkedCount = over;
  summary.workloadSummary.underworkedCount = under;
  summary.workloadSummary.balancedCount = bal;
}

function recomputeAccuracySummary(summary: StatisticsSummary) {
  const entries = Object.values(summary.perWorker).filter((w) => w.closingAccuracyPct != null && !Number.isNaN(w.closingAccuracyPct));
  if (entries.length === 0) {
    summary.accuracySummary.medianPct = 0;
    summary.accuracySummary.weightedAvgPct = 0;
    summary.accuracySummary.medianAbsDeltaWeeks = 0;
    summary.accuracySummary.highAccuracyCount = 0;
    summary.accuracySummary.lowAccuracyCount = 0;
    return;
  }
  const arr = entries.map((w) => w.closingAccuracyPct as number).sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  const median = arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

  // Median absolute delta in weeks (from target vs actual)
  const deltas = entries
    .map((w) => {
      const target = w.closingIntervalTarget ?? 0;
      const actual = w.actualClosingInterval ?? 0;
      return Math.abs(actual - target);
    })
    .sort((a, b) => a - b);
  const midD = Math.floor(deltas.length / 2);
  const medianDelta = deltas.length % 2 === 0 ? (deltas[midD - 1] + deltas[midD]) / 2 : deltas[midD];

  summary.accuracySummary.medianPct = Math.round(median * 10) / 10;
  summary.accuracySummary.weightedAvgPct = Math.round(avg * 10) / 10;
  summary.accuracySummary.medianAbsDeltaWeeks = Math.round(medianDelta * 10) / 10;
  summary.accuracySummary.highAccuracyCount = entries.filter((w) => (w.closingAccuracyPct as number) >= 80).length;
  summary.accuracySummary.lowAccuracyCount = entries.filter((w) => (w.closingAccuracyPct as number) < 50).length;
}

function recomputeCharts(summary: StatisticsSummary) {
  const totals = Object.values(summary.perWorker).reduce((acc, w) => acc + (w.totalSecondary || 0), 0);
  const share: Record<string, number> = {};
  if (totals > 0) {
    Object.entries(summary.perWorker).forEach(([wid, w]) => {
      share[wid] = Math.round(((w.totalSecondary || 0) / totals) * 1000) / 10; // percentage with 0.1 precision
    });
  }
  summary.charts = summary.charts || {};
  summary.charts.secondaryShareByWorker = share;
}


