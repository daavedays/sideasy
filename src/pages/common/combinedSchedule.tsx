/**
 * Combined Schedule Page (Admin + Worker)
 *
 * Read-only view that merges secondary assignments (by day) and
 * primary assignments (expanded per-day from week ranges) into a single table.
 *
 * Admin flow:
 *  - בוחר טווח תאריכים
 *  - המערכת טוענת משימות ראשיות/משניות החופפות לטווח ומציגה בטבלה אחת
 *  - ניתן לסנן תצוגה (רק ראשיות / רק משניות)
 *  - קיצור דרך לעריכת סידור משני עם מילוי טווח אוטומטי
 *  - הורדה כ-CSV (PDF ניתן להוסיף בעתיד)
 *
 * Worker flow:
 *  - מציג את הפרסום האחרון מתוך publishedCombinedSchedules
 *  - הדגשת התאים של המשתמש המחובר
 *  - הורדה כ-CSV
 *
 * Location: src/pages/common/combinedSchedule.tsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';
import Button from '../../components/ui/Button';
import SecondaryTaskTable, { CellData, SecondaryTask, WorkerInCell, getCellKey } from '../../components/shared/SecondaryTaskTable';
import { db, auth } from '../../config/firebase';
import { formatDateDDMMYYYY } from '../../lib/utils/dateUtils';
import { getTaskDefinitions } from '../../lib/firestore/taskDefinitions';

type Role = 'developer' | 'owner' | 'admin' | 'worker';

interface UserDoc {
  role: Role;
  departmentId: string;
  firstName?: string;
  lastName?: string;
}

interface PublishedCombinedDoc {
  combinedId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  // Flexible payload for future: tasks/cells etc.
  tasks?: Array<{ id: string; name: string; kind: 'primary'|'secondary' }>;
  assignments?: Record<string, { taskId: string; date: Timestamp; workerId: string; workerName: string; kind: 'primary'|'secondary' }>;
}

const toInputDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseInputDate = (v: string): Date | null => {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const daysBetween = (start: Date, end: Date): Date[] => {
  const out: Date[] = [];
  const d = new Date(start);
  while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
};

const CombinedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [role, setRole] = useState<Role>('worker');

  // Admin-only selection
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showPrimary, setShowPrimary] = useState<boolean>(true);
  const [showSecondary, setShowSecondary] = useState<boolean>(true);

  // Tasks + cells for table
  const [tasks, setTasks] = useState<SecondaryTask[]>([]);
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());

  // Worker mode: published list
  const [publishedList, setPublishedList] = useState<Array<{ id: string; start: Date; end: Date }>>([]);
  const [activePublishedId, setActivePublishedId] = useState<string | null>(null);
  const [publishedMode, setPublishedMode] = useState<boolean>(false);
  const [searchDate, setSearchDate] = useState<string>('');

  const isAdminLike = role === 'admin' || role === 'owner';
  const isWorker = role === 'worker';

  useEffect(() => {
    const loadUser = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const ud: UserDoc = {
          role: (data.role || 'worker') as Role,
          departmentId: data.departmentId || '',
          firstName: data.firstName,
          lastName: data.lastName,
        };
        setUser(ud);
        setDepartmentId(ud.departmentId);
        setRole(ud.role);
      } catch (e) {
        console.warn('שגיאה בטעינת משתמש:', e);
      }
    };
    loadUser();
  }, []);

  // Load secondary task definitions (names/ids)
  useEffect(() => {
    const run = async () => {
      if (!departmentId) return;
      try {
        const defs = await getTaskDefinitions(departmentId);
        const secondary: SecondaryTask[] = (defs?.secondary_tasks?.definitions || []).map((d: any) => ({
          id: String(d.id),
          name: String(d.name),
          requiresQualification: Boolean(d.requiresQualification),
          autoAssign: Boolean(d.autoAssign),
          assign_weekends: Boolean(d.assign_weekends)
        }));
        // Primary task definitions (for row names)
        const primaryDefs: SecondaryTask[] = (defs?.main_tasks?.definitions || []).map((d: any) => ({
          id: `primary:${String(d.id)}`,
          name: String(d.name),
          requiresQualification: false,
          autoAssign: false,
          assign_weekends: false
        }));
        const base = [] as SecondaryTask[];
        if (showSecondary) base.push(...secondary);
        if (showPrimary) base.push(...primaryDefs);
        setTasks(base);
      } catch (e) {
        console.warn('שגיאה בטעינת משימות:', e);
        setTasks([]);
      }
    };
    run();
  }, [departmentId, showPrimary, showSecondary]);

  // Admin: build combined view from live data when range selected
  useEffect(() => {
    const run = async () => {
      if (!departmentId || !isAdminLike) return;
      if (!startDate || !endDate) { setCellData(new Map()); return; }
      try {
        const s = parseInputDate(startDate)!;
        const e = parseInputDate(endDate)!;
        const days = daysBetween(s, e);

        const map = new Map<string, CellData>();

        // 1) Secondary schedules overlapping window
        if (showSecondary) {
          const secCol = collection(db, 'departments', departmentId, 'secondarySchedules');
          const secSnap = await getDocs(secCol);
          for (const d of secSnap.docs) {
            const data = d.data() as any;
            const sd = (data.startDate as Timestamp | undefined)?.toDate();
            const ed = (data.endDate as Timestamp | undefined)?.toDate();
            if (!sd || !ed) continue;
            if (ed < s || sd > e) continue; // no overlap
            const assignments = (data.assignmentsMap || {}) as Record<string, any>;
            Object.entries(assignments).forEach(([key, a]) => {
              const ts = (a as any).date as Timestamp | undefined;
              const date = ts ? ts.toDate() : null;
              const taskId = String((a as any).taskId || '');
              const workerId = String((a as any).workerId || '');
              const workerName = String((a as any).workerName || workerId);
              if (!date || !taskId || !workerId) return;
              if (date < s || date > e) return;
              const keyStr = getCellKey(taskId, date);
              const existing = map.get(keyStr);
              const entry: WorkerInCell = { workerId, workerName, status: 'assigned' } as WorkerInCell;
              if (existing) {
                existing.workers.push(entry);
              } else {
                map.set(keyStr, { taskId, date, workers: [entry] });
              }
            });
          }
        }

        // 2) Primary schedules overlapping window (expand to days)
        if (showPrimary) {
          const priCol = collection(db, 'departments', departmentId, 'primarySchedules');
          const priSnap = await getDocs(priCol);
          for (const d of priSnap.docs) {
            const data = d.data() as any;
            if ((data.type || 'primary') !== 'primary') continue;
            const sd = (data.startDate as Timestamp | undefined)?.toDate();
            const ed = (data.endDate as Timestamp | undefined)?.toDate();
            if (!sd || !ed) continue;
            if (ed < s || sd > e) continue; // no overlap
            const assignments = (data.assignmentsMap || {}) as Record<string, any>;
            Object.values(assignments).forEach((a: any) => {
              const workerId = String(a.workerId || '');
              const workerName = String(a.workerName || workerId);
              const taskIdRaw = String(a.taskId || '');
              const taskName = String(a.taskName || taskIdRaw);
              const st = (a.startDate as Timestamp | undefined)?.toDate();
              const en = (a.endDate as Timestamp | undefined)?.toDate();
              if (!workerId || !st || !en) return;
              const from = st < s ? s : st;
              const to = en > e ? e : en;
              // Expand across selected days
              const rowTaskId = `primary:${taskIdRaw || taskName}`; // ensure stable id
              daysBetween(from, to).forEach((day) => {
                const keyStr = getCellKey(rowTaskId, day);
                const existing = map.get(keyStr);
                const entry: WorkerInCell = { workerId, workerName, status: 'assigned' } as WorkerInCell;
                if (existing) {
                  existing.workers.push(entry);
                } else {
                  map.set(keyStr, { taskId: rowTaskId, date: day, workers: [entry] });
                }
              });
            });
          }
        }

        // Ensure tasks list includes any primary rows that appeared dynamically (custom names)
        if (showPrimary) {
          const existingIds = new Set(tasks.map(t => t.id));
          const dynamicPrimaryIds = new Set<string>();
          map.forEach((cell) => {
            if (cell.taskId.startsWith('primary:')) dynamicPrimaryIds.add(cell.taskId);
          });
          const extra: SecondaryTask[] = Array.from(dynamicPrimaryIds)
            .filter(id => !existingIds.has(id))
            .map((id) => ({ id, name: id.replace('primary:', ''), requiresQualification: false, autoAssign: false, assign_weekends: false }));
          if (extra.length > 0) setTasks(prev => [...prev, ...extra]);
        }

        setCellData(map);
      } catch (e) {
        console.error('שגיאה בטעינת תוכנית משולבת:', e);
        setCellData(new Map());
      }
    };
    run();
  }, [departmentId, isAdminLike, startDate, endDate, showPrimary, showSecondary, tasks.length]);

  // Worker: load last published combined
  useEffect(() => {
    const run = async () => {
      if (!departmentId) return;
      try {
        const ref = collection(db, 'departments', departmentId, 'publishedCombinedSchedules');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list: Array<{ id: string; start: Date; end: Date }> = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const sd = (data.startDate as Timestamp | undefined)?.toDate();
          const ed = (data.endDate as Timestamp | undefined)?.toDate();
          if (sd && ed) list.push({ id: d.id, start: sd, end: ed });
        });
        setPublishedList(list);
        if (isWorker && list.length > 0) {
          setActivePublishedId(list[0].id);
          setStartDate(toInputDate(list[0].start));
          setEndDate(toInputDate(list[0].end));
          setPublishedMode(true);
        }
      } catch (e) {
        console.warn('שגיאה בטעינת פרסומים:', e);
      }
    };
    run();
  }, [departmentId, isWorker]);

  // Worker: when activePublishedId changes, hydrate table cells from published doc
  useEffect(() => {
    const run = async () => {
      if (!departmentId || !activePublishedId) return;
      try {
        const snap = await getDoc(doc(db, 'departments', departmentId, 'publishedCombinedSchedules', activePublishedId));
        if (!snap.exists()) return;
        const data = snap.data() as PublishedCombinedDoc;
        const map = new Map<string, CellData>();
        const assignments = (data.assignments || {}) as Record<string, any>;
        Object.entries(assignments).forEach(([key, a]) => {
          const date = (a as any).date?.toDate?.() as Date | undefined;
          const taskId = String((a as any).taskId || '');
          const workerId = String((a as any).workerId || '');
          const workerName = String((a as any).workerName || workerId);
          if (!date || !taskId || !workerId) return;
          const k = getCellKey(taskId, date);
          map.set(k, { taskId, date, workers: [{ workerId, workerName, status: 'assigned' } as WorkerInCell] });
        });
        // Tasks from document (if provided)
        if (Array.isArray((data as any).tasks)) {
          const fromDoc: SecondaryTask[] = ((data as any).tasks as any[]).map((t) => ({
            id: String(t.id),
            name: String(t.name),
            requiresQualification: false,
            autoAssign: false,
            assign_weekends: false,
          }));
          setTasks(fromDoc);
        }
        setCellData(map);
        setPublishedMode(true);
      } catch (e) {
        console.warn('שגיאה בטעינת תוכנית מפורסמת:', e);
      }
    };
    run();
  }, [departmentId, activePublishedId]);

  const currentWorkerId = useMemo(() => auth.currentUser?.uid, []);

  const handleExportCSV = () => {
    try {
      if (!startDate || !endDate) return;
      const s = parseInputDate(startDate)!;
      const e = parseInputDate(endDate)!;
      const days = daysBetween(s, e);

      const header = ['taskId', 'taskName', ...days.map((d) => formatDateDDMMYYYY(d))];
      const rows: string[] = [];
      tasks.forEach((t) => {
        const row: string[] = [t.id, t.name];
        days.forEach((d) => {
          const k = getCellKey(t.id, d);
          const cell = cellData.get(k);
          if (!cell || cell.workers.length === 0) { row.push(''); return; }
          const assigned = cell.workers.filter(w => w.status === 'assigned');
          row.push(assigned.map(a => a.workerName).join(' | '));
        });
        rows.push(row.join(','));
      });

      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combined_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('שגיאה ביצוא CSV:', e);
    }
  };

  const handlePublish = async () => {
    try {
      if (!departmentId || !isAdminLike || !startDate || !endDate) return;
      const s = parseInputDate(startDate)!;
      const e = parseInputDate(endDate)!;

      // Build flattened assignments and tasks arrays to persist as one doc
      const tasksArray = tasks.map(t => ({ id: t.id, name: t.name, kind: t.id.startsWith('primary:') ? 'primary' : 'secondary' }));
      const assignments: Record<string, { taskId: string; date: Timestamp; workerId: string; workerName: string; kind: 'primary'|'secondary' }> = {};
      cellData.forEach((cell, key) => {
        const assigned = cell.workers.filter(w => w.status === 'assigned');
        if (assigned.length === 0) return;
        const kind = cell.taskId.startsWith('primary:') ? 'primary' : 'secondary';
        const date = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
        assigned.forEach((w, i) => {
          assignments[`${key}#${i}`] = {
            taskId: cell.taskId,
            date: Timestamp.fromDate(date),
            workerId: w.workerId,
            workerName: w.workerName,
            kind,
          };
        });
      });

      // Create combined doc
      const col = collection(db, 'departments', departmentId, 'publishedCombinedSchedules');
      const newRef = doc(col);
      await setDoc(newRef, {
        combinedId: newRef.id,
        departmentId,
        startDate: Timestamp.fromDate(s),
        endDate: Timestamp.fromDate(e),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid || 'unknown',
        tasks: tasksArray,
        assignments,
      });

      // Notification document for department members (no developer notification)
      try {
        const notifCol = collection(db, 'departments', departmentId, 'notifications');
        const nref = doc(notifCol);
        await setDoc(nref, {
          notificationId: nref.id,
          type: 'combined_schedule_published',
          startDate: Timestamp.fromDate(s),
          endDate: Timestamp.fromDate(e),
          combinedId: newRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: auth.currentUser?.uid || 'unknown',
          readBy: [],
        });
      } catch {}

      try { alert('פורסם בהצלחה'); } catch {}
    } catch (e) {
      console.error('שגיאה בפרסום תוכנית משולבת:', e);
      try { alert('שגיאה בפרסום'); } catch {}
    }
  };

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />

      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">תוכנית שבועית משולבת</h1>
            <p className="text-lg md:text-xl text-white/80">תצוגה משולבת של משימות ראשיות ומשניות</p>
          </div>

          {/* Controls */}
          {isAdminLike ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative z-10">
              <h2 className="text-2xl font-bold text-white mb-4">בחר טווח תאריכים</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <HebrewDatePicker label="תאריך התחלה" value={startDate} onChange={setStartDate} />
                <HebrewDatePicker label="תאריך סיום" value={endDate} onChange={setEndDate} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-white">
                  <input type="checkbox" checked={showSecondary} onChange={(e) => setShowSecondary(e.target.checked)} />
                  הצג משימות משניות
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input type="checkbox" checked={showPrimary} onChange={(e) => setShowPrimary(e.target.checked)} />
                  הצג משימות ראשיות
                </label>
                <div className="ml-auto flex items-center gap-3">
                  <Button variant="secondary" onClick={handleExportCSV}>ייצוא CSV</Button>
                  {startDate && endDate && (
                    <Button variant="primary" onClick={() => navigate(`/admin/work-schedule?start=${startDate}&end=${endDate}&autoload=1`)}>ערוך סידור</Button>
                  )}
                  {startDate && endDate && (
                    <Button variant="attention" onClick={handlePublish}>פרסם</Button>
                  )}
                  {publishedMode && (
                    <Button variant="secondary" onClick={() => { setActivePublishedId(null); setPublishedMode(false); }}>תצוגה חיה</Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/80 text-sm mb-1">טווח פרסום פעיל</div>
                  {startDate && endDate ? (
                    <div className="text-white text-lg">{startDate} — {endDate}</div>
                  ) : (
                    <div className="text-white/60 text-lg">לא נמצא פרסום</div>
                  )}
                </div>
                {publishedList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/80 text-sm">בחר פרסום</span>
                    <select
                      className="bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1"
                      value={activePublishedId || ''}
                      onChange={(e) => setActivePublishedId(e.target.value)}
                    >
                      {publishedList.map((p) => (
                        <option key={p.id} value={p.id} className="text-black">
                          {formatDateDDMMYYYY(p.start)} — {formatDateDDMMYYYY(p.end)}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={handleExportCSV}>ייצוא CSV</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          {startDate && endDate ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative z-0">
              <SecondaryTaskTable
                startDate={parseInputDate(startDate) || new Date()}
                endDate={parseInputDate(endDate) || new Date()}
                tasks={tasks}
                cellData={cellData}
                onCellClick={() => {}}
                isReadOnly
                currentWorkerId={isWorker ? currentWorkerId : undefined}
                currentWorkerQualifications={[]}
                hideLegend
                adminMode
              />
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-white/20 text-center">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-white/70 text-lg">בחר טווח תאריכים כדי להציג את הטבלה</p>
            </div>
          )}

          {/* Past / Published below the table (basic list) */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">סידורים אחרונים</h3>
              <div className="flex items-center gap-3">
                <div className="text-white/60 text-sm">מוצגים אחרונים</div>
                {/* Date search for older published */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!searchDate) return;
                      const d = parseInputDate(searchDate);
                      if (!d) return;
                      const match = publishedList.find(p => d >= p.start && d <= p.end);
                      if (match) {
                        setActivePublishedId(match.id);
                        setStartDate(toInputDate(match.start));
                        setEndDate(toInputDate(match.end));
                      }
                    }}
                  >חפש</Button>
                </div>
              </div>
            </div>
            {publishedList.length === 0 ? (
                <div className="text-white/60">אין פרסומים זמינים</div>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {publishedList.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePublishedId(p.id);
                      setStartDate(toInputDate(p.start));
                      setEndDate(toInputDate(p.end));
                    }}
                    className={`text-right rounded-xl border border-white/20 bg-white/10 p-4 hover:bg-white/15 transition ${activePublishedId === p.id ? 'ring-2 ring-purple-400/60' : ''}`}
                  >
                    <div className="text-white font-semibold text-sm mb-1">{formatDateDDMMYYYY(p.start)} — {formatDateDDMMYYYY(p.end)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedSchedulePage;


