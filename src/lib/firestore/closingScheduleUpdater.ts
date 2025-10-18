/**
 * Closing Schedule Updater
 * 
 * Orchestrates the calculation and update of optimal closing dates for workers
 * when a primary schedule is saved or edited.
 * 
 * This module:
 * 1. Detects which workers have changed assignments
 * 2. Loads worker data from Firestore (intervals, mandatoryClosingDates)
 *    Note: mandatoryClosingDates are already recalculated by updateWorkerTaskData
 * 3. Runs closing schedule calculator with actual mandatory dates
 * 4. Updates only optimalClosingDates in Firestore
 * 
 * Location: src/lib/firestore/closingScheduleUpdater.ts
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Assignment } from '../../types/primarySchedule.types';
import { ClosingScheduleCalculator } from '../utils/closingScheduleCalculator';
import { detectChangedWorkers } from '../utils/assignmentChangeDetector';
import {
  ClosingScheduleConfig,
  WorkerClosingInput,
  DEFAULT_CLOSING_CONFIG,
} from '../../types/closingSchedule.types';

/**
 * Update optimal closing dates for affected workers after schedule save
 * 
 * @param departmentId - Department ID
 * @param originalAssignments - Assignments before edits
 * @param newAssignments - Assignments after edits
 * @param weeks - All weeks in the schedule (with Friday dates)
 * @param workerMandatoryDates - Map of workerId to their mandatory closing dates (from updateWorkerTaskData)
 * @param config - Optional algorithm configuration (uses department defaults if not provided)
 * @returns Array of updated worker IDs
 */
export async function updateOptimalClosingDates(
  departmentId: string,
  originalAssignments: Map<string, Assignment>,
  newAssignments: Map<string, Assignment>,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>,
  workerMandatoryDates: Map<string, Date[]>,
  config?: ClosingScheduleConfig
): Promise<string[]> {
  console.log('🧮 Starting optimal closing date calculation...');
  console.log(`📊 Input: ${newAssignments.size} assignments, ${weeks.length} weeks`);
  
  try {
    // 1. Detect changed workers
    const changedWorkerIds = detectChangedWorkers(originalAssignments, newAssignments);
    console.log(`📋 Detected ${changedWorkerIds.size} workers with changes:`, Array.from(changedWorkerIds));
    
    if (changedWorkerIds.size === 0) {
      console.log('✅ No workers changed - skipping calculation');
      return [];
    }
    
    // 2. Load department config if not provided
    let finalConfig = config;
    if (!finalConfig) {
      finalConfig = await loadDepartmentClosingConfig(departmentId);
    }
    
    // 3. Initialize calculator
    const calculator = new ClosingScheduleCalculator(finalConfig);
    
    // 4. Extract all Friday dates from weeks
    // IMPORTANT: weeks are Sunday-Saturday, so endDate is Saturday. Friday is one day before.
    const fridayDates = weeks.map(w => {
      const friday = new Date(w.endDate);
      friday.setDate(friday.getDate() - 1); // Saturday - 1 day = Friday
      friday.setHours(12, 0, 0, 0); // Normalize to 12:00 noon for consistency
      return friday;
    });
    console.log(`📆 Schedule has ${fridayDates.length} weeks (Fridays extracted from Saturdays)`);
    
    // 5. Process each changed worker
    // Use mandatory dates directly from workerMandatoryDates map (passed from parent)
    // This avoids Firestore cache issues when reading immediately after writing
    const updatePromises: Promise<void>[] = [];
    const updatedWorkerIds: string[] = [];
    
    for (const workerId of changedWorkerIds) {
      const mandatoryDates = workerMandatoryDates.get(workerId) || [];
      console.log(`🔍 Worker ${workerId}: using ${mandatoryDates.length} mandatory dates from fresh data`);
      
      const updatePromise = processWorkerClosingSchedule(
        departmentId,
        workerId,
        mandatoryDates,
        fridayDates,
        calculator
      ).then((success) => {
        if (success) {
          updatedWorkerIds.push(workerId);
        }
      });
      
      updatePromises.push(updatePromise);
    }
    
    // 6. Wait for all updates to complete
    await Promise.all(updatePromises);
    
    console.log(`✅ Successfully updated ${updatedWorkerIds.length}/${changedWorkerIds.size} workers`);
    return updatedWorkerIds;
    
  } catch (error) {
    console.error('❌ Error updating optimal closing dates:', error);
    throw error;
  }
}

