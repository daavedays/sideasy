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

    // Note: Workers subcollection doesn't need initialization
    // It will be created automatically when the first worker document is added
    
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

