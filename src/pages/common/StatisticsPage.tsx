/**
 * Common Statistics Page (Owner/Admin)
 *
 * Simple, dependency-free charts (CSS bars/pies) reading from
 * departments/{departmentId}/statistics/summary in realtime.
 *
 * NOTE: For future upgrades to Chart.js/Recharts, replace the
 * small renderer components at the bottom; data wiring can stay.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import { useDepartment } from '../../hooks/useDepartment';
import { rebucketWorkerLedgerIfStale } from '../../lib/firestore/workers';

type PerWorker = {
  name: string;
  role?: 'owner'|'admin'|'worker';
  totalPrimary: number;
  totalSecondary: number;
  combined: number;
  closingIntervalTarget?: number|null;
  actualClosingInterval?: number|null;
  closingAccuracyPct?: number|null;
  lastClosingDate?: Timestamp|null;
  updatedAt: Timestamp;
};

type SummaryDoc = {
  totals: { workers: number; primaryTasks: number; secondaryTasks: number; combined: number; analyzedWorkers: number };
  perWorker: Record<string, PerWorker>;
  accuracySummary: { medianPct: number; weightedAvgPct: number; medianAbsDeltaWeeks: number; highAccuracyCount: number; lowAccuracyCount: number };
  workloadSummary: { averageSecondary: number; medianSecondary: number; overworkedCount: number; underworkedCount: number; balancedCount: number; thresholds: { overPct: number; underPct: number } };
  charts?: { secondaryShareByWorker?: Record<string, number> };
  updatedAt: Timestamp;
};

const StatisticsPage: React.FC = () => {
  const { departmentId } = useDepartment();
  const [summary, setSummary] = useState<SummaryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const sweepRunningRef = useRef(false);

  useEffect(() => {
    if (!departmentId) return;
    const ref = doc(db, 'departments', departmentId, 'statistics', 'summary');
    const unsub = onSnapshot(ref, (snap) => {
      setSummary(snap.exists() ? (snap.data() as any) : null);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [departmentId]);

  // Optional background ledger sweep to re-bucket stale closing entries
  useEffect(() => {
    if (!departmentId || !summary) return;
    const flag = String(import.meta.env.VITE_ENABLE_LEDGER_SWEEP || '').toLowerCase();
    const enable = flag === 'true' || flag === '1' || flag === 'yes';
    if (!enable) return;

    const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
    const key = `ledgerSweep:${departmentId}`;
    const lastRun = Number(localStorage.getItem(key) || '0');
    if (Date.now() - lastRun < TTL_MS) return;
    if (sweepRunningRef.current) return;

    const workerIds = Object.keys(summary.perWorker || {});
    if (workerIds.length === 0) {
      try { localStorage.setItem(key, String(Date.now())); } catch {}
      return;
    }

    sweepRunningRef.current = true;
    (async () => {
      try {
        const chunkSize = 5;
        for (let i = 0; i < workerIds.length; i += chunkSize) {
          const chunk = workerIds.slice(i, i + chunkSize);
          await Promise.allSettled(
            chunk.map((wid) => rebucketWorkerLedgerIfStale(departmentId, wid))
          );
        }
        try { localStorage.setItem(key, String(Date.now())); } catch {}
      } catch (err) {
        // best-effort only
      } finally {
        sweepRunningRef.current = false;
      }
    })();
  }, [departmentId, summary]);

  const rows = useMemo(() => {
    if (!summary) return [] as Array<{ id: string; name: string; totalPrimary: number; totalSecondary: number; accuracy?: number|null; actual?: number|null; target?: number|null }>;
    return Object.entries(summary.perWorker || {}).map(([id, w]) => ({
      id,
      name: w.name,
      totalPrimary: w.totalPrimary || 0,
      totalSecondary: w.totalSecondary || 0,
      accuracy: w.closingAccuracyPct ?? null,
      actual: w.actualClosingInterval ?? null,
      target: w.closingIntervalTarget ?? null,
    }));
  }, [summary]);

  return (
    <div dir="rtl" className="relative min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      <div className="relative z-10 container mx-auto px-4 pt-24 pb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">סטטיסטיקות עובדים</h1>

        {loading && (
          <div className="text-white/70">טוען...</div>
        )}

        {!loading && !summary && (
          <div className="text-white/70">אין נתונים להצגה עדיין.</div>
        )}

        {summary && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KPI title="סה" subtitle="עובדים" value={summary.totals.workers} />
              <KPI title="משימות ראשיות" value={summary.totals.primaryTasks} />
              <KPI title="משימות משניות" value={summary.totals.secondaryTasks} />
              <KPI title="סה" subtitle="שילוב" value={summary.totals.combined} />
            </div>

            {/* Accuracy overview */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">דיוק סגירות</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                <KPISmall title="חציון דיוק" value={`${summary.accuracySummary.medianPct}%`} />
                <KPISmall title="ממוצע משוקלל" value={`${summary.accuracySummary.weightedAvgPct}%`} />
                <KPISmall title="חציון פער (שבועות)" value={`${summary.accuracySummary.medianAbsDeltaWeeks}`} />
                <KPISmall title="גבוה/נמוך" value={`${summary.accuracySummary.highAccuracyCount}/${summary.accuracySummary.lowAccuracyCount}`} />
              </div>
              {/* Simple bar: accuracy per worker (top 12) */}
              <SimpleBars data={rows.slice(0, 12)} valueKey="accuracy" labelKey="name" colorClass="bg-green-500" />
            </div>

            {/* Workload fairness */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">חלוקת עומס (משימות משניות)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                <KPISmall title="ממוצע" value={summary.workloadSummary.averageSecondary} />
                <KPISmall title="חציון" value={summary.workloadSummary.medianSecondary} />
                <KPISmall title="מאומסים" value={summary.workloadSummary.overworkedCount} />
                <KPISmall title="תת-עומס" value={summary.workloadSummary.underworkedCount} />
              </div>
              {/* Simple bar: secondary totals per worker (top 20) */}
              <SimpleBars data={rows.slice(0, 20)} valueKey="totalSecondary" labelKey="name" colorClass="bg-rose-500" />
            </div>

            {/* Per-worker table */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">פירוט לפי עובד</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-white/90 text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 pr-4">שם</th>
                      <th className="py-2 pr-4">ראשיות</th>
                      <th className="py-2 pr-4">משניות</th>
                      <th className="py-2 pr-4">דיוק (%)</th>
                      <th className="py-2 pr-4">יעד/בפועל (שבועות)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-white/10">
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4">{r.totalPrimary}</td>
                        <td className="py-2 pr-4">{r.totalSecondary}</td>
                        <td className="py-2 pr-4">{r.accuracy ?? '-'}</td>
                        <td className="py-2 pr-4">{r.target ?? '-'} / {r.actual ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatisticsPage;

// === Lightweight UI helpers (replace with chart lib later) ===

const KPI: React.FC<{ title: string; value: number; subtitle?: string }> = ({ title, value, subtitle }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
    <div className="text-white/60 text-xs">{subtitle ? `${title} (${subtitle})` : title}</div>
    <div className="text-white text-2xl font-bold">{value}</div>
  </div>
);

const KPISmall: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
    <div className="text-white/60 text-xs">{title}</div>
    <div className="text-white text-lg font-semibold">{value}</div>
  </div>
);

const SimpleBars: React.FC<{ data: any[]; valueKey: string; labelKey: string; colorClass: string }> = ({ data, valueKey, labelKey, colorClass }) => {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] || 0)));
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const pct = Math.max(2, Math.round((val / max) * 100));
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="text-white/80 text-xs w-40 truncate text-right">{d[labelKey]}</div>
            <div className="flex-1 bg-white/5 rounded-full h-3">
              <div className={`${colorClass} h-3 rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-white/70 text-xs w-10 text-left">{val}</div>
          </div>
        );
      })}
    </div>
  );
};