/**
 * Process closing schedule calculation for a single worker
 * 
 * Uses the provided mandatoryClosingDates (from updateWorkerTaskData) to calculate
 * optimal closing dates based on the worker's interval.
 * 
 * @param departmentId - Department ID
 * @param workerId - Worker ID
 * @param mandatoryDates - Mandatory closing Friday dates (from updateWorkerTaskData)
 * @param fridayDates - All Friday dates in schedule
 * @param calculator - Calculator instance
 * @returns True if update was successful
 */
async function processWorkerClosingSchedule(
  departmentId: string,
  workerId: string,
  mandatoryDates: Date[],
  fridayDates: Date[],
  calculator: ClosingScheduleCalculator
): Promise<boolean> {
  try {
    // Load worker data
    const workerRef = doc(db, 'departments', departmentId, 'workers', workerId);
    const workerSnap = await getDoc(workerRef);
    
    if (!workerSnap.exists()) {
      console.warn(`⚠️ Worker ${workerId} not found - skipping`);
      return false;
    }
    
    const workerData = workerSnap.data() as any;
    const workerName = `${workerData.firstName} ${workerData.lastName}`;
    
    // Use the provided mandatoryDates (passed from updateWorkerTaskData)
    // This avoids Firestore cache issues and ensures we're using fresh data
    console.log(`🔍 Worker ${workerName}: received ${mandatoryDates.length} mandatory closing dates from fresh update`);
    
    // Skip if interval is 0 (never closes)
    const interval: number = (workerData.closingInterval ?? workerData.closingIntervals ?? 0) as number;
    if (interval === 0) {
      console.log(`⏭️ Skipping ${workerName} (interval = 0, never closes)`);
      
      return true;
    }
    
    // Prepare input for calculator using provided mandatory dates
    const workerInput: WorkerClosingInput = {
      workerId,
      workerName,
      closingInterval: interval,
      mandatoryClosingDates: mandatoryDates,
    };
    
    // Calculate optimal dates
    console.log(`🧮 Calculating for ${workerName} (interval: ${workerData.closingIntervals})...`);
    const result = calculator.calculateWorkerSchedule(workerInput, fridayDates);
    
    // Log calculation details
    if (result.calculationLog.length > 0) {
      console.log(`  📝 Calculation log for ${workerName}:`, result.calculationLog);
    }
    if (result.userAlerts.length > 0) {
      console.warn(`  ⚠️ Alerts for ${workerName}:`, result.userAlerts);
    }
    
    
    
    console.log(`  ✅ ${workerName}: ${mandatoryDates.length} mandatory + ${result.optimalDates.length} optimal dates`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error processing worker ${workerId}:`, error);
    return false;
  }
}

/**
 * Load department's closing schedule configuration
 * 
 * @param departmentId - Department ID
 * @returns Closing schedule config (or defaults if not found)
 */
async function loadDepartmentClosingConfig(
  departmentId: string
): Promise<ClosingScheduleConfig> {
  try {
    const deptRef = doc(db, 'departments', departmentId);
    const deptSnap = await getDoc(deptRef);
    
    if (!deptSnap.exists()) {
      console.warn('⚠️ Department not found - using default config');
      return DEFAULT_CLOSING_CONFIG;
    }
    
    const deptData = deptSnap.data();
    const config = deptData.closingScheduleConfig;
    
    if (!config) {
      console.log('ℹ️ Department has no closingScheduleConfig - using defaults');
      return DEFAULT_CLOSING_CONFIG;
    }
    
    return {
      gapSlackWeeks: config.gapSlackWeeks ?? DEFAULT_CLOSING_CONFIG.gapSlackWeeks,
      allowSingleReliefMin1: config.allowSingleReliefMin1 ?? DEFAULT_CLOSING_CONFIG.allowSingleReliefMin1,
      reliefMaxPerSchedule: config.reliefMaxPerSchedule ?? DEFAULT_CLOSING_CONFIG.reliefMaxPerSchedule,
    };
    
  } catch (error) {
    console.error('❌ Error loading department config:', error);
    return DEFAULT_CLOSING_CONFIG;
  }
}

