/**
 * Closing Schedule Calculator
 * 
 * TypeScript port of the Python closing schedule optimization algorithm.
 * 
 * This calculator uses a constraint satisfaction approach that:
 * 1. Respects closing intervals (no consecutive closes possible)
 * 2. Integrates mandatory closing dates naturally without breaking patterns
 * 3. Uses greedy min-gap filling to maximize optimal picks
 * 4. Ensures consistent, predictable results
 * 
 * Location: src/lib/utils/closingScheduleCalculator.ts
 */

import {
  ClosingScheduleConfig,
  ClosingScheduleResult,
  WorkerClosingInput,
  DEFAULT_CLOSING_CONFIG,
} from '../../types/closingSchedule.types';

export class ClosingScheduleCalculator {
  private config: ClosingScheduleConfig;
  
  constructor(config?: Partial<ClosingScheduleConfig>) {
    this.config = {
      ...DEFAULT_CLOSING_CONFIG,
      ...config,
    };
  }
  
  /**
   * Calculate closing schedule for a single worker
   * 
   * @param workerInput - Worker data (interval, mandatory dates)
   * @param semesterWeeks - All Friday dates in the schedule (chronological order)
   * @returns Calculation result with required and optimal dates
   */
  calculateWorkerSchedule(
    workerInput: WorkerClosingInput,
    semesterWeeks: Date[]
  ): ClosingScheduleResult {
    const calculationLog: string[] = [];
    const userAlerts: string[] = [];
    
    // Validate inputs
    if (!semesterWeeks || semesterWeeks.length === 0) {
      return {
        workerId: workerInput.workerId,
        requiredDates: [],
        optimalDates: [],
        calculationLog: ['No semester weeks provided'],
        userAlerts: [],
      };
    }
    
    // Skip workers who never close
    if (workerInput.closingInterval === 0) {
      calculationLog.push(`Worker ${workerInput.workerName} has interval 0 (never closes) - skipping`);
      return {
        workerId: workerInput.workerId,
        requiredDates: workerInput.mandatoryClosingDates,
        optimalDates: [],
        calculationLog,
        userAlerts: [],
      };
    }
    
    // Validate interval
    const interval = Math.max(2, Math.min(12, Math.floor(workerInput.closingInterval)));
    if (interval !== workerInput.closingInterval) {
      calculationLog.push(`Adjusted interval from ${workerInput.closingInterval} to ${interval} (range: 2-12)`);
    }
    
    const minGap = interval - 1;
    calculationLog.push(`Worker: ${workerInput.workerName}`);
    calculationLog.push(`Interval: ${interval} weeks → Min gap: ${minGap} weeks between closes`);
    
    // Convert mandatory dates to week numbers (1-based)
    const requiredWeeks = this.datesToWeekNumbers(
      workerInput.mandatoryClosingDates,
      semesterWeeks
    );
    
    if (requiredWeeks.length > 0) {
      calculationLog.push(`Mandatory closing dates: ${workerInput.mandatoryClosingDates.length} dates provided`);
      calculationLog.push(`Matched to weeks: ${requiredWeeks.join(', ')}`);
    } else {
      calculationLog.push(`Mandatory closing weeks: none`);
    }
    
    const totalWeeks = semesterWeeks.length;
    
    // Check if schedule is too short for interval
    if (interval > totalWeeks) {
      calculationLog.push(`⚠️ Interval (${interval}) > schedule length (${totalWeeks}) - no optimal dates possible`);
      return {
        workerId: workerInput.workerId,
        requiredDates: workerInput.mandatoryClosingDates,
        optimalDates: [],
        calculationLog,
        userAlerts: [`עובד ${workerInput.workerName}: מרווח סגירה גדול מאורך התקופה`],
      };
    }
    
    // Calculate optimal weeks using min-gap greedy algorithm
    const optimalWeeks = this.selectOptimalWeeksMinGap(
      totalWeeks,
      requiredWeeks,
      interval,
      calculationLog
    );
    
    // Optional relief for edge cases (gap = 2n-1)
    const finalOptimalWeeks = this.applyReliefIfNeeded(
      optimalWeeks,
      requiredWeeks,
      interval,
      totalWeeks,
      calculationLog
    );
    
    // Convert week numbers back to dates
    const optimalDates = finalOptimalWeeks
      .filter(weekNum => !requiredWeeks.includes(weekNum))
      .map(weekNum => semesterWeeks[weekNum - 1]);
    
    calculationLog.push(`✅ Result: ${workerInput.mandatoryClosingDates.length} mandatory + ${optimalDates.length} optimal = ${workerInput.mandatoryClosingDates.length + optimalDates.length} total closes`);
    
    return {
      workerId: workerInput.workerId,
      requiredDates: workerInput.mandatoryClosingDates,
      optimalDates,
      calculationLog,
      userAlerts,
    };
  }
  
