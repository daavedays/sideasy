/**
 * Worker Primary Tasks View (Read-Only)
 * 
 * Read-only schedules page for workers to view saved primary task schedules.
 * - Lists recent schedules (latest 4) with a selector
 * - Renders PrimaryTaskTable in read-only mode
 * - Shows only the signed-in worker's row
 * - Uses localStorage caching to reduce Firestore reads (TTL: 5 minutes)
 * 
 * Location: src/pages/worker/primaryTasks.tsx
 * Purpose: Worker-facing primary schedules viewer
 */

import React, { useEffect, useMemo, useState } from 'react';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import PrimaryTaskTable from '../../components/shared/PrimaryTaskTable';
import { useAuth } from '../../hooks/useAuth';
import { useDepartment } from '../../hooks/useDepartment';
import { PastScheduleDisplay, Assignment, AssignmentMap, Week, Worker as TableWorker } from '../../types/primarySchedule.types';
import { getPastSchedulesDisplay, getScheduleAssignments } from '../../lib/firestore/primarySchedules';
import { calculateWeeksFromDateRange } from '../../lib/utils/weekUtils';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Button from '../../components/ui/Button';

// Workers index path: departments/{departmentId}/workers/index
// We'll read the consolidated workers map once to build peer rows

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CachedSchedules = Array<{
  scheduleId: string;
  label: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  year: number;
  updatedAt: string; // ISO
}>;

type SerializedAssignment = Omit<Assignment, 'startDate' | 'endDate'> & {
  startDate: string; // ISO
  endDate: string;   // ISO
};

type CachedAssignments = Array<[string, SerializedAssignment]>; // [cellKey, assignment]

const getCache = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { ts, data } = parsed as { ts: number; data: T };
    if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
};

const setCache = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
};

const serializeAssignments = (map: AssignmentMap): CachedAssignments => {
  const entries: CachedAssignments = [];
  map.forEach((a, k) => {
    entries.push([
      k,
      {
        ...a,
        startDate: a.startDate.toISOString(),
        endDate: a.endDate.toISOString(),
      },
    ]);
  });
  return entries;
};

const deserializeAssignments = (entries: CachedAssignments): AssignmentMap => {
  const map: AssignmentMap = new Map();
  entries.forEach(([k, a]) => {
    map.set(k, {
      ...a,
      startDate: new Date(a.startDate),
      endDate: new Date(a.endDate),
    });
  });
  return map;
};

const buildWorkerRow = async (
  departmentId: string,
  userId: string
): Promise<TableWorker | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return null;
    const u = userSnap.data() as any;
    const firstName: string = u.firstName || '';
    const lastName: string = u.lastName || '';
    const email: string = u.email || '';
    const role: 'owner' | 'admin' | 'worker' = 'worker';
    return {
      workerId: userId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || email,
      email,
      role,
      isActive: true,
    };
  } catch {
    return null;
  }
};

