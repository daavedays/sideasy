/**
 * Secondary Task Table Component
 * 
 * Reusable table component for displaying and managing secondary task assignments.
 * Used by both workers (preference submission) and admins (assignment management).
 * 
 * Features:
 * - Mobile-friendly responsive design
 * - Date range display
 * - Color-coded cells (assigned, blocked, preferred)
 * - Interactive cell clicking
 * - Beautiful glassmorphism design
 * 
 * Location: src/components/shared/SecondaryTaskTable.tsx
 * Purpose: Centralized table design for secondary tasks across roles
 */

import React from 'react';
import { Timestamp } from 'firebase/firestore';

// Preference/Assignment types
export type CellStatus = 'empty' | 'assigned' | 'blocked' | 'preferred';

export interface WorkerInCell {
  workerId: string;
  workerName: string;
  status: CellStatus;
}

export interface CellData {
  workers: WorkerInCell[]; // Array of workers who selected this cell
  taskId: string;
  date: Date;
}

export interface SecondaryTask {
  id: string;
  name: string;
  requiresQualification: boolean;
  autoAssign: boolean;
  assign_weekends: boolean;
}

export interface WorkerPreference {
  date: Timestamp;
  task: string | null; // null = blocked day
}

export interface TableProps {
  startDate: Date;
  endDate: Date;
  tasks: SecondaryTask[];
  cellData: Map<string, CellData>; // key: `${taskId}_${dateString}`
  onCellClick: (taskId: string, date: Date) => void;
  isReadOnly?: boolean;
  currentWorkerId?: string; // For highlighting current worker's cells
  currentWorkerQualifications?: string[]; // For graying out unqualified tasks
  hideLegend?: boolean; // Hide legend bar (e.g., admin design-only page)
  showAddRow?: boolean; // Show a "+" row below the last task
  onAddRowClick?: () => void; // Handler when clicking the add row
  adminMode?: boolean; // Admin interaction semantics (assignment-focused rendering)
  disabledDates?: Set<string>; // DD/MM/YYYY keys that should be disabled (worker view)
  disabledTooltips?: Map<string, string>; // dateKey -> tooltip text for disabled dates
}

/**
 * Generate array of dates between start and end date
 */
const generateDateRange = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

/**
 * Format date to DD/MM/YYYY - Israel timezone
 * CRITICAL: All dates in the app MUST be in DD/MM/YYYY format
 */
