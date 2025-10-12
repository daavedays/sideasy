/**
 * Primary Task Cell Assignment Modal
 * 
 * Modal for assigning primary tasks to worker cells in the schedule.
 * Allows selection from predefined tasks or creation of custom tasks.
 * 
 * Features:
 * - List of all main_tasks from taskDefinitions
 * - Custom task creation (max 15 chars, date picker for duration)
 * - Task duration and day information display
 * - Color preview for each task
 * - Clear cell option
 * - Multi-week task handling (fills all cells in date range)
 * - Beautiful glassmorphism design
 * 
 * Location: src/components/shared/PrimaryTaskCellModal.tsx
 * Purpose: Task assignment interface for primary schedules
 */

import React, { useState } from 'react';
import { MainTask, Assignment } from '../../types/primarySchedule.types';
import { generateTaskColor, CUSTOM_TASK_COLOR, getContrastTextColor } from '../../lib/utils/colorUtils';
import { calculateTaskEndDate, getHebrewDayName } from '../../lib/utils/weekUtils';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import HebrewDatePicker from '../ui/HebrewDatePicker';

/**
 * Format Date object to YYYY-MM-DD string for HebrewDatePicker
 */
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface PrimaryTaskCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId: string;
  workerName: string;
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  currentAssignment: Assignment | null;
  taskDefinitions: MainTask[];
  onSaveAssignment: (assignment: Assignment | null) => void;
}

