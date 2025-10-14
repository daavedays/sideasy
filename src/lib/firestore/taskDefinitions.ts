/**
 * Task Definitions Helper Functions
 * 
 * Functions for managing task definitions for each department.
 * Task definitions include secondary tasks and main tasks.
 * 
 * Location: src/lib/firestore/taskDefinitions.ts
 * Purpose: Task definitions data management
 */

import { 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot,
  Timestamp,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';

/**
 * Secondary Task Definition
 */
export interface SecondaryTaskDefinition {
  id: string;  // Firebase-generated ID
  name: string;
  requiresQualification: boolean;
  autoAssign: boolean;
  assign_weekends: boolean;
}

/**
 * Main Task Definition
 */
export interface MainTaskDefinition {
  id: string;  // Firebase-generated ID
  name: string;
  isDefault: boolean;
  start_day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  end_day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  duration: number;
}

/**
 * Task Definitions Document Structure
 */
export interface TaskDefinitions {
  secondary_tasks: {
    definitions: SecondaryTaskDefinition[];
  };
  main_tasks: {
    definitions: MainTaskDefinition[];
  };
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Default task definitions for new departments (empty - to be populated through UI)
 */
export const DEFAULT_TASK_DEFINITIONS: TaskDefinitions = {
  secondary_tasks: {
    definitions: []
  },
  main_tasks: {
    definitions: []
  }
};

/**
 * Initialize task definitions for a department
 * Creates a taskDefinitions document in the department's subcollection
 * 
 * @param departmentId - The department ID
 * @param customDefinitions - Optional custom task definitions (defaults to DEFAULT_TASK_DEFINITIONS)
 * @returns Promise<void>
 */
export async function initializeTaskDefinitions(
  departmentId: string,
  customDefinitions?: Partial<TaskDefinitions>
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    
    const taskDefinitions: TaskDefinitions = {
      secondary_tasks: customDefinitions?.secondary_tasks || DEFAULT_TASK_DEFINITIONS.secondary_tasks,
      main_tasks: customDefinitions?.main_tasks || DEFAULT_TASK_DEFINITIONS.main_tasks,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(taskDefsRef, taskDefinitions);
    
    console.log(`✅ Task definitions initialized for department: ${departmentId}`);
  } catch (error) {
    console.error('Error initializing task definitions:', error);
    throw error;
  }
}

/**
 * Get task definitions for a department
 * 
 * @param departmentId - The department ID
 * @returns Promise<TaskDefinitions | null>
 */
export async function getTaskDefinitions(departmentId: string): Promise<TaskDefinitions | null> {
  try {
    const key = `taskDefs:${departmentId}`;
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');

    // 1) Return cached if available (fast path)
    if (isBrowser) {
      const cachedRaw = localStorage.getItem(key);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as {
            updatedAtMs: number;
            data: Pick<TaskDefinitions, 'main_tasks' | 'secondary_tasks'>;
          };
          // Build a TaskDefinitions object including a Timestamp updatedAt
          const result: TaskDefinitions = {
            main_tasks: cached.data.main_tasks,
            secondary_tasks: cached.data.secondary_tasks,
            updatedAt: Timestamp.fromMillis(cached.updatedAtMs)
          } as TaskDefinitions;
          // Ensure realtime cache updating is active
          ensureTaskDefinitionsRealtimeCache(departmentId);
          return result;
        } catch (e) {
          // fall through to fetch
        }
      }
    }

    // 2) No cache → fetch from Firestore
    const docSnap = await getDoc(taskDefsRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data() as TaskDefinitions;
    // Write to cache (only serializable parts + updatedAtMs)
    if (isBrowser) {
      try {
        const updatedAtAny = (data as any).updatedAt;
        const updatedAtMs = updatedAtAny?.toMillis ? updatedAtAny.toMillis() : Date.now();
        const cachePayload = {
          updatedAtMs,
          data: {
            main_tasks: { definitions: data.main_tasks?.definitions || [] },
            secondary_tasks: { definitions: data.secondary_tasks?.definitions || [] }
          }
        };
        localStorage.setItem(key, JSON.stringify(cachePayload));
      } catch {}
      // Start realtime cache listener
      ensureTaskDefinitionsRealtimeCache(departmentId);
    }

    return data;
  } catch (error) {
    console.error('Error getting task definitions:', error);
    throw error;
  }
}

/**
 * Update task definitions for a department
 * 
 * @param departmentId - The department ID
 * @param updates - Partial updates to task definitions
 * @returns Promise<void>
 */
export async function updateTaskDefinitions(
  departmentId: string,
  updates: Partial<TaskDefinitions>
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    
    await setDoc(taskDefsRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ Task definitions updated for department: ${departmentId}`);
  } catch (error) {
    console.error('Error updating task definitions:', error);
    throw error;
  }
}

// ======================================================
// Realtime localStorage cache syncing for task definitions
// ======================================================

const taskDefsListeners: Record<string, boolean> = {};

function ensureTaskDefinitionsRealtimeCache(departmentId: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (taskDefsListeners[departmentId]) return; // already listening

  const key = `taskDefs:${departmentId}`;
  const ref = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');

  onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() as TaskDefinitions;
    try {
      const updatedAtAny = (data as any).updatedAt;
      const updatedAtMs = updatedAtAny?.toMillis ? updatedAtAny.toMillis() : Date.now();
      const cachePayload = {
        updatedAtMs,
        data: {
          main_tasks: { definitions: data.main_tasks?.definitions || [] },
          secondary_tasks: { definitions: data.secondary_tasks?.definitions || [] }
        }
      };
      localStorage.setItem(key, JSON.stringify(cachePayload));
    } catch {}
  }, (err) => {
    console.warn('taskDefinitions cache listener error:', err);
  });

  taskDefsListeners[departmentId] = true;
}

/**
 * Check if task definitions exist for a department
 * 
 * @param departmentId - The department ID
 * @returns Promise<boolean>
 */
export async function taskDefinitionsExist(departmentId: string): Promise<boolean> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking task definitions:', error);
    return false;
  }
}

/**
 * Add a new secondary task to department's task definitions
 * 
 * @param departmentId - The department ID
 * @param task - Secondary task data (without ID)
 * @returns Promise<string> - The generated task ID
 */
export async function addSecondaryTask(
  departmentId: string,
  task: Omit<SecondaryTaskDefinition, 'id'>
): Promise<string> {
  try {
    // Generate a unique ID for the task
    const taskId = doc(collection(db, 'temp')).id;
    
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const newTask: SecondaryTaskDefinition = {
      id: taskId,
      ...task
    };
    
    // Add the new task to the array
    const updatedDefinitions = [
      ...currentData.secondary_tasks.definitions,
      newTask
    ];
    
    await updateTaskDefinitions(departmentId, {
      secondary_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Secondary task added with ID: ${taskId}`);
    return taskId;
  } catch (error) {
    console.error('Error adding secondary task:', error);
    throw error;
  }
}

