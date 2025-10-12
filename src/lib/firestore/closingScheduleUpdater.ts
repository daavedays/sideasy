/**
 * Closing Schedule Updater
 * 
 * Orchestrates the calculation and update of optimal closing dates for workers
 * when a primary schedule is saved.
 * 
 * This module:
 * 1. Detects which workers have changed assignments
 * 2. Extracts mandatory closing dates from weekend-spanning tasks
 * 3. Loads worker data (intervals, existing mandatory dates)
 * 4. Runs closing schedule calculator
 * 5. Updates Firestore with results
 * 
 * Location: src/lib/firestore/closingScheduleUpdater.ts
 */

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Assignment } from '../../types/primarySchedule.types';
import { WorkerData } from './workers';
import { ClosingScheduleCalculator } from '../utils/closingScheduleCalculator';
import { detectChangedWorkers } from '../utils/assignmentChangeDetector';
import {
  extractMandatoryClosingDates,
  extractMandatoryClosingDatesForWorkers,
} from '../utils/mandatoryClosingDateExtractor';
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
 * @param config - Optional algorithm configuration (uses department defaults if not provided)
 * @returns Array of updated worker IDs
 */
export async function updateOptimalClosingDates(
  departmentId: string,
  originalAssignments: Map<string, Assignment>,
  newAssignments: Map<string, Assignment>,
  weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>,
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
    
    // 2. Extract mandatory closing dates for changed workers only
    const mandatoryClosingDates = extractMandatoryClosingDatesForWorkers(
      newAssignments,
      weeks,
      changedWorkerIds
    );
    console.log(`📅 Extracted mandatory closing dates for ${mandatoryClosingDates.size} workers`);
    
    // 3. Load department config if not provided
    let finalConfig = config;
    if (!finalConfig) {
      finalConfig = await loadDepartmentClosingConfig(departmentId);
    }
    
    // 4. Initialize calculator
    const calculator = new ClosingScheduleCalculator(finalConfig);
    
    // 5. Extract all Friday dates from weeks
    const fridayDates = weeks.map(w => w.endDate); // Assuming endDate is Friday
    console.log(`📆 Schedule has ${fridayDates.length} weeks (Fridays)`);
    
    // 6. Process each changed worker
    const updatePromises: Promise<void>[] = [];
    const updatedWorkerIds: string[] = [];
    
    for (const workerId of changedWorkerIds) {
      const updatePromise = processWorkerClosingSchedule(
        departmentId,
        workerId,
        mandatoryClosingDates.get(workerId) || [],
        fridayDates,
        calculator
      ).then((success) => {
        if (success) {
          updatedWorkerIds.push(workerId);
        }
      });
      
      updatePromises.push(updatePromise);
    }
    
    // 7. Wait for all updates to complete
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
 * @param departmentId - Department ID
 * @param workerId - Worker ID
 * @param mandatoryDates - Mandatory closing Friday dates
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
    
    const workerData = workerSnap.data() as WorkerData;
    const workerName = `${workerData.firstName} ${workerData.lastName}`;
    
    // Skip if interval is 0 (never closes)
    if (workerData.closingIntervals === 0) {
      console.log(`⏭️ Skipping ${workerName} (interval = 0, never closes)`);
      
      // Still update mandatory dates even if they never close
      await updateDoc(workerRef, {
        mandatoryClosingDates: mandatoryDates.map(d => Timestamp.fromDate(d)),
        optimalClosingDates: [],
        updatedAt: Timestamp.now(),
      });
      
      return true;
    }
    
    // Prepare input for calculator
    const workerInput: WorkerClosingInput = {
      workerId,
      workerName,
      closingInterval: workerData.closingIntervals,
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
    
    // Update Firestore
    await updateDoc(workerRef, {
      mandatoryClosingDates: mandatoryDates.map(d => Timestamp.fromDate(d)),
      optimalClosingDates: result.optimalDates.map(d => Timestamp.fromDate(d)),
      updatedAt: Timestamp.now(),
    });
    
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

