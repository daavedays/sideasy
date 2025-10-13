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
} from '../../lib/firestore/primarySchedules';
import { formatDateDDMMYYYY } from '../../lib/utils/dateUtils';

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

  /**
   * Load past schedules from Firestore (4 latest)
   */
  useEffect(() => {
    const loadPastSchedules = async () => {
      if (!departmentId) return;

      try {
        const schedules = await getPastSchedulesDisplay(departmentId);
        setPastSchedules(schedules);
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

          {/* Past Schedules Cards */}
          {pastSchedules.length > 0 && (
            <div className="mb-8">
              <h2 className="text-white font-semibold mb-4 text-lg md:text-xl">
                תורנויות קיימות:
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {pastSchedules.map((schedule) => (
                  <button
                    key={schedule.scheduleId}
                    onClick={() => handleSelectSchedule(schedule.scheduleId)}
                    className={`
                      p-4 md:p-6 rounded-xl border-2 transition-all duration-300
                      backdrop-blur-md text-right
                      ${selectedScheduleId === schedule.scheduleId
                        ? 'bg-gradient-to-br from-orange-600/40 to-amber-600/40 border-orange-400/60 shadow-lg shadow-orange-500/30 scale-[1.02]'
                        : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30 hover:shadow-lg hover:shadow-white/10'
                      }
                    `}
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
                  ? 'bg-gradient-to-br from-green-600/40 to-emerald-600/40 border-green-400/60 hover:from-green-500/50 hover:to-emerald-500/50 shadow-lg shadow-green-500/30 scale-[1.02]'
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
                  ? 'bg-gradient-to-br from-orange-600/40 to-amber-600/40 border-orange-400/60 hover:from-orange-500/50 hover:to-amber-500/50 shadow-lg shadow-orange-500/30 scale-[1.02] cursor-pointer'
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