/**
 * Add a new main task to department's task definitions
 * 
 * @param departmentId - The department ID
 * @param task - Main task data (without ID)
 * @returns Promise<string> - The generated task ID
 */
export async function addMainTask(
  departmentId: string,
  task: Omit<MainTaskDefinition, 'id'>
): Promise<string> {
  try {
    // Generate a unique ID for the task
    const taskId = doc(collection(db, 'temp')).id;
    
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const newTask: MainTaskDefinition = {
      id: taskId,
      ...task
    };
    
    // Add the new task to the array
    const updatedDefinitions = [
      ...currentData.main_tasks.definitions,
      newTask
    ];
    
    await updateTaskDefinitions(departmentId, {
      main_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Main task added with ID: ${taskId}`);
    return taskId;
  } catch (error) {
    console.error('Error adding main task:', error);
    throw error;
  }
}

/**
 * Update a secondary task
 * 
 * @param departmentId - The department ID
 * @param taskId - The task ID to update
 * @param updates - Partial task data to update
 * @returns Promise<void>
 */
export async function updateSecondaryTask(
  departmentId: string,
  taskId: string,
  updates: Partial<Omit<SecondaryTaskDefinition, 'id'>>
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const taskIndex = currentData.secondary_tasks.definitions.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }
    
    // Update the task
    const updatedDefinitions = [...currentData.secondary_tasks.definitions];
    updatedDefinitions[taskIndex] = {
      ...updatedDefinitions[taskIndex],
      ...updates
    };
    
    await updateTaskDefinitions(departmentId, {
      secondary_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Secondary task updated: ${taskId}`);
  } catch (error) {
    console.error('Error updating secondary task:', error);
    throw error;
  }
}

/**
 * Update a main task
 * 
 * @param departmentId - The department ID
 * @param taskId - The task ID to update
 * @param updates - Partial task data to update
 * @returns Promise<void>
 */
export async function updateMainTask(
  departmentId: string,
  taskId: string,
  updates: Partial<Omit<MainTaskDefinition, 'id'>>
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const taskIndex = currentData.main_tasks.definitions.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }
    
    // Update the task
    const updatedDefinitions = [...currentData.main_tasks.definitions];
    updatedDefinitions[taskIndex] = {
      ...updatedDefinitions[taskIndex],
      ...updates
    };
    
    await updateTaskDefinitions(departmentId, {
      main_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Main task updated: ${taskId}`);
  } catch (error) {
    console.error('Error updating main task:', error);
    throw error;
  }
}

/**
 * Delete a secondary task
 * 
 * @param departmentId - The department ID
 * @param taskId - The task ID to delete
 * @returns Promise<void>
 */
export async function deleteSecondaryTask(
  departmentId: string,
  taskId: string
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const updatedDefinitions = currentData.secondary_tasks.definitions.filter(t => t.id !== taskId);
    
    await updateTaskDefinitions(departmentId, {
      secondary_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Secondary task deleted: ${taskId}`);
  } catch (error) {
    console.error('Error deleting secondary task:', error);
    throw error;
  }
}

/**
 * Delete a main task
 * 
 * @param departmentId - The department ID
 * @param taskId - The task ID to delete
 * @returns Promise<void>
 */
export async function deleteMainTask(
  departmentId: string,
  taskId: string
): Promise<void> {
  try {
    const taskDefsRef = doc(db, 'departments', departmentId, 'taskDefinitions', 'config');
    const docSnap = await getDoc(taskDefsRef);
    
    if (!docSnap.exists()) {
      throw new Error('Task definitions not found for this department');
    }
    
    const currentData = docSnap.data() as TaskDefinitions;
    const updatedDefinitions = currentData.main_tasks.definitions.filter(t => t.id !== taskId);
    
    await updateTaskDefinitions(departmentId, {
      main_tasks: {
        definitions: updatedDefinitions
      }
    });
    
    console.log(`✅ Main task deleted: ${taskId}`);
  } catch (error) {
    console.error('Error deleting main task:', error);
    throw error;
  }
}