const PrimaryTaskCellModal: React.FC<PrimaryTaskCellModalProps> = ({
  isOpen,
  onClose,
  workerId,
  workerName,
  weekNumber,
  weekStartDate,
  weekEndDate,
  currentAssignment,
  taskDefinitions,
  onSaveAssignment
}) => {
  const [selectedTask, setSelectedTask] = useState<MainTask | null>(null);
  const [isCustomTask, setIsCustomTask] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  /**
   * Reset modal state
   */
  const resetState = () => {
    setSelectedTask(null);
    setIsCustomTask(false);
    setCustomTaskName('');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  /**
   * Handle close
   */
  const handleClose = () => {
    resetState();
    onClose();
  };

  /**
   * Get task duration from task definition
   * Uses the duration field directly from the task definition
   */
  const getTaskDuration = (task: MainTask): number => {
    return task.duration;
  };

  /**
   * Handle predefined task selection
   */
  const handleTaskSelect = (task: MainTask) => {
    setSelectedTask(task);
    setIsCustomTask(false);
  };

  /**
   * Handle save predefined task
   */
  const handleSavePredefinedTask = () => {
    if (!selectedTask) return;

    const durationDays = getTaskDuration(selectedTask);
    const startDate = new Date(weekStartDate);
    // End date = start date + duration - 1 (to include the start day)
    const endDate = calculateTaskEndDate(startDate, durationDays - 1);

    console.log('Predefined task assignment:', {
      taskName: selectedTask.name,
      taskDuration: selectedTask.duration,
      calculatedDurationDays: durationDays,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      weekStartDate: weekStartDate.toISOString(),
      weekEndDate: weekEndDate.toISOString(),
      spansMultipleWeeks: endDate > weekEndDate
    });

    const assignment: Assignment = {
      workerId,
      workerName,
      taskId: selectedTask.id,
      taskName: selectedTask.name,
      taskColor: generateTaskColor(selectedTask.id),
      isCustomTask: false,
      startDate,
      endDate,
      weekNumber,
      spansMultipleWeeks: endDate > weekEndDate,
    };

    console.log('Saving predefined task assignment:', assignment);
    onSaveAssignment(assignment);
    handleClose();
  };

  /**
   * Handle save custom task
   */
  const handleSaveCustomTask = () => {
    if (!customTaskName.trim() || !customStartDate || !customEndDate) {
      alert('אנא מלא את כל השדות');
      return;
    }

    if (customTaskName.length > 15) {
      alert('שם המשימה חייב להיות עד 15 תווים');
      return;
    }

    // Convert string dates to Date objects in Israel timezone
    const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);
    
    const startDateObj = new Date(startYear, startMonth - 1, startDay);
    const endDateObj = new Date(endYear, endMonth - 1, endDay);

    // Validate dates are within or starting from week boundaries
    if (startDateObj < weekStartDate) {
      alert('תאריך התחלה חייב להיות בתוך השבוע או אחריו');
      return;
    }

    if (endDateObj < startDateObj) {
      alert('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return;
    }

    const assignment: Assignment = {
      workerId,
      workerName,
      taskId: `custom_${Date.now()}`, // Generate unique ID
      taskName: customTaskName.trim(),
      taskColor: CUSTOM_TASK_COLOR,
      isCustomTask: true,
      startDate: startDateObj,
      endDate: endDateObj,
      weekNumber,
      spansMultipleWeeks: endDateObj > weekEndDate,
    };

    console.log('Saving custom task assignment:', assignment);
    onSaveAssignment(assignment);
    handleClose();
  };

  /**
   * Handle clear cell
   */
  const handleClearCell = () => {
    onSaveAssignment(null);
    handleClose();
  };


  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="בחירת משימה ראשית" dynamicHeight={true}>
      <div className="space-y-6" dir="rtl">
        {/* Worker and Week Info */}
        <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="text-white font-semibold mb-2">
           <span className="text-cyan-300">{workerName}</span>
          </div>
          <div className="text-white/80 text-sm">
            שבוע {weekNumber}: {getHebrewDayName(weekStartDate)} {weekStartDate.toLocaleDateString('he-IL')} - {getHebrewDayName(weekEndDate)} {weekEndDate.toLocaleDateString('he-IL')}
          </div>
          {currentAssignment && (
            <div className="mt-2 text-sm text-amber-300">
              משימה נוכחית: {currentAssignment.taskName}
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCustomTask(false)}
            className={`flex-1 ${!isCustomTask ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            משימות קבועות
          </Button>
          <Button
            onClick={() => setIsCustomTask(true)}
            className={`flex-1 ${isCustomTask ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            משימה מותאמת אישית
          </Button>
        </div>

        {/* Predefined Tasks List */}
        {!isCustomTask && (
          <div className="max-h-96 overflow-y-auto">
            <h3 className="text-white font-semibold mb-3">בחר משימה:</h3>
            {taskDefinitions.length === 0 ? (
              <div className="text-white/60 text-center py-8">
                אין משימות זמינות. אנא הוסף משימות בהגדרות המחלקה.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {taskDefinitions.map((task) => {
                  const taskColor = generateTaskColor(task.id);
                  const textColor = getContrastTextColor(taskColor);
                  const isSelected = selectedTask?.id === task.id;

                  return (
                    <button
                      key={task.id}
                      onClick={() => handleTaskSelect(task)}
                      className={`
                        p-2 rounded-lg border-2 transition-all duration-200
                        hover:scale-105 hover:shadow-md
                        ${isSelected ? 'border-white scale-105' : 'border-transparent'}
                      `}
                      style={{
                        backgroundColor: `${taskColor}CC`,
                      }}
                    >
                      <div className={`text-center ${textColor}`}>
                        <div className="font-semibold text-sm">{task.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Custom Task Form */}
        {isCustomTask && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-2">צור משימה מותאמת אישית:</h3>
            
            <div>
              <label className="text-white text-sm mb-2 block">
                שם המשימה (עד 15 תווים):
              </label>
              <Input
                type="text"
                value={customTaskName}
                onChange={(e) => setCustomTaskName(e.target.value.slice(0, 15))}
                placeholder="הזן שם משימה..."
                maxLength={15}
                dir="rtl"
              />
              <div className="text-white/60 text-xs mt-1">
                {customTaskName.length}/15 תווים
              </div>
            </div>

            <div>
              <label className="text-white text-sm mb-2 block">
                תאריך התחלה:
              </label>
              <div className="max-w-xs">
                <HebrewDatePicker
                  label=""
                  value={customStartDate}
                  onChange={(date) => {
                    // Validate that the selected date is not before week start
                    const [year, month, day] = date.split('-').map(Number);
                    const selectedDate = new Date(year, month - 1, day);
                    if (selectedDate >= weekStartDate) {
                      setCustomStartDate(date);
                    } else {
                      alert('תאריך התחלה חייב להיות בתוך השבוע הנוכחי או אחריו');
                    }
                  }}
                  minDate={formatDateToYYYYMMDD(weekStartDate)}
                />
              </div>
              <div className="text-white/60 text-xs mt-1">
                חייב להיות בתוך השבוע הנוכחי או אחריו
              </div>
            </div>

            <div>
              <label className="text-white text-sm mb-2 block">
                תאריך סיום:
              </label>
              <div className="max-w-xs mb-4">
                <HebrewDatePicker
                  label=""
                  value={customEndDate}
                  onChange={(date) => {
                    // Validate that end date is after start date
                    if (customStartDate && date <= customStartDate) {
                      alert('תאריך סיום חייב להיות אחרי תאריך התחלה');
                      return;
                    }
                    setCustomEndDate(date);
                  }}
                  minDate={customStartDate || formatDateToYYYYMMDD(weekStartDate)}
                />
              </div>
            </div>

            {customStartDate && customEndDate && (() => {
              const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
              const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
              const start = new Date(sYear, sMonth - 1, sDay);
              const end = new Date(eYear, eMonth - 1, eDay);
              const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              
              return (
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <div className="text-white text-sm">
                    משך המשימה: {durationDays} ימים
                  </div>
                  {end > weekEndDate && (
                    <div className="text-cyan-300 text-sm mt-2">
                      ✓ המשימה תימשך מעבר לשבוע הנוכחי ותמלא את כל השבועות בטווח
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          {!isCustomTask && selectedTask && (
            <Button
              onClick={handleSavePredefinedTask}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
            >
              שמור משימה
            </Button>
          )}

          {isCustomTask && customTaskName.trim() && customStartDate && customEndDate && (
            <Button
              onClick={handleSaveCustomTask}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
            >
              שמור משימה מותאמת
            </Button>
          )}

          {currentAssignment && (
            <Button
              onClick={handleClearCell}
              className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500"
            >
              נקה תא
            </Button>
          )}

          <Button
            onClick={handleClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600"
          >
            ביטול
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PrimaryTaskCellModal;

