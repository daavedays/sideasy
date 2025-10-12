/**
 * CSV Export Utilities for Primary Schedules
 * 
 * Exports primary task schedules to CSV format matching the old system.
 * Supports Excel compatibility with proper encoding and formatting.
 * 
 * CSV Structure:
 * Row 1: ID, Name, Week Numbers (1, 2, 3...)
 * Row 2: (empty), (empty), Date Ranges (DD/MM - DD/MM...)
 * Row 3+: Worker ID, Worker Name, Task Names...
 * 
 * Location: src/lib/utils/csvExport.ts
 * Purpose: CSV export functionality for schedules
 */

import { Week, Assignment, AssignmentMap, PrimaryScheduleUI } from '../../types/primarySchedule.types';
import { formatDateRange, formatDateFull } from './weekUtils';
import { generateCellKey } from './cellKeyUtils';

/**
 * Worker data for CSV export
 */
interface WorkerCSVData {
  workerId: string;
  workerName: string;
}

/**
 * Generate CSV content from schedule data
 * 
 * @param schedule - Schedule metadata
 * @param weeks - Array of week objects
 * @param workers - Array of workers (sorted)
 * @param admins - Array of admins (sorted)
 * @param includeAdmins - Whether to include admins in export
 * @param assignments - Assignment map
 * @returns CSV string
 */
export const generateScheduleCSV = (
  schedule: PrimaryScheduleUI,
  weeks: Week[],
  workers: WorkerCSVData[],
  admins: WorkerCSVData[],
  includeAdmins: boolean,
  assignments: AssignmentMap
): string => {
  const rows: string[][] = [];

  // Row 1: Headers (ID, Name, Week Numbers)
  const header1 = ['id', 'name', ...weeks.map(w => w.weekNumber.toString())];
  rows.push(header1);

  // Row 2: Date Ranges
  const header2 = ['', '', ...weeks.map(w => w.dateRange)];
  rows.push(header2);

  // Worker Rows
  workers.forEach(worker => {
    const row = [
      worker.workerId,
      worker.workerName,
      ...weeks.map(week => {
        const key = generateCellKey(worker.workerId, week.weekNumber);
        const assignment = assignments.get(key);
        return assignment ? assignment.taskName : '';
      })
    ];
    rows.push(row);
  });

  // Admin Rows (if included)
  if (includeAdmins && admins.length > 0) {
    // Add empty row as separator
    rows.push(Array(weeks.length + 2).fill(''));

    admins.forEach(admin => {
      const row = [
        admin.workerId,
        admin.workerName,
        ...weeks.map(week => {
          const key = generateCellKey(admin.workerId, week.weekNumber);
          const assignment = assignments.get(key);
          return assignment ? assignment.taskName : '';
        })
      ];
      rows.push(row);
    });
  }

  // Convert to CSV string
  return rows.map(row => row.map(cell => escapeCSVCell(cell)).join(',')).join('\n');
};

/**
 * Escape CSV cell content (handle commas, quotes, newlines)
 * 
 * @param cell - Cell content
 * @returns Escaped cell content
 */
const escapeCSVCell = (cell: string): string => {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

/**
 * Generate filename for CSV export
 * 
 * @param schedule - Schedule metadata
 * @returns Filename string
 */
const generateFilename = (schedule: PrimaryScheduleUI): string => {
  const startDate = formatDateFull(schedule.startDate).replace(/\//g, '-');
  const endDate = formatDateFull(schedule.endDate).replace(/\//g, '-');
  return `primary_schedule_${startDate}_${endDate}.csv`;
};

/**
 * Download CSV file
 * 
 * @param csvContent - CSV string content
 * @param filename - Filename for download
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  // Add BOM for Excel Hebrew support
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export schedule to CSV (main function)
 * 
 * @param schedule - Schedule metadata
 * @param weeks - Array of week objects
 * @param workers - Array of workers
 * @param admins - Array of admins
 * @param includeAdmins - Whether to include admins
 * @param assignments - Assignment map
 */
export const exportScheduleToCSV = (
  schedule: PrimaryScheduleUI,
  weeks: Week[],
  workers: WorkerCSVData[],
  admins: WorkerCSVData[],
  includeAdmins: boolean,
  assignments: AssignmentMap
): void => {
  const csvContent = generateScheduleCSV(
    schedule,
    weeks,
    workers,
    admins,
    includeAdmins,
    assignments
  );
  
  const filename = generateFilename(schedule);
  downloadCSV(csvContent, filename);
};

/**
 * Generate CSV with metadata header (includes schedule info)
 * 
 * @param schedule - Schedule metadata
 * @param weeks - Array of week objects
 * @param workers - Array of workers
 * @param admins - Array of admins
 * @param includeAdmins - Whether to include admins
 * @param assignments - Assignment map
 * @returns CSV string with metadata
 */
export const generateScheduleCSVWithMetadata = (
  schedule: PrimaryScheduleUI,
  weeks: Week[],
  workers: WorkerCSVData[],
  admins: WorkerCSVData[],
  includeAdmins: boolean,
  assignments: AssignmentMap
): string => {
  const metadata = [
    ['שם תורנות:', schedule.name],
    ['תאריך יצירה:', formatDateFull(schedule.createdAt)],
    ['עודכן לאחרונה:', formatDateFull(schedule.updatedAt)],
    ['סטטוס:', schedule.status === 'published' ? 'פורסם' : schedule.status === 'draft' ? 'טיוטה' : 'בארכיון'],
    ['מחלקה:', schedule.departmentName],
    [''], // Empty row
  ];

  const metadataRows = metadata.map(row => row.join(',')).join('\n');
  const scheduleCSV = generateScheduleCSV(schedule, weeks, workers, admins, includeAdmins, assignments);

  return metadataRows + '\n' + scheduleCSV;
};

/**
 * Export schedule to CSV with metadata
 * 
 * @param schedule - Schedule metadata
 * @param weeks - Array of week objects
 * @param workers - Array of workers
 * @param admins - Array of admins
 * @param includeAdmins - Whether to include admins
 * @param assignments - Assignment map
 */
export const exportScheduleToCSVWithMetadata = (
  schedule: PrimaryScheduleUI,
  weeks: Week[],
  workers: WorkerCSVData[],
  admins: WorkerCSVData[],
  includeAdmins: boolean,
  assignments: AssignmentMap
): void => {
  const csvContent = generateScheduleCSVWithMetadata(
    schedule,
    weeks,
    workers,
    admins,
    includeAdmins,
    assignments
  );
  
  const filename = generateFilename(schedule);
  downloadCSV(csvContent, filename);
};

