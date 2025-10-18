/**
 * Primary Tasks Dashboard Component
 * 
 * Main dashboard for creating and managing primary task schedules.
 * Used by both owners and admins.
 * 
 * Features:
 * - Past schedules as clickable cards (latest 15)
 * - Create new schedule form (expandable)
 * - Edit existing schedule mode
 * - Mobile-responsive design
 * - Glowing hover effects
 * 
 * Location: src/pages/common/PrimaryTasksDash.tsx
 * Purpose: Primary scheduling dashboard for owner/admin roles
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDepartment } from '../../hooks/useDepartment';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import HebrewDatePicker from '../../components/ui/HebrewDatePicker';
import Button from '../../components/ui/Button';
import {
  PrimaryScheduleUI,
  PastScheduleDisplay,
} from '../../types/primarySchedule.types';
import {
  getPastSchedulesDisplay,
  checkScheduleOverlap,
  getScheduleById,
  deleteSchedule,
  getPrimarySchedules,
} from '../../lib/firestore/primarySchedules';
import { formatDateDDMMYYYY } from '../../lib/utils/dateUtils';
import { formatDateFull, formatDateRange } from '../../lib/utils/weekUtils';

const PrimaryTasksDash: React.FC = () => {
  const navigate = useNavigate();
  const { departmentId } = useDepartment();

  // Form State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // UI State
  const [pastSchedules, setPastSchedules] = useState<PastScheduleDisplay[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<PrimaryScheduleUI | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<PastScheduleDisplay[]>([]);
  const [isRefreshingCards, setIsRefreshingCards] = useState(false);

  /**
   * Load past schedules from Firestore (4 latest)
   */
  useEffect(() => {
    const loadPastSchedules = async () => {
      if (!departmentId) return;

      try {
        // Try cached cards first (TTL 10 minutes)
        const cacheKey = `pastPrimaryCards:${departmentId}`;
        let hydrated = false;
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const ts = parsed?.savedAt ? new Date(parsed.savedAt).getTime() : 0;
            const ttl = 10 * 60 * 1000;
            if (ts && (Date.now() - ts) < ttl && Array.isArray(parsed.cards)) {
              setPastSchedules(parsed.cards as PastScheduleDisplay[]);
              hydrated = true;
            }
          }
        } catch {}

        const schedules = await getPastSchedulesDisplay(departmentId);
        setPastSchedules(schedules);
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: new Date().toISOString(), cards: schedules })); } catch {}
        console.log(`Loaded ${schedules.length} past schedules`);
      } catch (error) {
        console.error('Error loading past schedules:', error);
        setPastSchedules([]);
      }
    };

    loadPastSchedules();
  }, [departmentId]);


  /**
   * Handle selecting a past schedule card
   */
  const handleSelectSchedule = async (scheduleId: string) => {
    if (!departmentId) return;

    try {
      const schedule = await getScheduleById(departmentId, scheduleId);
      if (!schedule) {
        alert('תורנות לא נמצאה');
        return;
      }

      setSelectedSchedule(schedule);
      setSelectedScheduleId(scheduleId);
      setShowCreateForm(false); // Close create form if open
    } catch (error) {
      console.error('Error loading schedule:', error);
      alert('שגיאה בטעינת תורנות');
    }
  };

  /**
   * Handle editing selected schedule
   */
  const handleEditSchedule = () => {
    if (!selectedSchedule) return;

    const startDateStr = `${selectedSchedule.startDate.getFullYear()}-${(selectedSchedule.startDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedSchedule.startDate.getDate().toString().padStart(2, '0')}`;
    const endDateStr = `${selectedSchedule.endDate.getFullYear()}-${(selectedSchedule.endDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedSchedule.endDate.getDate().toString().padStart(2, '0')}`;

    navigate('table-view', {
      state: {
        startDate: startDateStr,
        endDate: endDateStr,
        includeAdmins: selectedSchedule.includeAdmins,
        scheduleId: selectedSchedule.scheduleId,
      }
    });
  };

  const loadHistory = async () => {
    if (!departmentId) return;
    try {
      const all = await getPrimarySchedules(departmentId, 50);
      const mapped: PastScheduleDisplay[] = all.map((schedule) => ({
        scheduleId: schedule.scheduleId,
        label: `${formatDateRange(schedule.startDate, schedule.endDate)} (${schedule.startDate.getFullYear()}) - עודכן ${formatDateFull(schedule.updatedAt)}`,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        year: schedule.startDate.getFullYear(),
        updatedAt: schedule.updatedAt,
      }));
      // Exclude the ones already visible in the cards to keep dropdown clean
      const visibleIds = new Set(pastSchedules.map(s => s.scheduleId));
      setHistoryList(mapped.filter(m => !visibleIds.has(m.scheduleId)));
    } catch (e) {
      console.error('Error loading schedule history:', e);
      setHistoryList([]);
    }
  };

  /**
   * Handle create new schedule - Check for overlaps and navigate to table view
   */
  const handleCreateSchedule = async () => {
    if (!startDate || !endDate) {
      alert('אנא בחר תאריכי התחלה וסיום');
      return;
    }

    if (endDate <= startDate) {
      alert('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return;
    }

    if (!departmentId) {
      alert('שגיאה: מחלקה לא נמצאה');
      return;
    }

    try {
      // Convert YYYY-MM-DD strings to Date objects
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      
      const startDateObj = new Date(startYear, startMonth - 1, startDay);
      const endDateObj = new Date(endYear, endMonth - 1, endDay);

      // Check for overlaps with existing schedules
      const overlapResult = await checkScheduleOverlap(
        departmentId,
        startDateObj,
        endDateObj
      );

      if (overlapResult.hasOverlap && overlapResult.overlappingSchedule) {
        const overlapping = overlapResult.overlappingSchedule;
        const message = `קיימת תורנות חופפת:\n${formatDateDDMMYYYY(overlapping.startDate)} - ${formatDateDDMMYYYY(overlapping.endDate)}\n\nאנא בחר תאריכים שונים.`;
        alert(message);
        return;
      }

      // Navigate to table view page with schedule data
      navigate('table-view', {
        state: {
          startDate,
          endDate,
          includeAdmins
        }
      });
    } catch (error) {
      console.error('Error checking schedule overlap:', error);
      alert('שגיאה בבדיקת תאריכים');
    }
  };

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              ניהול תורנות ראשית
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              יצירה ועריכה של לוח משמרות ראשי למחלקה
            </p>
          </div>

          {/* Past Schedules Cards with history dropdown */}
          {pastSchedules.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg md:text-xl">
                  תורנויות קיימות:
                </h2>
                <div className="relative">
                  <button
                    onClick={async () => { setHistoryOpen(v => !v); if (!historyOpen) { await loadHistory(); } }}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm"
                  >
                    היסטוריה
                  </button>
                  <button
                    onClick={async () => {
                      if (!departmentId) return;
                      try {
                        setIsRefreshingCards(true);
                        try { localStorage.removeItem(`pastPrimaryCards:${departmentId}`); } catch {}
                        const fresh = await getPastSchedulesDisplay(departmentId);
                        setPastSchedules(fresh);
                        try { localStorage.setItem(`pastPrimaryCards:${departmentId}`, JSON.stringify({ savedAt: new Date().toISOString(), cards: fresh })); } catch {}
                      } catch (e) {
                        console.error('רענון כשל', e);
                      } finally {
                        setIsRefreshingCards(false);
                      }
                    }}
                    className="ml-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm"
                  >
                    {isRefreshingCards ? '⏳ מרענן…' : '🔄 רענן' }
                  </button>
                  {historyOpen && (
                    <div className="absolute right-0 mt-2 w-80 max-h-80 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2 z-50" style={{ animation: 'slideDown 0.2s ease-out' }}>
                      {historyList.length === 0 ? (
                        <div className="text-white/60 text-sm px-3 py-2">אין פריטים נוספים</div>
                      ) : (
                        historyList.map((s) => (
                          <button
                            key={s.scheduleId}
                            onClick={() => { setHistoryOpen(false); handleSelectSchedule(s.scheduleId); }}
                            className="w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white text-sm border border-transparent hover:border-white/10"
                          >
                            {formatDateRange(s.startDate, s.endDate)} — עודכן {formatDateDDMMYYYY(s.updatedAt)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {pastSchedules.map((schedule) => (
                  <div
                    key={schedule.scheduleId}
                    className={`
                      p-4 md:p-6 rounded-xl border-2 transition-all duration-300
                      backdrop-blur-md text-right group relative
                      ${selectedScheduleId === schedule.scheduleId
                        ? 'bg-gradient-to-br from-orange-600/40 to-amber-600/40 border-orange-400/60 shadow-lg shadow-orange-500/30 scale-[1.02]'
                        : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30 hover:shadow-lg hover:shadow-white/10'
                      }
                    `}
                  >
                    {/* Delete tiny trash icon (gray theme) */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = window.confirm('למחוק את התורנות? פעולה זו בלתי הפיכה.');
                        if (!confirmed || !departmentId) return;
                        try {
                          await deleteSchedule(departmentId, schedule.scheduleId);
                          setPastSchedules(prev => prev.filter(s => s.scheduleId !== schedule.scheduleId));
                          if (selectedScheduleId === schedule.scheduleId) {
                            setSelectedScheduleId(null);
                            setSelectedSchedule(null);
                          }
                        } catch (err) {
                          console.error('Error deleting schedule:', err);
                          alert('שגיאה במחיקת התורנות');
                        }
                      }}
                      title="מחק"
                      className="absolute left-2 top-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-md p-1 border border-white/20"
                    >
                      🗑️
                    </button>

                    <button
                      onClick={() => handleSelectSchedule(schedule.scheduleId)}
                      className="w-full text-right"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl md:text-3xl">📋</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-sm md:text-base mb-1 truncate">
                            {schedule.label.split(' - עודכן')[0]}
                          </h3>
                          <p className="text-white/70 text-xs md:text-sm">
                            עודכן: {schedule.label.split('עודכן ')[1]}
                          </p>
                        </div>
                        {selectedScheduleId === schedule.scheduleId && (
                          <div className="text-orange-400 text-xl">✓</div>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create / Edit Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Create New Schedule Card */}
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setSelectedScheduleId(null);
                setSelectedSchedule(null);
              }}
              className={`
                p-6 md:p-8 rounded-2xl border-2 transition-all duration-300
                backdrop-blur-md
                ${!selectedSchedule
                  ? 'bg-gradient-to-br from-green-600/40 to-emerald-600/40 border-green-400/60 hover:from-green-500/50 hover:to-emerald-500/50 shadow-lg shadow-green-500/30 scale-[1.02] blink-soft'
                  : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30 hover:from-slate-600/40 hover:to-slate-700/40 hover:border-slate-500/40'
                }
              `}
            >
              <div className="text-center">
                <div className="text-4xl md:text-5xl mb-3 md:mb-4">📅</div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  יצירת תורנות חדשה
                </h3>
                <p className="text-white/70 text-sm md:text-base">
                  צור לוח משמרות חדש עם תאריכים מותאמים
                </p>
              </div>
            </button>

            {/* Edit Schedule Card */}
            <button
              onClick={handleEditSchedule}
              disabled={!selectedSchedule}
              className={`
                p-6 md:p-8 rounded-2xl border-2 transition-all duration-300
                backdrop-blur-md
                ${selectedSchedule
                  ? 'bg-gradient-to-br from-orange-600/40 to-amber-600/40 border-orange-400/60 hover:from-orange-500/50 hover:to-amber-500/50 shadow-lg shadow-orange-500/30 scale-[1.02] cursor-pointer blink-soft'
                  : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30 cursor-not-allowed opacity-70'
                }
              `}
            >
              <div className="text-center">
                <div className="text-4xl md:text-5xl mb-3 md:mb-4">✏️</div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  עריכת תורנות
                </h3>
                <p className="text-white/70 text-sm md:text-base">
                  {selectedSchedule 
                    ? 'לחץ כאן לעריכת התורנות שנבחרה'
                    : 'בחר תורנות קיימת מלמעלה כדי לערוך'
                  }
                </p>
              </div>
            </button>
          </div>

          {/* Create Schedule Form (Expandable) */}
          {showCreateForm && (
            <div className="mb-8 bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-green-400/30 shadow-lg shadow-green-500/20">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                יצירת תורנות חדשה
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <HebrewDatePicker
                    label="תאריך התחלה"
                    value={startDate}
                    onChange={setStartDate}
                  />
                </div>

                <div>
                  <HebrewDatePicker
                    label="תאריך סיום"
                    value={endDate}
                    onChange={setEndDate}
                    minDate={startDate}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-3 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAdmins}
                    onChange={(e) => setIncludeAdmins(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-semibold text-sm md:text-base">כלול מנהלים בטבלה</span>
                </label>
              </div>

              <Button
                onClick={handleCreateSchedule}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-sm md:text-base"
                disabled={!startDate || !endDate}
              >
                יצירה
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!showCreateForm && !selectedSchedule && pastSchedules.length === 0 && (
            <div className="text-center py-12 md:py-16">
              <div className="text-5xl md:text-6xl mb-4">📋</div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                אין תורנויות קיימות
              </h3>
              <p className="text-white/70 text-sm md:text-base">
                צור תורנות חדשה כדי להתחיל
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrimaryTasksDash;

