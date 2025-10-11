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

export interface CellData {
  workerId: string;
  workerName: string;
  status: CellStatus;
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
  currentWorkerQualifications = []
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
   */
  const getCellStyle = (cell: CellData | undefined, isWeekend: boolean): string => {
    // Base weekend tint for empty cells
    if (!cell || cell.status === 'empty') {
      return isWeekend 
        ? 'bg-indigo-900/30 hover:bg-indigo-800/40 border-indigo-700/50' 
        : 'bg-slate-800/50 hover:bg-slate-700/70 border-slate-600/50';
    }

    const isCurrentWorker = currentWorkerId && cell.workerId === currentWorkerId;
    
    // Add subtle weekend overlay to filled cells
    const weekendOverlay = isWeekend ? 'ring-1 ring-indigo-500/30' : '';
    
    switch (cell.status) {
      case 'assigned':
        return `${isCurrentWorker 
          ? 'bg-blue-600/80 border-blue-400/50' 
          : 'bg-blue-500/60 border-blue-400/40'} ${weekendOverlay}`;
      case 'blocked':
        return `${isCurrentWorker
          ? 'bg-red-600/80 border-red-400/50'
          : 'bg-red-500/60 border-red-400/40'} ${weekendOverlay}`;
      case 'preferred':
        return `${isCurrentWorker
          ? 'bg-green-600/80 border-green-400/50'
          : 'bg-green-500/60 border-green-400/40'} ${weekendOverlay}`;
      default:
        return isWeekend 
          ? 'bg-indigo-900/30 hover:bg-indigo-800/40 border-indigo-700/50' 
          : 'bg-slate-800/50 hover:bg-slate-700/70 border-slate-600/50';
    }
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
                const isCellDisabled = !isQualified || isReadOnly;
                const isWeekend = isWeekendDay(date);
                
                return (
                  <button
                    key={dateIndex}
                    onClick={() => !isCellDisabled && onCellClick(task.id, date)}
                    disabled={isCellDisabled}
                    className={`
                      rounded-lg p-2 border transition-all duration-200
                      ${isQualified ? getCellStyle(cell, isWeekend) : (isWeekend ? 'bg-indigo-900/20 border-indigo-700/30' : 'bg-gray-800/30 border-gray-700/30')}
                      ${!isCellDisabled ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-not-allowed opacity-50'}
                      flex items-center justify-center
                    `}
                  >
                    {cell && cell.status !== 'empty' && isQualified && (
                      <div className="text-center">
                        {cell.status === 'blocked' ? (
                          <div className="text-white font-bold text-lg">✕</div>
                        ) : (
                          <div className="text-white font-semibold text-xs">
                            {cell.workerName}
                          </div>
                        )}
                      </div>
                    )}
                    {!isQualified && (
                      <div className="text-gray-600 text-sm">—</div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
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
    </div>
  );
};

export default SecondaryTaskTable;