  /**
   * Select optimal weeks using min-gap greedy algorithm
   * 
   * Strategy:
   * 1. Fill before first required week
   * 2. Fill between consecutive required weeks
   * 3. Fill after last required week
   * 
   * All fills use step = interval, respecting min-gap constraint
   */
  private selectOptimalWeeksMinGap(
    totalWeeks: number,
    requiredWeeks: number[],
    interval: number,
    log: string[]
  ): number[] {
    const picks: number[] = [];
    const req = [...requiredWeeks].sort((a, b) => a - b);
    
    if (req.length === 0) {
      // No required weeks → fill from week 1 with step = interval
      let week = 1;
      while (week <= totalWeeks) {
        picks.push(week);
        week += interval;
      }
      log.push(`No mandatory weeks → picked ${picks.length} weeks: [${picks.join(', ')}]`);
      return picks;
    }
    
    // Fill before first required week
    const firstRequired = req[0];
    const latestBeforeFirst = firstRequired - interval;
    if (latestBeforeFirst >= 1) {
      let week = 1;
      while (week <= latestBeforeFirst) {
        picks.push(week);
        week += interval;
      }
      log.push(`Start gap (→${firstRequired}): picked [${picks.filter(w => w < firstRequired).join(', ') || 'none'}]`);
    } else {
      log.push(`Start gap (→${firstRequired}): none (latest allowed = ${latestBeforeFirst})`);
    }
    
    // Fill between consecutive required weeks
    for (let i = 0; i < req.length - 1; i++) {
      const a = req[i];
      const b = req[i + 1];
      const startWeek = a + interval;
      const endWeek = b - interval;
      
      if (startWeek <= endWeek) {
        const gapPicks: number[] = [];
        let week = startWeek;
        while (week <= endWeek) {
          picks.push(week);
          gapPicks.push(week);
          week += interval;
        }
        log.push(`Gap ${a}→${b}: picked [${gapPicks.join(', ')}]`);
      } else {
        log.push(`Gap ${a}→${b}: none (start ${startWeek} > end ${endWeek})`);
      }
    }
    
    // Fill after last required week
    const lastRequired = req[req.length - 1];
    let week = lastRequired + interval;
    const afterPicks: number[] = [];
    while (week <= totalWeeks) {
      picks.push(week);
      afterPicks.push(week);
      week += interval;
    }
    log.push(`End gap (${lastRequired}→): picked [${afterPicks.join(', ') || 'none'}]`);
    
    // Deduplicate and sort
    const uniquePicks = [...new Set(picks)].sort((a, b) => a - b);
    return uniquePicks;
  }
  
  /**
   * Apply relief picks for edge cases where gap = 2n-1
   * 
   * Only applies if:
   * - config.allowSingleReliefMin1 is true
   * - interval > 2 (prevents consecutive weeks)
   * - reliefMaxPerSchedule limit not exceeded
   * - Relief doesn't violate spacing constraints
   * 
   * NOTE: Relief is intentionally restrictive to maintain spacing guarantees.
   * If relief would create spacing violations, it's not applied.
   */
  private applyReliefIfNeeded(
    optimalWeeks: number[],
    requiredWeeks: number[],
    interval: number,
    totalWeeks: number,
    log: string[]
  ): number[] {
    if (!this.config.allowSingleReliefMin1 || interval <= 2 || this.config.reliefMaxPerSchedule <= 0) {
      return optimalWeeks;
    }
    
    // Combine required + optimal
    const combined = [...new Set([...requiredWeeks, ...optimalWeeks])].sort((a, b) => a - b);
    const reliefWeeks: number[] = [];
    let appliedCount = 0;
    
    for (let i = 0; i < combined.length - 1; i++) {
      if (appliedCount >= this.config.reliefMaxPerSchedule) break;
      
      const a = combined[i];
      const b = combined[i + 1];
      const gap = b - a;
      
      // Check if gap = 2n-1
      if (gap === (2 * interval - 1)) {
        const reliefWeek = a + interval;
        
        // Ensure relief week is valid and not already used
        if (reliefWeek >= 1 && reliefWeek <= totalWeeks && 
            !combined.includes(reliefWeek) && 
            !requiredWeeks.includes(reliefWeek)) {
          
          // CRITICAL CHECK: Ensure relief doesn't violate spacing
          // Relief creates gaps of (interval) and (interval-1)
          // Minimum difference between closes must be >= interval
          const gapBefore = reliefWeek - a; // Should be interval
          const gapAfter = b - reliefWeek;   // Will be interval-1
          
          // Both gaps must be >= interval (strict spacing requirement)
          if (gapBefore >= interval && gapAfter >= interval) {
            reliefWeeks.push(reliefWeek);
            appliedCount++;
            log.push(`🆘 Relief: inserted week ${reliefWeek} between ${a} and ${b} (gap=${gap}, creating gaps ${gapBefore} and ${gapAfter})`);
          } else {
            log.push(`⚠️ Relief skipped for ${a}→${b}: would violate spacing (gaps would be ${gapBefore} and ${gapAfter}, need ≥${interval})`);
          }
        }
      }
    }
    
    if (reliefWeeks.length > 0) {
      return [...new Set([...optimalWeeks, ...reliefWeeks])].sort((a, b) => a - b);
    }
    
    return optimalWeeks;
  }
  
  /**
   * Convert Date objects to week numbers (1-based)
   * 
   * Matches dates against semesterWeeks array by comparing date values (year, month, day only)
   * IMPORTANT: Ignores time component to handle timezone/time differences
   */
  private datesToWeekNumbers(dates: Date[], semesterWeeks: Date[]): number[] {
    const weekNumbers: number[] = [];
    
    for (const date of dates) {
      // Normalize to date-only comparison (ignore time)
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth();
      const targetDay = date.getDate();
      
      const weekIndex = semesterWeeks.findIndex(week => {
        return week.getFullYear() === targetYear &&
               week.getMonth() === targetMonth &&
               week.getDate() === targetDay;
      });
      
      if (weekIndex !== -1) {
        weekNumbers.push(weekIndex + 1); // Convert to 1-based
      } else {
        // Log warning if mandatory date doesn't match any week Friday
        console.warn(`⚠️ Mandatory date ${date.toISOString()} (${targetYear}-${targetMonth+1}-${targetDay}) doesn't match any week Friday`);
      }
    }
    
    return weekNumbers.sort((a, b) => a - b);
  }
}

