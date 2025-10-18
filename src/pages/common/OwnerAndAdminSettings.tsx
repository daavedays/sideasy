/**
 * Owner and Admin Settings Component
 * 
 * Shared settings page for managing task definitions (Secondary + Main Tasks).
 * Allows adding, editing, and deleting tasks with save-only database updates.
 * 
 * Location: src/pages/common/OwnerAndAdminSettings.tsx
 * Used by: Owner and Admin roles
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import { 
  getTaskDefinitions, 
  addSecondaryTask, 
  addMainTask, 
  updateSecondaryTask, 
  updateMainTask, 
  deleteSecondaryTask, 
  deleteMainTask,
  deleteSecondaryTaskWithCascade,
  prunePreferencesReferencingDeletedSecondaryTasks
} from '../../lib/firestore/taskDefinitions';
import type { SecondaryTaskDefinition, MainTaskDefinition } from '../../lib/firestore/taskDefinitions';

type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

interface Props {
  backUrl: string;
}

const OwnerAndAdminSettings: React.FC<Props> = ({ backUrl }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'secondary' | 'main'>('secondary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // User data
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  
  // Original data from Firestore
  const [originalSecondaryTasks, setOriginalSecondaryTasks] = useState<SecondaryTaskDefinition[]>([]);
  const [originalMainTasks, setOriginalMainTasks] = useState<MainTaskDefinition[]>([]);
  
  // Current data (with changes)
  const [secondaryTasks, setSecondaryTasks] = useState<SecondaryTaskDefinition[]>([]);
  const [mainTasks, setMainTasks] = useState<MainTaskDefinition[]>([]);
  
  // Track changes
  const [hasChanges, setHasChanges] = useState(false);
  
  // Editing state
  const [editingSecondaryId, setEditingSecondaryId] = useState<string | null>(null);
  const [editingMainId, setEditingMainId] = useState<string | null>(null);
  const [isAddingSecondary, setIsAddingSecondary] = useState(false);
  const [isAddingMain, setIsAddingMain] = useState(false);

  // Get department ID
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;

      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDepartmentId(userData.departmentId || null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setMessage({ type: 'error', text: 'שגיאה בטעינת נתוני משתמש' });
      }
    };

    fetchUserData();
  }, []);

  // Load task definitions
  useEffect(() => {
    if (!departmentId) return;

    const loadTasks = async () => {
      try {
        const tasks = await getTaskDefinitions(departmentId);
        
        if (tasks) {
          setOriginalSecondaryTasks(tasks.secondary_tasks.definitions);
          setOriginalMainTasks(tasks.main_tasks.definitions);
          setSecondaryTasks(tasks.secondary_tasks.definitions);
          setMainTasks(tasks.main_tasks.definitions);
        } else {
          // No task definitions yet - start with empty arrays
          setOriginalSecondaryTasks([]);
          setOriginalMainTasks([]);
          setSecondaryTasks([]);
          setMainTasks([]);
        }
        
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading tasks:', error);
        
        // Handle permission denied (no data yet or no access)
        if (error?.code === 'permission-denied') {
          // Start with empty arrays - user will be able to create tasks
          setOriginalSecondaryTasks([]);
          setOriginalMainTasks([]);
          setSecondaryTasks([]);
          setMainTasks([]);
          setLoading(false);
        } else {
          // Other errors
          setMessage({ type: 'error', text: 'שגיאה בטעינת משימות' });
          setLoading(false);
        }
      }
    };

    loadTasks();
  }, [departmentId]);

  // Check for changes
  useEffect(() => {
    const changed = 
      JSON.stringify(secondaryTasks) !== JSON.stringify(originalSecondaryTasks) ||
      JSON.stringify(mainTasks) !== JSON.stringify(originalMainTasks);
    
    setHasChanges(changed);
  }, [secondaryTasks, mainTasks, originalSecondaryTasks, originalMainTasks]);

  // Browser close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'יש לך שינויים שלא נשמרו. האם אתה בטוח?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Navigation guard
  useEffect(() => {
    const handleNavigation = (e: MouseEvent) => {
      if (hasChanges) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          if (!window.confirm('יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לעזוב?')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    document.addEventListener('click', handleNavigation, true);
    return () => document.removeEventListener('click', handleNavigation, true);
  }, [hasChanges]);

  // Save all changes
  const handleSave = async () => {
    if (!departmentId) return;

    // Validate all tasks have names
    const emptySecondaryTasks = secondaryTasks.filter(task => !task.name || task.name.trim().length === 0);
    const emptyMainTasks = mainTasks.filter(task => !task.name || task.name.trim().length === 0);
    
    if (emptySecondaryTasks.length > 0 || emptyMainTasks.length > 0) {
      setMessage({ 
        type: 'error', 
        text: 'לא ניתן לשמור משימות ללא שם. אנא מחק משימות ריקות או מלא להן שם.' 
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Process secondary tasks
      for (const task of secondaryTasks) {
        if (task.id.startsWith('temp_')) {
          // New task - add to Firestore
          const { id, ...taskData } = task;
          await addSecondaryTask(departmentId, taskData);
        } else {
          // Check if task was modified
          const original = originalSecondaryTasks.find(t => t.id === task.id);
          if (original && JSON.stringify(original) !== JSON.stringify(task)) {
            // Update existing task
            await updateSecondaryTask(departmentId, task.id, task);
          }
        }
      }

      // Check for deleted secondary tasks (with cascade + auto-prune + warning if required qualification)
      for (const original of originalSecondaryTasks) {
        if (!secondaryTasks.find(t => t.id === original.id)) {
          const requiresQual = !!original.requiresQualification;
          if (requiresQual) {
            const ok = window.confirm(`אזהרה: מחיקת המשימה "${original.name}" תסיר את ההסמכה הזו מכל העובדים שיש להם אותה, ותעדכן את המסמכים הרלוונטיים. האם להמשיך?`);
            if (!ok) continue;
          }
          // Cascade removal (also updates workers map + byWorker docs)
          const res = await deleteSecondaryTaskWithCascade(departmentId, original.id);
          if (requiresQual) {
            try { alert(`ההסמכה הוסרה מ-${res.affectedWorkers} עובדים`); } catch {}
          }
          // Always prune dangling preferences after deletion
          await prunePreferencesReferencingDeletedSecondaryTasks(departmentId);
        }
      }

      // Process main tasks
      for (const task of mainTasks) {
        if (task.id.startsWith('temp_')) {
          // New task - add to Firestore
          const { id, ...taskData } = task;
          await addMainTask(departmentId, taskData);
        } else {
          // Check if task was modified
          const original = originalMainTasks.find(t => t.id === task.id);
          if (original && JSON.stringify(original) !== JSON.stringify(task)) {
            // Update existing task
            await updateMainTask(departmentId, task.id, task);
          }
        }
      }

      // Check for deleted main tasks
      for (const original of originalMainTasks) {
        if (!mainTasks.find(t => t.id === original.id)) {
          await deleteMainTask(departmentId, original.id);
        }
      }

      // Reload tasks from Firestore
      const updatedTasks = await getTaskDefinitions(departmentId);
      
      if (updatedTasks) {
        setOriginalSecondaryTasks(updatedTasks.secondary_tasks.definitions);
        setOriginalMainTasks(updatedTasks.main_tasks.definitions);
        setSecondaryTasks(updatedTasks.secondary_tasks.definitions);
        setMainTasks(updatedTasks.main_tasks.definitions);
      }

      setMessage({ type: 'success', text: 'השינויים נשמרו בהצלחה!' });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving tasks:', error);
      
      // Provide specific error messages
      if (error?.code === 'permission-denied') {
        setMessage({ type: 'error', text: 'אין לך הרשאות לשמור שינויים. נא להתחבר מחדש.' });
      } else if (error?.code === 'unavailable') {
        setMessage({ type: 'error', text: 'אין חיבור לשרת. בדוק את החיבור לאינטרנט.' });
      } else {
        setMessage({ type: 'error', text: 'שגיאה בשמירת שינויים. נסה שוב.' });
      }
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל את כל השינויים?')) {
      setSecondaryTasks([...originalSecondaryTasks]);
      setMainTasks([...originalMainTasks]);
      setIsAddingSecondary(false);
      setIsAddingMain(false);
      setEditingSecondaryId(null);
      setEditingMainId(null);
      setMessage(null);
    }
  };

  // Secondary Tasks Functions
  const handleAddSecondary = () => {
    const newTask: SecondaryTaskDefinition = {
      id: `temp_${Date.now()}`,
      name: '',
      requiresQualification: false,
      autoAssign: false,
      assign_weekends: false
    };
    setSecondaryTasks([...secondaryTasks, newTask]);
    setEditingSecondaryId(newTask.id);
    setIsAddingSecondary(true);
  };

  const handleUpdateSecondary = (id: string, updates: Partial<SecondaryTaskDefinition>) => {
    setSecondaryTasks(secondaryTasks.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
  };

  const handleDeleteSecondary = async (id: string, name: string) => {
    const task = secondaryTasks.find(t => t.id === id);
    const isExisting = id && !id.startsWith('temp_');
    const requiresQual = !!task?.requiresQualification;

    // For new (unsaved) tasks → local remove only
    if (!isExisting) {
      if (window.confirm(`האם אתה בטוח שברצונך למחוק את '${name}'?`)) {
        setSecondaryTasks(secondaryTasks.filter(t => t.id !== id));
        if (editingSecondaryId === id) {
          setEditingSecondaryId(null);
          setIsAddingSecondary(false);
        }
      }
      return;
    }

    if (!departmentId) return;

    // Stronger warning for qualification-required tasks
    const message = requiresQual
      ? `אזהרה קריטית:\n\nמחיקת המשימה "${name}" תסיר את ההסמכה הזו מכל העובדים שיש להם אותה.\nבנוסף, ננקה העדפות שמפנות למשימה זו.\n\nהאם להמשיך?`
      : `מחיקת המשימה "${name}" תנקה העדפות שמפנות למשימה זו.\n\nהאם להמשיך?`;

    const ok = window.confirm(message);
    if (!ok) return;

    try {
      if (requiresQual) {
        const res = await deleteSecondaryTaskWithCascade(departmentId, id);
        try { alert(`ההסמכה הוסרה מ-${res.affectedWorkers} עובדים`); } catch {}
      } else {
        await deleteSecondaryTask(departmentId, id);
      }

      // Always prune dangling preferences after any secondary task deletion
      await prunePreferencesReferencingDeletedSecondaryTasks(departmentId);

      // Update local state and originals by reloading from Firestore
      const updated = await getTaskDefinitions(departmentId);
      if (updated) {
        setOriginalSecondaryTasks(updated.secondary_tasks.definitions);
        setSecondaryTasks(updated.secondary_tasks.definitions);
        // keep main tasks as-is
      } else {
        setOriginalSecondaryTasks([]);
        setSecondaryTasks([]);
      }

      // Clear editing state if needed
      if (editingSecondaryId === id) {
        setEditingSecondaryId(null);
        setIsAddingSecondary(false);
      }

      setMessage({ type: 'success', text: 'המשימה נמחקה וניקינו הפניות לא תקפות' });
    } catch (e) {
      console.error('מחיקת משימה נכשלה', e);
      setMessage({ type: 'error', text: 'מחיקה נכשלה. נסה שוב.' });
    }
  };

  // Main Tasks Functions
  const handleAddMain = () => {
    const newTask: MainTaskDefinition = {
      id: `temp_${Date.now()}`,
      name: '',
      isDefault: false,
      start_day: 'sun',
      end_day: 'sun',
      duration: 1
    };
    setMainTasks([...mainTasks, newTask]);
    setEditingMainId(newTask.id);
    setIsAddingMain(true);
  };

  const handleUpdateMain = (id: string, updates: Partial<MainTaskDefinition>) => {
    setMainTasks(mainTasks.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
  };

  const handleDeleteMain = (id: string, name: string) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את '${name}'?`)) {
      setMainTasks(mainTasks.filter(task => task.id !== id));
      if (editingMainId === id) {
        setEditingMainId(null);
        setIsAddingMain(false);
      }
    }
  };

  // Calculate duration options based on start and end days
  const getDurationOptions = (startDay: DayOfWeek, endDay: DayOfWeek): number[] => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const startIdx = days.indexOf(startDay);
    const endIdx = days.indexOf(endDay);
    
    let baseDuration = endIdx >= startIdx ? endIdx - startIdx + 1 : 7 - startIdx + endIdx + 1;
    
    const options = [];
    for (let i = 0; i < 6; i++) {
      options.push(baseDuration + (i * 7));
    }
    
    return options;
  };

  // Convert day code to Hebrew
  const getDayInHebrew = (day: DayOfWeek): string => {
    const days: Record<DayOfWeek, string> = {
      sun: 'ראשון',
      mon: 'שני',
      tue: 'שלישי',
      wed: 'רביעי',
      thu: 'חמישי',
      fri: 'שישי',
      sat: 'שבת'
    };
    return days[day];
  };

  if (loading) {
    return (
      <div dir="rtl" className="relative flex-1 min-h-screen">
        <Background singleImage="/images/image_1.png" />
        <Header />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <p className="text-white text-2xl">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => {
                if (hasChanges) {
                  if (window.confirm('יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לעזוב?')) {
                    navigate(backUrl);
                  }
                } else {
                  navigate(backUrl);
                }
              }}
              className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
            >
              ← חזרה
            </button>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              הגדרות משימות
            </h1>
            <p className="text-white/80 mt-2">
              נהל את הגדרות המשימות למחלקה שלך
            </p>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50'
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <p className="text-white text-center">{message.text}</p>
            </div>
          )}

          {/* Save/Discard Buttons */}
          {hasChanges && (
            <div className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-white">
                  ⚠️ יש לך שינויים שלא נשמרו
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDiscard}
                    disabled={saving}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    בטל שינויים
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 mb-6 border border-white/20 inline-flex gap-2">
            <button
              onClick={() => setActiveTab('secondary')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'secondary'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              משימות משניות ({secondaryTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('main')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'main'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              משימות ראשיות ({mainTasks.length})
            </button>
          </div>

          {/* Secondary Tasks Tab */}
          {activeTab === 'secondary' && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
              <div className="p-6 border-b border-white/20 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">משימות משניות</h2>
                <button
                  onClick={handleAddSecondary}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  ➕ הוסף משימה
                </button>
              </div>

              <div className="p-6">
                {secondaryTasks.length === 0 ? (
                  <div className="text-center py-12 text-white/70">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-xl text-white mb-2">אין משימות משניות מוגדרות</p>
                    <p className="text-sm mt-2">לחץ על "הוסף משימה" כדי ליצור את המשימה הראשונה שלך</p>
                    <p className="text-xs mt-4 text-white/50">משימות משניות הן משימות שניתן להקצות לעובדים לצד המשימות הראשיות</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {secondaryTasks.map((task) => (
                      <SecondaryTaskCard
                        key={task.id}
                        task={task}
                        isEditing={editingSecondaryId === task.id}
                        onEdit={() => setEditingSecondaryId(task.id)}
                        onSaveEdit={() => {
                          if (task.name.trim().length === 0) {
                            alert('שם המשימה הוא שדה חובה');
                            return;
                          }
                          if (task.name.length > 15) {
                            alert('שם המשימה חייב להיות עד 15 תווים');
                            return;
                          }
                          setEditingSecondaryId(null);
                          setIsAddingSecondary(false);
                        }}
                        onCancelEdit={() => {
                          if (isAddingSecondary && task.id.startsWith('temp_')) {
                            // Remove the new task if cancelled
                            setSecondaryTasks(secondaryTasks.filter(t => t.id !== task.id));
                            setIsAddingSecondary(false);
                          }
                          setEditingSecondaryId(null);
                        }}
                        onUpdate={handleUpdateSecondary}
                        onDelete={handleDeleteSecondary}
                      />
                    ))}
                  </div>
                )}
                {/* Pruning now runs automatically after deletions; no manual button */}
              </div>
            </div>
          )}

          {/* Main Tasks Tab */}
          {activeTab === 'main' && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
              <div className="p-6 border-b border-white/20 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">משימות ראשיות</h2>
                <button
                  onClick={handleAddMain}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  ➕ הוסף משימה
                </button>
              </div>

              <div className="p-6">
                {mainTasks.length === 0 ? (
                  <div className="text-center py-12 text-white/70">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-xl text-white mb-2">אין משימות ראשיות מוגדרות</p>
                    <p className="text-sm mt-2">לחץ על "הוסף משימה" כדי ליצור את המשימה הראשונה שלך</p>
                    <p className="text-xs mt-4 text-white/50">משימות ראשיות מגדירות את סידורי העבודה הקבועים של המחלקה</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mainTasks.map((task) => (
                      <MainTaskCard
                        key={task.id}
                        task={task}
                        isEditing={editingMainId === task.id}
                        onEdit={() => setEditingMainId(task.id)}
                        onSaveEdit={() => {
                          if (task.name.trim().length === 0) {
                            alert('שם המשימה הוא שדה חובה');
                            return;
                          }
                          if (task.name.length > 15) {
                            alert('שם המשימה חייב להיות עד 15 תווים');
                            return;
                          }
                          setEditingMainId(null);
                          setIsAddingMain(false);
                        }}
                        onCancelEdit={() => {
                          if (isAddingMain && task.id.startsWith('temp_')) {
                            // Remove the new task if cancelled
                            setMainTasks(mainTasks.filter(t => t.id !== task.id));
                            setIsAddingMain(false);
                          }
                          setEditingMainId(null);
                        }}
                        onUpdate={handleUpdateMain}
                        onDelete={handleDeleteMain}
                        getDurationOptions={getDurationOptions}
                        getDayInHebrew={getDayInHebrew}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Secondary Task Card Component
interface SecondaryTaskCardProps {
  task: SecondaryTaskDefinition;
  isEditing: boolean;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (id: string, updates: Partial<SecondaryTaskDefinition>) => void;
  onDelete: (id: string, name: string) => void;
}

const SecondaryTaskCard: React.FC<SecondaryTaskCardProps> = ({
  task,
  isEditing,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onUpdate,
  onDelete
}) => {
  if (isEditing) {
    return (
      <div className="bg-white/5 border border-white/20 rounded-xl p-4">
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-white mb-2 text-sm">
              שם המשימה <span className="text-red-400">*</span> <span className="text-white/60">(עד 15 תווים)</span>
            </label>
            <input
              type="text"
              value={task.name}
              onChange={(e) => {
                if (e.target.value.length <= 15) {
                  onUpdate(task.id, { name: e.target.value });
                }
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              placeholder="שם המשימה"
              maxLength={15}
            />
            <p className="text-white/50 text-xs mt-1">{task.name.length}/15 תווים</p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={task.requiresQualification}
                onChange={(e) => onUpdate(task.id, { requiresQualification: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <span>דורש הסמכה</span>
            </label>

            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={task.autoAssign}
                onChange={(e) => onUpdate(task.id, { autoAssign: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <span>הקצאה אוטומטית</span>
            </label>

            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={task.assign_weekends}
                onChange={(e) => onUpdate(task.id, { assign_weekends: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <span>כולל סופי שבוע</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSaveEdit}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              ✓ סיום עריכה
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              ✕ ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoName = !task.name || task.name.trim().length === 0;

  return (
    <div className={`bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors ${
      hasNoName ? 'border-2 border-red-500' : 'border border-white/20'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">
            <span className={hasNoName ? 'text-red-400' : 'text-white'}>
              {task.name || '(ללא שם)'}
            </span>
            {hasNoName && (
              <span className="text-red-400 text-sm mr-2">⚠️ חובה למלא שם</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {task.requiresQualification && (
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-full text-sm">
                דורש הסמכה
              </span>
            )}
            {task.autoAssign && (
              <span className="px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-300 rounded-full text-sm">
                הקצאה אוטומטית
              </span>
            )}
            {task.assign_weekends && (
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-full text-sm">
                כולל סופי שבוע
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ✏️ ערוך
          </button>
          <button
            onClick={() => onDelete(task.id, task.name)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ מחק
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Task Card Component
interface MainTaskCardProps {
  task: MainTaskDefinition;
  isEditing: boolean;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (id: string, updates: Partial<MainTaskDefinition>) => void;
  onDelete: (id: string, name: string) => void;
  getDurationOptions: (start: DayOfWeek, end: DayOfWeek) => number[];
  getDayInHebrew: (day: DayOfWeek) => string;
}

const MainTaskCard: React.FC<MainTaskCardProps> = ({
  task,
  isEditing,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  getDurationOptions,
  getDayInHebrew
}) => {
  const durationOptions = getDurationOptions(task.start_day, task.end_day);

  if (isEditing) {
    return (
      <div className="bg-white/5 border border-white/20 rounded-xl p-4">
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-white mb-2 text-sm">
              שם המשימה <span className="text-red-400">*</span> <span className="text-white/60">(עד 15 תווים)</span>
            </label>
            <input
              type="text"
              value={task.name}
              onChange={(e) => {
                if (e.target.value.length <= 15) {
                  onUpdate(task.id, { name: e.target.value });
                }
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              placeholder="שם המשימה"
              maxLength={15}
            />
            <p className="text-white/50 text-xs mt-1">{task.name.length}/15 תווים</p>
          </div>

          {/* Day Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white mb-2 text-sm">יום התחלה</label>
              <select
                value={task.start_day}
                onChange={(e) => {
                  const newStartDay = e.target.value as DayOfWeek;
                  onUpdate(task.id, { 
                    start_day: newStartDay,
                    duration: getDurationOptions(newStartDay, task.end_day)[0]
                  });
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
              >
                <option value="sun">ראשון</option>
                <option value="mon">שני</option>
                <option value="tue">שלישי</option>
                <option value="wed">רביעי</option>
                <option value="thu">חמישי</option>
                <option value="fri">שישי</option>
                <option value="sat">שבת</option>
              </select>
            </div>

            <div>
              <label className="block text-white mb-2 text-sm">יום סיום</label>
              <select
                value={task.end_day}
                onChange={(e) => {
                  const newEndDay = e.target.value as DayOfWeek;
                  onUpdate(task.id, { 
                    end_day: newEndDay,
                    duration: getDurationOptions(task.start_day, newEndDay)[0]
                  });
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
              >
                <option value="sun">ראשון</option>
                <option value="mon">שני</option>
                <option value="tue">שלישי</option>
                <option value="wed">רביעי</option>
                <option value="thu">חמישי</option>
                <option value="fri">שישי</option>
                <option value="sat">שבת</option>
              </select>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-white mb-2 text-sm">משך זמן (בימים)</label>
            <select
              value={task.duration}
              onChange={(e) => onUpdate(task.id, { duration: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
            >
              {durationOptions.map((option) => (
                <option key={option} value={option}>
                  {option} {option === 1 ? 'יום' : 'ימים'}
                </option>
              ))}
            </select>
          </div>

          {/* Is Default Checkbox */}
          <div>
            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={task.isDefault}
                onChange={(e) => onUpdate(task.id, { isDefault: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <span>משימה ברירת מחדל</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSaveEdit}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              ✓ סיום עריכה
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              ✕ ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoName = !task.name || task.name.trim().length === 0;

  return (
    <div className={`bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors ${
      hasNoName ? 'border-2 border-red-500' : 'border border-white/20'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">
            <span className={hasNoName ? 'text-red-400' : 'text-white'}>
              {task.name || '(ללא שם)'}
            </span>
            {hasNoName && (
              <span className="text-red-400 text-sm mr-2">⚠️ חובה למלא שם</span>
            )}
            {task.isDefault && !hasNoName && (
              <span className="mr-2 text-yellow-400 text-sm">(ברירת מחדל)</span>
            )}
          </h3>
          <div className="text-white/70 space-y-1">
            <p>📅 {getDayInHebrew(task.start_day)} - {getDayInHebrew(task.end_day)}</p>
            <p>⏱️ משך זמן: {task.duration} {task.duration === 1 ? 'יום' : 'ימים'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ✏️ ערוך
          </button>
          <button
            onClick={() => onDelete(task.id, task.name)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ מחק
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerAndAdminSettings;