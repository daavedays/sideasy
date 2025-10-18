/**
 * Worker Statistics Page
 *
 * Shows the worker's own totals and closing accuracy, plus peer comparison
 * bars sourced from departments/{dept}/statistics/summary.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import { useDepartment } from '../../hooks/useDepartment';
import { useAuth } from '../../hooks/useAuth';

type PerWorker = {
  name: string;
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
  perWorker: Record<string, PerWorker>;
};

const WorkerStatistics: React.FC = () => {
  const { departmentId } = useDepartment();
  const { user } = useAuth();
  const [mine, setMine] = useState<PerWorker | null>(null);
  const [peers, setPeers] = useState<Array<{ id: string; name: string; totalSecondary: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!departmentId || !user) return;
      try {
        // Load my byWorker doc for most accurate interval fields
        const byRef = doc(db, 'departments', departmentId, 'workers', 'index', 'byWorker', user.uid);
        const bySnap = await getDoc(byRef);
        const bw = (bySnap.exists() ? (bySnap.data() as any) : {}) || {};

        // Listen to summary for peer comparison and totals
        const sumRef = doc(db, 'departments', departmentId, 'statistics', 'summary');
        const unsub = onSnapshot(sumRef, (snap) => {
          const data = (snap.exists() ? (snap.data() as any) : null) as SummaryDoc | null;
          if (data && data.perWorker) {
            const mineEntry = data.perWorker[user.uid];
            if (mineEntry) {
              setMine({
                ...mineEntry,
                actualClosingInterval: typeof bw.actualClosingInterval === 'number' ? bw.actualClosingInterval : mineEntry.actualClosingInterval ?? null,
                lastClosingDate: bw.lastClosingDate || mineEntry.lastClosingDate || null,
              });
            } else {
              setMine(null);
            }
            const list = Object.entries(data.perWorker)
              .filter(([id]) => id !== user.uid)
              .map(([id, w]) => ({ id, name: w.name, totalSecondary: w.totalSecondary || 0 }))
              .sort((a, b) => b.totalSecondary - a.totalSecondary)
              .slice(0, 15);
            setPeers(list);
          } else {
            setMine(null);
            setPeers([]);
          }
          setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
      } catch {
        setLoading(false);
      }
    };
    run();
  }, [departmentId, user]);

  const peerMax = useMemo(() => Math.max(1, ...peers.map(p => p.totalSecondary)), [peers]);

  return (
    <div dir="rtl" className="relative min-h-screen">
      <Background singleImage="/images/image_2.png" />
      <Header />
      <div className="relative z-10 container mx-auto px-4 pt-24 pb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">סטטיסטיקות אישיות</h1>

        {loading && <div className="text-white/70">טוען...</div>}
        {!loading && !mine && <div className="text-white/70">אין נתונים להצגה עדיין.</div>}

        {mine && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card title="משימות ראשיות" value={mine.totalPrimary} />
              <Card title="משימות משניות" value={mine.totalSecondary} />
              <Card title="דיוק סגירות" value={mine.closingAccuracyPct != null ? `${mine.closingAccuracyPct}%` : '-'} />
              <Card title="יעד/בפועל (שבועות)" value={`${mine.closingIntervalTarget ?? '-'} / ${mine.actualClosingInterval ?? '-'}`} />
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">השוואה לעמיתים (משימות משניות)</h2>
              <div className="space-y-2">
                {peers.map((p) => {
                  const pct = Math.max(2, Math.round((p.totalSecondary / peerMax) * 100));
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="text-white/80 text-xs w-40 truncate text-right">{p.name}</div>
                      <div className="flex-1 bg-white/5 rounded-full h-3">
                        <div className="bg-cyan-500 h-3 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-white/70 text-xs w-10 text-left">{p.totalSecondary}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkerStatistics;

const Card: React.FC<{ title: string; value: number | string }> = ({ title, value }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
    <div className="text-white/60 text-xs">{title}</div>
    <div className="text-white text-2xl font-bold">{value}</div>
  </div>
);


