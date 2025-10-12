/**
 * Closing Schedule Types
 * 
 * Type definitions for the closing schedule calculation system.
 * 
 * Location: src/types/closingSchedule.types.ts
 */

/**
 * Configuration for closing schedule calculation algorithm
 */
export interface ClosingScheduleConfig {
  /** Extra flexibility beyond strict interval (default: 0) */
  gapSlackWeeks: number;
  
  /** Allow relief picks for edge cases where gap = 2n-1 (default: true) */
  allowSingleReliefMin1: boolean;
  
  /** Maximum relief picks per schedule (default: 1) */
  reliefMaxPerSchedule: number;
}

/**
 * Result from closing schedule calculation
 */
export interface ClosingScheduleResult {
  /** Worker ID this result is for */
  workerId: string;
  
  /** Mandatory closing dates (from primary tasks spanning weekends) */
  requiredDates: Date[];
  
  /** Optimal closing dates (calculated based on interval) */
  optimalDates: Date[];
  
  /** Debug log messages */
  calculationLog: string[];
  
  /** User-facing alerts/warnings */
  userAlerts: string[];
}

/**
 * Input data for a single worker's calculation
 */
export interface WorkerClosingInput {
  /** Worker ID */
  workerId: string;
  
  /** Worker's full name (for logging) */
  workerName: string;
  
  /** Closing interval (0 = never closes, 1-12 = weeks between closes) */
  closingInterval: number;
  
  /** Mandatory closing Friday dates (from primary tasks) */
  mandatoryClosingDates: Date[];
}

/**
 * Default closing schedule configuration
 */
export const DEFAULT_CLOSING_CONFIG: ClosingScheduleConfig = {
  gapSlackWeeks: 0,
  allowSingleReliefMin1: true,
  reliefMaxPerSchedule: 1,
};

