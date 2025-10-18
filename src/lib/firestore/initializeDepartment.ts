/**
 * Department Initialization Helper
 * 
 * Creates all required subcollections and documents for a new department.
 * 
 * ⚠️ CRITICAL: This must be called when ANY new department is created!
 * 
 * Location: src/lib/firestore/initializeDepartment.ts
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

/**
 * Initialize all required subcollections for a department
 * 
 * Creates:
 * - taskDefinitions/config (empty secondary and main tasks)
 * - workers collection (ready to receive worker documents)
 * 
 * Note: workers subcollection is created automatically when first worker is added
 */
export async function initializeDepartmentCollections(
  departmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Initialize task definitions (empty)
    const taskDefRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    
    await setDoc(taskDefRef, {
      secondary_tasks: {
        definitions: []
      },
      main_tasks: {
        definitions: []
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Initialized taskDefinitions for department ${departmentId}`);

    // Ensure workers map/index container doc exists so subcollections can be created under it
    const workersIndexContainerRef = doc(db, 'departments', departmentId, 'workers', 'index');
    await setDoc(
      workersIndexContainerRef,
      {
        // lightweight map placeholder (kept empty until first worker is added)
        workers: {},
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    console.log(`✅ Ensured workers/index container for department ${departmentId}`);
    
    // 2. Initialize department-level preferences configuration (merge-safe)
    const departmentRef = doc(db, 'departments', departmentId);
    await setDoc(
      departmentRef,
      {
        // Worker preferences configuration
        preferencesConfig: {
          // null = unlimited per-week blocked tasks
          maxBlockedTasksPerWeek: null,
          // Weekly cutoff controlling submissions for the upcoming week
          weeklyCutoff: {
            enabled: false,
            // Week starts on Sunday; default values are placeholders when disabled
            dayOfWeek: 'thu', // 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
            hour: 23,
            minute: 59
          }
        },
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    console.log(`✅ Initialized preferencesConfig for department ${departmentId}`);

    // Note: Schedules and other subcollections will be added later when those features are implemented

    return {
      success: true,
      message: 'Department collections initialized successfully'
    };
  } catch (error: any) {
    console.error('Error initializing department collections:', error);
    return {
      success: false,
      message: error.message || 'Failed to initialize department collections'
    };
  }
}