const formatDate = (date: Date): string => {
  // Get date components in local time (Israel)
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Get day name in Hebrew
 */
const getHebrewDayName = (date: Date): string => {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[date.getDay()];
};

/**
 * Check if date is a weekend day (Thursday, Friday, Saturday)
 */
const isWeekendDay = (date: Date): boolean => {
  const day = date.getDay();
  return day === 4 || day === 5 || day === 6; // Thursday (4), Friday (5), Saturday (6)
};

/**
 * Generate unique key for cell lookup
 */
export const getCellKey = (taskId: string, date: Date): string => {
  return `${taskId}_${formatDate(date)}`;
};

const SecondaryTaskTable: React.FC<TableProps> = ({
  startDate,
  endDate,
  tasks,
  cellData,
  onCellClick,
  isReadOnly = false,
  currentWorkerId,
  currentWorkerQualifications = [],
  hideLegend = false,
  showAddRow = false,
  onAddRowClick,
  adminMode = false,
  disabledDates,
  disabledTooltips
}) => {
  const dateRange = generateDateRange(startDate, endDate);

  /**
   * Check if current worker is qualified for this task
   */
  const isQualifiedForTask = (task: SecondaryTask): boolean => {
    // If task doesn't require qualification, everyone can do it
    if (!task.requiresQualification) return true;
    
    // Check if worker has this task in their qualifications
    return currentWorkerQualifications.includes(task.id);
  };

  /**
   * Get cell styling based on status (with weekend consideration)
   * ONLY shows color if current worker has set a preference
   */
  const getCellStyle = (cell: CellData | undefined, isWeekend: boolean): string => {
    // If assigned (admin view), gently highlight assignment regardless of weekend
    if (cell && cell.workers.some(w => w.status === 'assigned')) {
      const weekendOverlay = isWeekend ? 'ring-1 ring-blue-500/20' : '';
      return `bg-blue-600/40 border-blue-400/40 ${weekendOverlay}`;
    }

    // Base weekend tint for empty cells
    if (!cell || cell.workers.length === 0) {
      return isWeekend 
        ? 'bg-indigo-900/30 hover:bg-indigo-800/40 border-indigo-700/50' 
        : 'bg-slate-800/50 hover:bg-slate-700/70 border-slate-600/50';
    }

    // Check if current worker is in this cell and get their status
    const currentWorkerInCell = currentWorkerId && 
      cell.workers.find(w => w.workerId === currentWorkerId);
    
    // Add subtle weekend overlay to filled cells
    const weekendOverlay = isWeekend ? 'ring-1 ring-indigo-500/30' : '';
    
    // ONLY color cell if current worker has a preference here
    if (currentWorkerInCell) {
      if (currentWorkerInCell.status === 'preferred') {
        return `bg-green-600/80 border-green-400/50 ${weekendOverlay}`;
      } else if (currentWorkerInCell.status === 'blocked') {
        return `bg-red-600/80 border-red-400/50 ${weekendOverlay}`;
      }
    }
    
    // Default color (even if other workers have preferences)
    return isWeekend 
      ? 'bg-indigo-900/30 hover:bg-indigo-800/40 border-indigo-700/50' 
      : 'bg-slate-800/50 hover:bg-slate-700/70 border-slate-600/50';
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        {/* Table Header - Dates */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(120px, 1fr))` }}>
          {/* Corner cell */}
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="text-white font-bold text-center text-sm">שם המשימה</div>
          </div>
          
          {/* Date headers */}
          {dateRange.map((date, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-sm rounded-lg p-2 border border-white/10"
            >
              <div className="text-white font-bold text-center text-xs mb-1">
                {getHebrewDayName(date)}
              </div>
              <div className="text-white/80 text-center text-xs">
                {formatDate(date)}
              </div>
            </div>
          ))}
        </div>

        {/* Table Body - Tasks and Cells */}
        {tasks.map((task) => {
          const isQualified = isQualifiedForTask(task);
          
          return (
            <div 
              key={task.id}
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(120px, 1fr))` }}
            >
              {/* Task name cell */}
              <div className={`bg-gradient-to-br backdrop-blur-sm rounded-lg p-3 border flex items-center ${
                isQualified 
                  ? 'from-indigo-600/20 to-purple-600/20 border-white/10' 
                  : 'from-gray-700/20 to-gray-800/20 border-gray-600/20'
              }`}>
                <div className={`font-semibold text-sm ${
                  isQualified ? 'text-white' : 'text-gray-500'
                }`}>
                  {task.name}
                  {!isQualified && task.requiresQualification && (
                    <span className="text-xs mr-2">🔒</span>
                  )}
                </div>
              </div>

              {/* Assignment cells */}
              {dateRange.map((date, dateIndex) => {
                const key = getCellKey(task.id, date);
                const cell = cellData.get(key);
                const dateKey = formatDate(date);
                const isDateDisabled = disabledDates?.has(dateKey) || false;
                const isCellDisabled = adminMode ? isReadOnly : (!isQualified || isReadOnly || isDateDisabled);
                const isWeekend = isWeekendDay(date);
                const titleText = isDateDisabled ? (disabledTooltips?.get(dateKey) || undefined) : undefined;
                
                return (
                  <div
                    key={dateIndex}
                    onClick={() => {
                      if (isCellDisabled && isDateDisabled && titleText) {
                        try { alert(titleText); } catch {}
                      }
                    }}
                    className="relative"
                  >
                    <button
                      onClick={() => !isCellDisabled && onCellClick(task.id, date)}
                      disabled={isCellDisabled}
                      className={`
                        rounded-lg p-2 border transition-all duration-200 w-full h-full
                        ${adminMode ? getCellStyle(cell, isWeekend) : (isQualified ? getCellStyle(cell, isWeekend) : (isWeekend ? 'bg-indigo-900/20 border-indigo-700/30' : 'bg-gray-800/30 border-gray-700/30'))}
                        ${!isCellDisabled ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-not-allowed opacity-50'}
                        flex items-center justify-center
                      `}
                      title={titleText}
                    >
                    {cell && cell.workers.length > 0 && (
                      <div className="text-center w-full px-1">
                        {cell.workers.every(w => w.status === 'blocked') ? (
                          // All blocked - show X
                          <div className="text-white font-bold text-lg">✕</div>
                        ) : (
                          // Show worker names (max 3, then "..." or "CurrentWorker...")
                          <div className="text-white font-semibold text-xs leading-tight">
                            {(() => {
                              const assigned = cell.workers.filter(w => w.status === 'assigned');
                              if (adminMode && assigned.length > 0) {
                                return assigned[0].workerName.split(' ')[0];
                              }

                              const currentWorkerInCell = currentWorkerId ? cell.workers.find(
                                w => w.workerId === currentWorkerId
                              ) : undefined;
                              const preferredWorkers = cell.workers.filter(
                                w => w.status === 'preferred'
                              );

                              // Admin view: if more than one preferred, show ellipsis
                              if (adminMode) {
                                if (preferredWorkers.length > 1) return '...';
                                if (preferredWorkers.length === 1) return preferredWorkers[0].workerName.split(' ')[0];
                                return '';
                              }

                              if (preferredWorkers.length <= 3) {
                                return preferredWorkers
                                  .map(w => w.workerName.split(' ')[0])
                                  .join(', ');
                              } else {
                                if (currentWorkerInCell && currentWorkerInCell.status === 'preferred') {
                                  return `${currentWorkerInCell.workerName.split(' ')[0]}...`;
                                } else {
                                  return preferredWorkers
                                    .slice(0, 3)
                                    .map(w => w.workerName.split(' ')[0])
                                    .join(', ') + '...';
                                }
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    {!isQualified && (
                      <div className="text-gray-600 text-sm">—</div>
                    )}
                      {/* Tiny lock for disabled primary-task dates */}
                      {isDateDisabled && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-white/60 text-xs">🔒</span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
        {showAddRow && (
          <div
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(120px, 1fr))` }}
          >
            {/* Add new task button cell */}
            <button
              onClick={onAddRowClick}
              className="bg-gradient-to-br from-purple-600/30 to-indigo-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 backdrop-blur-sm rounded-lg p-3 border border-white/20 flex items-center justify-center text-white font-semibold transition-all duration-200 hover:scale-105"
            >
              + הוסף משימה
            </button>
            {/* Empty cells to keep grid alignment */}
            {dateRange.map((_, i) => (
              <div
                key={`add-row-${i}`}
                className="rounded-lg p-2 border bg-slate-800/20 border-slate-600/20"
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend (optional) */}
      {!hideLegend && (
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600/80 rounded border border-blue-400/50"></div>
            <span className="text-white/80 text-sm">משובץ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600/80 rounded border border-green-400/50"></div>
            <span className="text-white/80 text-sm">מועדף</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-600/80 rounded border border-red-400/50"></div>
            <span className="text-white/80 text-sm">חסום</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-800/50 rounded border border-slate-600/50"></div>
            <span className="text-white/80 text-sm">ריק</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecondaryTaskTable;

