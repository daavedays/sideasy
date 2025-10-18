/**
 * Primary Task Table Component
 * 
 * Large-scale table for primary task scheduling with weekly periods.
 * Features sticky headers and worker names column for easy navigation.
 * 
 * Features:
 * - Sticky right column (worker names) - always visible
 * - Sticky top row (week dates) - always visible
 * - Color-coded task assignments
 * - Multi-week tasks fill all cells in date range
 * - Admin section with distinct styling
 * - Mobile-optimized with compact design
 * - Glassmorphism design matching app theme
 * 
 * Location: src/components/shared/PrimaryTaskTable.tsx
 * Purpose: Core table component for primary task scheduling
 */

import React from 'react';
import { Week, Worker, Assignment, MainTask } from '../../types/primarySchedule.types';
import { generateCellKey } from '../../lib/utils/cellKeyUtils';
import { generateTaskColor, CUSTOM_TASK_COLOR } from '../../lib/utils/colorUtils';

export interface PrimaryTaskTableProps {
  weeks: Week[];
  workers: Worker[];
  admins: Worker[];
  includeAdmins: boolean;
  assignments: Map<string, Assignment>;
  taskDefinitions: MainTask[];
  onCellClick: (workerId: string, weekNumber: number, weekDates: { start: Date; end: Date }) => void;
  isReadOnly?: boolean;
  year?: number; // For display in header
}

const PrimaryTaskTable: React.FC<PrimaryTaskTableProps> = ({
  weeks,
  workers,
  admins,
  includeAdmins,
  assignments,
  onCellClick,
  isReadOnly = false,
  year
}) => {
  // Log when assignments change
  React.useEffect(() => {
    console.log('PrimaryTaskTable re-rendered, assignments size:', assignments.size);
    console.log('All assignments:', Array.from(assignments.entries()));
  }, [assignments]);

  /**
   * Get assignment for a specific cell
   */
  const getAssignment = (workerId: string, weekNumber: number): Assignment | undefined => {
    const key = generateCellKey(workerId, weekNumber);
    const assignment = assignments.get(key);
    if (assignment) {
      console.log('getAssignment found:', { workerId, weekNumber, key, assignment });
    }
    return assignment;
  };


  /**
   * Get cell background color based on assignment
   */
  const getCellStyle = (assignment: Assignment | undefined): React.CSSProperties => {
    if (!assignment) {
      return {};
    }
    
    const color = assignment.isCustomTask ? CUSTOM_TASK_COLOR : generateTaskColor(assignment.taskId);
    
    return {
      backgroundColor: `${color}CC`, // 80% opacity for glassmorphism
      borderColor: color,
    };
  };

  /**
   * Render worker row (regular or admin)
   */
  const renderWorkerRow = (worker: Worker, isAdmin: boolean = false) => {
    return (
      <React.Fragment key={worker.workerId}>
        {/* Worker Name Cell - STICKY RIGHT (first in RTL grid) */}
        <div
          className={`
            sticky right-0 z-20
            flex items-center justify-center px-4 py-3
            border-l-2 border-white/20
            ${isAdmin 
              ? 'bg-gradient-to-l from-orange-600/30 to-amber-600/30 backdrop-blur-sm' 
              : 'bg-gradient-to-l from-blue-600/20 to-cyan-600/20 backdrop-blur-sm'
            }
          `}
          style={{ minWidth: '180px' }}
        >
          <div className="text-white font-semibold text-sm text-center">
            {isAdmin && (
              <span className="ml-2 text-xs text-orange-300">מנהל</span>
            )}
            {worker.fullName}
          </div>
        </div>

        {/* Assignment Cells */}
        {weeks.map((week) => {
          const assignment = getAssignment(worker.workerId, week.weekNumber);
          const isDisabled = isReadOnly;

          return (
            <button
              key={week.weekNumber}
              onClick={() => !isDisabled && onCellClick(
                worker.workerId, 
                week.weekNumber,
                { start: week.startDate, end: week.endDate }
              )}
              disabled={isDisabled}
              className={`
                rounded-lg p-2 border-2 transition-all duration-200
                flex items-center justify-center
                min-h-[60px]
                ${assignment 
                  ? 'border-opacity-100 hover:scale-105' 
                  : 'bg-slate-800/30 border-slate-600/30 border-opacity-50'
                }
                ${!isDisabled ? 'cursor-pointer hover:shadow-lg' : 'cursor-not-allowed opacity-70'}
              `}
              style={getCellStyle(assignment)}
            >
              {assignment && (
                <div className="text-center w-full px-1">
                  <div className="text-white font-bold text-sm leading-tight">
                    {assignment.taskName}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </React.Fragment>
    );
  };

  // Combine workers and admins
  const allWorkers = [...workers];
  const allAdmins = includeAdmins ? [...admins] : [];

  return (
    <div className="w-full" dir="rtl">
      {/* Year Headline */}
      {year && (
        <div className="mb-4 text-center">
          <h2 className="text-3xl font-bold text-white">
            {year}
          </h2>
        </div>
      )}

      {/* Scrollable Container */}
      <div className="relative overflow-auto max-h-[80vh]">
        {/* 
          CSS Grid Layout for RTL:
          - In RTL, grid columns start from RIGHT
          - First column (rightmost): Worker names (sticky right)
          - Remaining columns: Week cells (scrollable)
        */}
        <div
          className="grid gap-1 min-w-max"
          style={{
            gridTemplateColumns: `180px repeat(${weeks.length}, minmax(100px, 1fr))`,
            // In RTL: Worker names (right/sticky) then weeks (left/scrollable)
          }}
        >
          {/* Header Row - Week Numbers and Dates - STICKY TOP */}
          {/* Empty corner cell for grid alignment */}
          <div className="sticky top-0 right-0 z-30"></div>

          {/* Week Headers */}
          {weeks.map((week) => (
            <div
              key={week.weekNumber}
              className="sticky top-0 z-10 bg-gradient-to-br from-blue-600/30 to-cyan-600/30 backdrop-blur-md rounded-lg p-2 border border-white/20"
            >
              <div className="text-white font-bold text-center text-lg mb-1">
                {week.weekNumber}
              </div>
              <div className="text-white/90 text-center text-xs leading-tight">
                {week.dateRange}
              </div>
              {week.isFirstWeek && (
                <div className="text-cyan-300 text-center text-xs mt-1">התחלה</div>
              )}
              {week.isLastWeek && (
                <div className="text-cyan-300 text-center text-xs mt-1">סיום</div>
              )}
            </div>
          ))}

          {/* Worker Rows */}
          {allWorkers.map(worker => renderWorkerRow(worker, false))}

          {/* Admin Rows (if included) */}
          {allAdmins.length > 0 && (
            <>
              {/* Admin Section Divider */}
              <div className="col-span-full h-1 bg-gradient-to-r from-orange-600/50 to-amber-600/50 rounded-full my-2" />
              
              {allAdmins.map(admin => renderWorkerRow(admin, true))}
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {/* <div className="mt-6 flex flex-wrap gap-4 justify-center" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600/80 rounded border-2 border-blue-400"></div>
          <span className="text-white/80 text-sm">משימה משובצת</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-400/80 rounded border-2 border-slate-300"></div>
          <span className="text-white/80 text-sm">משימה מותאמת אישית</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800/50 rounded border border-slate-600/50"></div>
          <span className="text-white/80 text-sm">ריק</span>
        </div>
      </div> */}
    </div>
  );
};

export default PrimaryTaskTable;

