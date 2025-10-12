/**
 * Primary Tasks Dashboard Component
 * 
 * Main dashboard for creating and managing primary task schedules.
 * Used by both owners and admins.
 * 
 * Features:
 * - Past schedules dropdown (latest 15)
 * - Create new schedule form (expandable)
 * - Edit existing schedule mode
 * - Primary task table with sticky headers
 * - Cell assignment modal
 * - Save and publish functionality
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
  const { departmentId, departmentName } = useDepartment();

  // Form State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // UI State
  const [pastSchedules, setPastSchedules] = useState<PastScheduleDisplay[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<PrimaryScheduleUI | null>(null);

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


  /**
   * Check if schedule exists for current selection
   */
  const scheduleExists = pastSchedules.length > 0 && selectedSchedule !== null;

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              ניהול תורנות ראשית
            </h1>
            <p className="text-white/70">
              יצירה ועריכה של לוח משמרות ראשי למחלקה
            </p>
          </div>

          {/* Past Schedules Dropdown */}
          {pastSchedules.length > 0 && (
            <div className="mb-6">
              <label className="text-white font-semibold mb-2 block">
                תורנות קודמות:
              </label>
              <select
                className="w-full bg-slate-800/50 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white"
                onChange={async (e) => {
                  const selectedScheduleId = e.target.value;
                  if (!selectedScheduleId || !departmentId) return;

                  try {
                    // Load schedule metadata
                    const schedule = await getScheduleById(departmentId, selectedScheduleId);
                    if (!schedule) {
                      alert('תורנות לא נמצאה');
                      return;
                    }

                    setSelectedSchedule(schedule);

                    // Navigate to table view with schedule ID for editing
                    const startDateStr = `${schedule.startDate.getFullYear()}-${(schedule.startDate.getMonth() + 1).toString().padStart(2, '0')}-${schedule.startDate.getDate().toString().padStart(2, '0')}`;
                    const endDateStr = `${schedule.endDate.getFullYear()}-${(schedule.endDate.getMonth() + 1).toString().padStart(2, '0')}-${schedule.endDate.getDate().toString().padStart(2, '0')}`;

                    navigate('table-view', {
                      state: {
                        startDate: startDateStr,
                        endDate: endDateStr,
                        includeAdmins: schedule.includeAdmins,
                        scheduleId: schedule.scheduleId,
                      }
                    });
                  } catch (error) {
                    console.error('Error loading schedule:', error);
                    alert('שגיאה בטעינת תורנות');
                  }
                }}
              >
                <option value="">בחר תורנות...</option>
                {pastSchedules.map((schedule) => (
                  <option key={schedule.scheduleId} value={schedule.scheduleId}>
                    {schedule.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Create / Edit Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Create New Schedule Card */}
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
              }}
              className={`
                p-8 rounded-2xl border-2 transition-all duration-300
                backdrop-blur-md
                ${!scheduleExists
                  ? 'bg-gradient-to-br from-green-600/30 to-emerald-600/30 border-green-400/50 hover:from-green-500/40 hover:to-emerald-500/40 scale-105 shadow-lg shadow-green-500/20'
                  : 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-slate-600/30 hover:from-slate-600/40 hover:to-slate-700/40'
                }
              `}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  יצירת תורנות חדשה
                </h3>
                <p className="text-white/70">
                  צור לוח משמרות חדש עם תאריכים מותאמים
                </p>
              </div>
            </button>

            {/* Info Card */}
            <div
              className="p-8 rounded-2xl border-2 transition-all duration-300 backdrop-blur-md bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border-purple-400/50"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">ℹ️</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  עריכת תורנות
                </h3>
                <p className="text-white/70">
                  לעריכת תורנות קיימת, בחר אותה מהרשימה למעלה
                </p>
              </div>
            </div>
          </div>

          {/* Create Schedule Form (Expandable) */}
          {showCreateForm && (
            <div className="mb-8 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-4">יצירת תורנות חדשה</h3>
              
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
                  <span className="font-semibold">כלול מנהלים בטבלה</span>
                </label>
              </div>

              <Button
                onClick={handleCreateSchedule}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                disabled={!startDate || !endDate}
              >
                יצירה
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!showCreateForm && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                אין תורנות פעילה
              </h3>
              <p className="text-white/70">
                צור תורנות חדשה או בחר תורנות קיימת לעריכה
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrimaryTasksDash;