const PrimaryTasks: React.FC = () => {
  const { user } = useAuth();
  const { departmentId } = useDepartment();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<PastScheduleDisplay[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [assignments, setAssignments] = useState<AssignmentMap>(new Map());
  const [workerRow, setWorkerRow] = useState<TableWorker | null>(null);
  const [peers, setPeers] = useState<TableWorker[]>([]);
  const [onlyMe, setOnlyMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSchedule = useMemo(() => schedules.find(s => s.scheduleId === selectedScheduleId) || null, [schedules, selectedScheduleId]);

  // Load worker row
  useEffect(() => {
    const initWorker = async () => {
      if (!user?.uid || !departmentId) return;
      const row = await buildWorkerRow(departmentId, user.uid);
      setWorkerRow(row);
    };
    initWorker();
  }, [user?.uid, departmentId]);

  // Load schedules with cache
  useEffect(() => {
    const loadSchedules = async () => {
      if (!departmentId) return;
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `worker:primarySchedules:${departmentId}`;
        const cached = getCache<CachedSchedules>(cacheKey);
        if (cached) {
          const restored: PastScheduleDisplay[] = cached.map((c) => ({
            scheduleId: c.scheduleId,
            label: c.label,
            startDate: new Date(c.startDate),
            endDate: new Date(c.endDate),
            year: c.year,
            updatedAt: new Date(c.updatedAt),
          }));
          setSchedules(restored);
          if (restored.length > 0) setSelectedScheduleId(restored[0].scheduleId);
        } else {
          const list = await getPastSchedulesDisplay(departmentId);
          setSchedules(list);
          if (list.length > 0) setSelectedScheduleId(list[0].scheduleId);
          const toCache: CachedSchedules = list.map((s) => ({
            scheduleId: s.scheduleId,
            label: s.label,
            startDate: s.startDate.toISOString(),
            endDate: s.endDate.toISOString(),
            year: s.year,
            updatedAt: s.updatedAt.toISOString(),
          }));
          setCache(cacheKey, toCache);
        }
      } catch (e) {
        setError('שגיאה בטעינת תורנויות');
      } finally {
        setLoading(false);
      }
    };
    loadSchedules();
  }, [departmentId]);

  // Load peers from consolidated workers index (single read)
  useEffect(() => {
    const loadPeers = async () => {
      if (!departmentId) return;
      try {
        const indexRef = doc(db, 'departments', departmentId, 'workers', 'index');
        const snap = await getDoc(indexRef);
        const rows: TableWorker[] = [];
        if (snap.exists()) {
          const data = snap.data() as any;
          const workersMap = (data.workers || {}) as Record<string, any>;
          Object.values(workersMap).forEach((entry: any) => {
            if (entry.activity === 'deleted') return;
            const row: TableWorker = {
              workerId: entry.workerId,
              firstName: entry.firstName,
              lastName: entry.lastName,
              fullName: `${entry.firstName} ${entry.lastName}`,
              email: entry.email,
              role: entry.role,
              isActive: entry.activity === 'active',
            };
            rows.push(row);
          });
        }
        setPeers(rows);
      } catch (e) {
        // non-fatal
      }
    };
    loadPeers();
  }, [departmentId]);

  // On schedule selection: compute weeks and load assignments (with cache)
  useEffect(() => {
    const loadAssignments = async () => {
      if (!departmentId || !selectedSchedule) return;
      setError(null);
      try {
        setWeeks(calculateWeeksFromDateRange(selectedSchedule.startDate, selectedSchedule.endDate));
        const cacheKey = `worker:primaryAssignments:${departmentId}:${selectedSchedule.scheduleId}`;
        const cached = getCache<CachedAssignments>(cacheKey);
        if (cached) {
          const restored = deserializeAssignments(cached);
          setAssignments(restored);
          return;
        }
        const map = await getScheduleAssignments(departmentId, selectedSchedule.scheduleId);
        setAssignments(map);
        setCache(cacheKey, serializeAssignments(map));
      } catch (e) {
        setError('שגיאה בטעינת נתוני התורנות');
      }
    };
    loadAssignments();
  }, [departmentId, selectedSchedule]);

  // Filter rows and assignments by toggle
  const { rowsForTable, assignmentsForTable } = useMemo(() => {
    const currentUserId = user?.uid;
    if (!currentUserId) return { rowsForTable: [] as TableWorker[], assignmentsForTable: new Map() as AssignmentMap };

    if (onlyMe) {
      const filtered = new Map<string, Assignment>();
      assignments.forEach((a, key) => {
        if (key.startsWith(`${currentUserId}_`)) filtered.set(key, a);
      });
      const row = workerRow ? [workerRow] : [];
      return { rowsForTable: row, assignmentsForTable: filtered };
    }

    // Build rows directly from assignments to guarantee presence
    const rowsMap = new Map<string, TableWorker>();
    assignments.forEach((a, key) => {
      const workerId = key.split('_')[0];
      if (!rowsMap.has(workerId)) {
        rowsMap.set(workerId, {
          workerId,
          firstName: '',
          lastName: '',
          fullName: a.workerName || workerId,
          email: '',
          role: 'worker',
          isActive: true,
        });
      }
    });
    // Prefer richer data from peers index when available
    peers.forEach((p) => {
      if (rowsMap.has(p.workerId)) rowsMap.set(p.workerId, p);
    });
    if (workerRow) rowsMap.set(workerRow.workerId, workerRow);
    const rowsAll = Array.from(rowsMap.values());
    return { rowsForTable: rowsAll, assignmentsForTable: assignments };
  }, [assignments, user?.uid, onlyMe, workerRow, peers]);

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background />
      <Header />

      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white">לוח תורנויות</h1>
            <p className="text-white/70 mt-1 text-sm">צפייה בלבד</p>
          </div>

          {/* Schedule selector */}
          <div className="mb-4">
            {loading ? (
              <div className="text-white">טוען...</div>
            ) : error ? (
              <div className="text-red-300">{error}</div>
            ) : schedules.length === 0 ? (
              <div className="text-white/80">אין תורנויות זמינות</div>
            ) : (
              <div className="flex items-center gap-3 bg-white/10 border border-white/10 rounded-xl px-3 py-2 w-full max-w-xl backdrop-blur-md">
                <span className="text-white/80 text-sm">בחר תורנות:</span>
                <div className="relative flex-1">
                  <select
                    className="w-full appearance-none bg-transparent text-white rounded-lg px-3 py-2 pr-10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
                    value={selectedScheduleId || ''}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                  >
                    {schedules.map((s) => (
                      <option key={s.scheduleId} value={s.scheduleId} className="text-black">
                        {s.label.split(' - עודכן')[0]}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/70">▾</div>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant={onlyMe ? 'attention' : 'secondary'}
              size="sm"
              onClick={() => setOnlyMe(true)}
              className="px-4"
            >
              רק אני
            </Button>
            <Button
              variant={!onlyMe ? 'attention' : 'secondary'}
              size="sm"
              onClick={() => setOnlyMe(false)}
              className="px-4"
            >
              עמיתים עם משימות
            </Button>
          </div>

          {/* Table */}
          {selectedSchedule && weeks.length > 0 && rowsForTable.length > 0 && (
            <div className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <PrimaryTaskTable
                weeks={weeks}
                workers={rowsForTable.filter(r => r.role === 'worker')}
                admins={[]}
                includeAdmins={false}
                assignments={assignmentsForTable}
                taskDefinitions={[]}
                onCellClick={() => {}}
                isReadOnly={true}
                year={selectedSchedule.startDate.getFullYear()}
                highlightWorkerId={user?.uid || undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrimaryTasks;


