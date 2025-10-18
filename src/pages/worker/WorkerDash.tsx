/**
 * Worker Dashboard Component
 * 
 * Main dashboard for workers to view schedules, submit requests, and view statistics.
 * Coherent design with Owner/Admin dashboards - glassmorphism, Hebrew RTL, responsive.
 * 
 * Location: src/pages/worker/WorkerDash.tsx
 * Purpose: Worker dashboard with schedule viewing and personal stats
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../config/firebase';
import { UserData } from '../../lib/auth/authHelpers';
import Background from '../../components/layout/Background';

interface DepartmentData {
  departmentId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  adminCount: number;
  workerCount: number;
}

const WorkerDash: React.FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextTask, setNextTask] = useState<string>('טרם נקבע');

  // =========================
  // Weekly cutoff countdown
  // =========================
  type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  const [weeklyCutoff, setWeeklyCutoff] = useState<{ enabled: boolean; dayOfWeek: DayOfWeek; hour: number; minute: number }>({
    enabled: false,
    dayOfWeek: 'thu',
    hour: 23,
    minute: 59
  });
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;

      try {
        // Get user data
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const user = userDoc.data() as UserData;
          setUserData(user);

          // Get department data
          if (user.departmentId) {
            const deptDocRef = doc(db, 'departments', user.departmentId);
            const deptDoc = await getDoc(deptDocRef);
            
            if (deptDoc.exists()) {
              const data = deptDoc.data() as any;
              setDepartmentData(data as DepartmentData);
              const prefs = data?.preferencesConfig || {};
              const wc = prefs.weeklyCutoff || {};
              setWeeklyCutoff({
                enabled: Boolean(wc.enabled),
                dayOfWeek: (wc.dayOfWeek as DayOfWeek) || 'thu',
                hour: typeof wc.hour === 'number' ? wc.hour : 23,
                minute: typeof wc.minute === 'number' ? wc.minute : 59
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load next upcoming assignment for current worker from latest published combined schedule
  useEffect(() => {
    const run = async () => {
      if (!auth.currentUser || !userData?.departmentId) return;
      try {
        const ref = collection(db, 'departments', userData.departmentId, 'publishedCombinedSchedules');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (snap.empty) return;
        const now = new Date(); now.setHours(0,0,0,0);
        let best: { date: Date; label: string } | null = null;
        for (const d of snap.docs) {
          const data = d.data() as any;
          const assignments = (data.assignments || {}) as Record<string, any>;
          Object.values(assignments).forEach((a: any) => {
            if (String(a.workerId || '') !== auth.currentUser!.uid) return;
            const date = (a.date as Timestamp | undefined)?.toDate();
            if (!date) return;
            const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            if (normalized < now) return; // upcoming only
            const taskId: string = String(a.taskId || '');
            const isPrimary = taskId.startsWith('primary:');
            const name = isPrimary ? taskId.replace('primary:', '') : taskId; // task names saved in tasks[] too
            const label = `${name} • ${normalized.toLocaleDateString('he-IL')}`;
            if (!best || normalized < best.date) best = { date: normalized, label };
          });
          if (best) break; // from latest published only
        }
        if (best) setNextTask(best.label);
      } catch {}
    };
    run();
  }, [userData?.departmentId]);

  // Compute countdown to this week's cutoff (Asia/Jerusalem assumed via client local time)
  useEffect(() => {
    let timer: any;
    const dayOfWeekMap: Record<DayOfWeek, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

    const compute = () => {
      if (!weeklyCutoff.enabled) {
        setShowCountdown(false);
        setTimeLeftMs(null);
        return;
      }
      const now = new Date();
      const dow = now.getDay(); // 0=Sun..6=Sat
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);

      const cutoffDow = dayOfWeekMap[weeklyCutoff.dayOfWeek];
      const cutoff = new Date(weekStart);
      cutoff.setDate(weekStart.getDate() + cutoffDow);
      cutoff.setHours(weeklyCutoff.hour, weeklyCutoff.minute, 0, 0);

      let target = cutoff;
      if (now.getTime() > cutoff.getTime()) {
        // cutoff already passed this week → next week's cutoff countdown
        const nextWeekStart = new Date(weekStart);
        nextWeekStart.setDate(weekStart.getDate() + 7);
        target = new Date(nextWeekStart);
        target.setDate(nextWeekStart.getDate() + cutoffDow);
        target.setHours(weeklyCutoff.hour, weeklyCutoff.minute, 0, 0);
      }

      const diff = target.getTime() - now.getTime();
      if (diff > 0 && diff <= 3 * 60 * 60 * 1000) {
        setShowCountdown(true);
        setTimeLeftMs(diff);
      } else {
        setShowCountdown(false);
        setTimeLeftMs(null);
      }
    };

    compute();
    timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [weeklyCutoff]);

  const formatTimeLeft = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const navigationCards = [
    {
      title: 'לוח תורנויות',
      description: 'צפה בתורנויות שלך',
      icon: '📋',
      onClick: () => navigate('/worker/shifts'),
      color: 'from-purple-600 to-blue-600'
    },
    {
      title: 'מערכת הגשת בקשות',
      description: 'הגש בקשות להעדפות משמרות',
      icon: '✍️',
      onClick: () => navigate('/worker/preferences'),
      color: 'from-blue-600 to-cyan-600'
    },
    {
      title: 'צפה בתוכנית שבועית',
      description: 'צפה בתוכנית העבודה השבועית',
      icon: '📅',
      onClick: () => alert('בקרוב!'),
      color: 'from-cyan-600 to-teal-600'
    },
    {
      title: 'סטטיסטיקה',
      description: 'צפה בסטטיסטיקות שלך',
      icon: '📊',
      onClick: () => navigate('/worker/workerStatistics'),
      color: 'from-teal-600 to-green-600'
    }
  ];

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
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-2">
              שלום, {userData?.firstName}
            </h1>
            <p className="text-xl text-white/80">
              ברוך הבא למחלקת {departmentData?.name || userData?.departmentName}
            </p>
          </div>

          {/* Cutoff Countdown Card */}
          {showCountdown && timeLeftMs !== null && (
            <div className={`mb-8 rounded-2xl border p-6 md:p-8 backdrop-blur-md ${timeLeftMs <= 60 * 60 * 1000 ? 'bg-red-600/15 border-red-500/60' : 'bg-amber-600/10 border-amber-500/50'} shadow-lg` }>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                    ⏳ מועד הסגירה לשבוע הקרוב מתקרב
                  </h2>
                  <p className="text-white/70">
                    נותר זמן להגשת העדפות לשבוע ראשון–שבת הקרוב. לאחר המועד לא ניתן יהיה להגיש.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-3xl md:text-5xl font-extrabold tabular-nums ${timeLeftMs <= 60 * 60 * 1000 ? 'text-red-300 animate-pulse' : 'text-amber-300'}`}>
                    {formatTimeLeft(timeLeftMs)}
                  </div>
                  <button
                    onClick={() => navigate('/worker/preferences')}
                    className={`px-5 py-3 rounded-xl font-bold text-white transition-all border ${timeLeftMs <= 60 * 60 * 1000 ? 'bg-red-600/80 hover:bg-red-600 border-red-500/60' : 'bg-amber-600/80 hover:bg-amber-600 border-amber-500/60'}`}
                  >
                    הגש העדפות עכשיו
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Cards (moved above department info) */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">מה תרצה לעשות?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {navigationCards.map((card, index) => (
                <button
                  key={index}
                  onClick={card.onClick}
                  className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-right group"
                >
                  {/* Icon */}
                  <div className="text-5xl md:text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-sm md:text-base text-white/70">{card.description}</p>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none`} />
                </button>
              ))}
            </div>
          </div>

          {/* Department Info Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">פרטי המחלקה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white/5 rounded-xl p-4 md:p-6 text-center">
                <div className="text-4xl mb-2">🏢</div>
                <p className="text-white/70 mb-1 text-sm md:text-base">שם המחלקה</p>
                <p className="text-xl md:text-2xl font-bold text-white break-words">
                  {departmentData?.name || userData?.departmentName}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-white/70 mb-1 text-sm md:text-base">סה"כ עובדים</p>
                <p className="text-xl md:text-2xl font-bold text-white">
                  {departmentData?.workerCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">סיכום מהיר</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">תורנויות החודש</p>
                <p className="text-3xl md:text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">סה"כ תורנויות</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">שעות עבודה</p>
                <p className="text-3xl md:text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">החודש</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">תורנות הבאה</p>
                <p className="text-xl md:text-2xl font-bold text-blue-400">{nextTask}</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">מפורסם אחרון</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Footer: quick links not in cards (worker) */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">קיצורי דרך</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <button onClick={() => navigate('/worker/preferences')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20">העדפות עבודה</button>
        </div>
      </div>
    </div>
  );
};

export default WorkerDash;

