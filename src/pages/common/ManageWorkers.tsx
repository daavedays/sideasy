/**
 * Manage Workers Component (Shared)
 * 
 * Shared component for managing workers in a department.
 * Used by both Owner and Admin with different permission levels.
 * 
 * Owner: Can edit all fields, change roles, delete users, manage everyone
 * Admin: Can only edit qualifications for workers (not admins)
 * 
 * Location: src/pages/common/ManageWorkers.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { REALTIME_LISTENERS_ENABLED } from '../../config/appConfig';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import {
  updateWorkerWithSync,
  changeWorkerRole,
  softDeleteWorker,
  WorkerData
} from '../../lib/firestore/workers';
import { getTaskDefinitions, type SecondaryTaskDefinition } from '../../lib/firestore/taskDefinitions';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

interface Props {
  backUrl: string;
  userRole: 'owner' | 'admin';
}

const ManageWorkers: React.FC<Props> = ({ backUrl, userRole }) => {
  const navigate = useNavigate();
  
  // User & Department
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Workers Data
  const [originalWorkers, setOriginalWorkers] = useState<WorkerData[]>([]);
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<WorkerData[]>([]);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'worker'>('all');
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);
  const roleFilterDetailsRef = useRef<HTMLDetailsElement>(null);
  
  // Editing
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editingWorker, setEditingWorker] = useState<WorkerData | null>(null);
  
  // Task Definitions (for qualifications)
  const [taskDefinitions, setTaskDefinitions] = useState<SecondaryTaskDefinition[]>([]);
  
  // Closing Intervals
  const [customClosingInterval, setCustomClosingInterval] = useState<number | null>(null);
  const [showCustomIntervalInput, setShowCustomIntervalInput] = useState(false);
  const [modalRoleOpen, setModalRoleOpen] = useState(false);
  const modalRoleDetailsRef = useRef<HTMLDetailsElement>(null);
  const [closingOpen, setClosingOpen] = useState(false);
  const closingDetailsRef = useRef<HTMLDetailsElement>(null);
  
  // Changes tracking
  const [hasChanges, setHasChanges] = useState(false);

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

  // Load workers once from consolidated map document
  useEffect(() => {
    const loadWorkersOnce = async () => {
      if (!departmentId) return;
      try {
        const mapRef = doc(db, 'departments', departmentId, 'workers', 'index');
        const mapSnap = await getDoc(mapRef);
        const workersData: WorkerData[] = [];
        if (mapSnap.exists()) {
          const data = mapSnap.data() as any;
          const workersMap = (data.workers || {}) as Record<string, any>;
          Object.values(workersMap).forEach((entry: any) => {
            const normalized: WorkerData = {
              workerId: entry.workerId,
              firstName: entry.firstName,
              lastName: entry.lastName,
              email: entry.email,
              unit: entry.unit || '',
              role: entry.role,
              isOfficer: !!entry.isOfficer,
              activity: entry.activity,
              qualifications: entry.qualifications || [],
              closingInterval: entry.closingInterval ?? 0,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            } as any;

            // Filter by role for admins (only show workers)
            if (userRole === 'admin' && normalized.role !== 'worker') return;
            // Skip deleted
            if (normalized.activity === 'deleted') return;

            workersData.push(normalized);
          });
        }

        // Sort by name
      workersData.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          return nameA.localeCompare(nameB, 'he');
        });

        setOriginalWorkers(workersData);
        setWorkers(workersData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading workers map:', error);
        setMessage({ type: 'error', text: 'שגיאה בטעינת עובדים' });
        setLoading(false);
      }
    };

    loadWorkersOnce();
  }, [departmentId, userRole]);

  // Realtime updates for consolidated workers map (optional via toggle)
  useEffect(() => {
    if (!departmentId) return;
    if (!REALTIME_LISTENERS_ENABLED) return;

    const mapRef = doc(db, 'departments', departmentId, 'workers', 'index');
    const unsubscribe = onSnapshot(mapRef, (mapSnap) => {
      if (!mapSnap.exists()) return;

      const data = mapSnap.data() as any;
      const workersMap = (data.workers || {}) as Record<string, any>;
      const workersData: WorkerData[] = [];

      Object.values(workersMap).forEach((entry: any) => {
        const normalized: WorkerData = {
          workerId: entry.workerId,
          firstName: entry.firstName,
          lastName: entry.lastName,
          email: entry.email,
          unit: entry.unit || '',
          role: entry.role,
          isOfficer: !!entry.isOfficer,
          activity: entry.activity,
          qualifications: entry.qualifications || [],
          closingInterval: entry.closingInterval ?? 0,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        } as any;

        if (userRole === 'admin' && normalized.role !== 'worker') return;
        if (normalized.activity === 'deleted') return;
        workersData.push(normalized);
      });

      workersData.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB, 'he');
      });

      setOriginalWorkers(workersData);
      // Only overwrite current editable list if there are no local edits in progress
      if (!hasChanges && !editingWorkerId) {
        setWorkers(workersData);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening to workers map:', err);
    });

    return () => unsubscribe();
  }, [departmentId, userRole, hasChanges, editingWorkerId]);

  // Load task definitions for qualifications
  useEffect(() => {
    if (!departmentId) return;

    const loadTasks = async () => {
      try {
        const tasks = await getTaskDefinitions(departmentId);
        if (tasks) {
          setTaskDefinitions(tasks.secondary_tasks.definitions);
        }
      } catch (error) {
        console.error('Error loading task definitions:', error);
      }
    };

    loadTasks();
  }, [departmentId]);

  // Search & Filter
  useEffect(() => {
    let filtered = [...workers];

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(w => w.role === roleFilter);
    }

    // Apply search
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(w => 
        w.firstName.toLowerCase().includes(search) ||
        w.lastName.toLowerCase().includes(search) ||
        w.email.toLowerCase().includes(search)
      );
    }

    setFilteredWorkers(filtered);
  }, [workers, roleFilter, searchTerm]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(workers) !== JSON.stringify(originalWorkers);
    setHasChanges(changed);
  }, [workers, originalWorkers]);

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

  // Save all changes
  const handleSave = async () => {
    if (!departmentId) return;

    setSaving(true);
    setMessage(null);

    try {
      // Find workers that changed
      for (const worker of workers) {
        const original = originalWorkers.find(w => w.workerId === worker.workerId);
        
        if (!original) continue;

        // Check if qualifications changed
        const qualificationsChanged = 
          JSON.stringify(worker.qualifications.sort()) !== 
          JSON.stringify(original.qualifications.sort());

        // Check if מחלקה changed
        const subdepartmentChanged = worker.unit !== original.unit;

        // Check if closingIntervals changed
        const closingIntervalsChanged = (worker.closingInterval ?? 0) !== (original.closingInterval ?? 0);

        // Check if synced fields changed (email excluded as it cannot be changed)
        const syncedChanged = 
          worker.firstName !== original.firstName ||
          worker.lastName !== original.lastName ||
          worker.isOfficer !== original.isOfficer;

        // Check if role changed
        const roleChanged = worker.role !== original.role;

        if (roleChanged && (original.role === 'admin' || original.role === 'worker') && 
            (worker.role === 'admin' || worker.role === 'worker')) {
          // Role change (admin ↔ worker)
          const result = await changeWorkerRole(
            departmentId,
            worker.workerId,
            worker.role as 'admin' | 'worker',
            original.role as 'admin' | 'worker'
          );

          if (!result.success) {
            setMessage({ type: 'error', text: `שגיאה בשינוי תפקיד: ${result.message}` });
            setSaving(false);
            return;
          }
        }

        if (qualificationsChanged || syncedChanged || subdepartmentChanged || closingIntervalsChanged) {
          // Prepare update data based on role permissions
          const updateData: any = {};
          
          // Worker-only fields (both owner and admin can edit)
          if (qualificationsChanged) updateData.qualifications = worker.qualifications;
          if (subdepartmentChanged) updateData.unit = worker.unit;
          if (closingIntervalsChanged) updateData.closingInterval = worker.closingInterval;
          
          // Synced fields (only owner can edit)
          if (userRole === 'owner') {
            if (worker.firstName !== original.firstName) updateData.firstName = worker.firstName;
            if (worker.lastName !== original.lastName) updateData.lastName = worker.lastName;
            if (worker.isOfficer !== original.isOfficer) updateData.isOfficer = worker.isOfficer;
          }
          
          // Only update if there are actual changes to save
          if (Object.keys(updateData).length > 0) {
            const result = await updateWorkerWithSync(departmentId, worker.workerId, updateData);

            if (!result.success) {
              setMessage({ type: 'error', text: `שגיאה בעדכון עובד: ${result.message}` });
              setSaving(false);
              return;
            }
          }
        }
      }

      setMessage({ type: 'success', text: 'השינויים נשמרו בהצלחה!' });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'שגיאה בשמירת שינויים' });
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל את כל השינויים?')) {
      setWorkers([...originalWorkers]);
      setEditingWorkerId(null);
      setEditingWorker(null);
      setMessage(null);
    }
  };

  // Open edit modal
  const handleEdit = (worker: WorkerData) => {
    setEditingWorkerId(worker.workerId);
    setEditingWorker({ ...worker });
    
    // Setup closing interval state
    const interval = worker.closingInterval ?? 0;
    if (interval >= 9 && interval <= 12) {
      setShowCustomIntervalInput(true);
      setCustomClosingInterval(interval);
    } else {
      setShowCustomIntervalInput(false);
      setCustomClosingInterval(null);
    }
  };

  // Update field in current editing worker
  const handleUpdateField = (field: keyof WorkerData, value: any) => {
    if (!editingWorker) return;
    setEditingWorker({ ...editingWorker, [field]: value });
  };

  // Save edit to workers array
  const handleSaveEdit = () => {
    if (!editingWorker) return;

    // Validation (email cannot be changed, so no need to validate it)
    if (!editingWorker.firstName.trim() || !editingWorker.lastName.trim()) {
      alert('שם פרטי ושם משפחה הם שדות חובה');
      return;
    }

    // Validate מחלקה length
    if (editingWorker.unit && editingWorker.unit.length > 25) {
      alert('מחלקה חייבת להכיל עד 25 תווים');
      return;
    }

    // Trim מחלקה value
    const updatedWorker = {
      ...editingWorker,
      unit: editingWorker.unit?.trim() || ''
    };

    // Update workers array
    setWorkers(workers.map(w => 
      w.workerId === updatedWorker.workerId ? updatedWorker : w
    ));

    setEditingWorkerId(null);
    setEditingWorker(null);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingWorkerId(null);
    setEditingWorker(null);
    setShowCustomIntervalInput(false);
    setCustomClosingInterval(null);
  };

  // Delete worker
  const handleDelete = async (worker: WorkerData) => {
    if (!departmentId) return;

    // Permission check
    if (userRole === 'admin') {
      alert('אין לך הרשאות למחוק משתמשים');
      return;
    }

    // Confirmation with strong warning
    const confirmMessage = `⚠️ אזהרה: פעולה זו תמחק לצמיתות את המשתמש!\n\n` +
      `שם: ${worker.firstName} ${worker.lastName}\n` +
      `אימייל: ${worker.email}\n` +
      `תפקיד: ${getRoleInHebrew(worker.role)}\n\n` +
      `המשתמש לא יוכל להתחבר למערכת יותר.\n\n` +
      `האם אתה בטוח לחלוטין?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    if (!window.confirm('האם אתה בטוח? פעולה זו בלתי הפיכה!')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await softDeleteWorker(departmentId, worker.workerId, worker.role);

      if (result.success) {
        setMessage({ type: 'success', text: `${worker.firstName} ${worker.lastName} הוסר בהצלחה` });
        // Workers will auto-refresh via real-time listener
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error: any) {
      console.error('Error deleting worker:', error);
      setMessage({ type: 'error', text: 'שגיאה במחיקת משתמש' });
    } finally {
      setSaving(false);
    }
  };

  // Toggle qualification
  const toggleQualification = (taskId: string) => {
    if (!editingWorker) return;

    const qualifications = [...editingWorker.qualifications];
    const index = qualifications.indexOf(taskId);

    if (index > -1) {
      qualifications.splice(index, 1);
    } else {
      qualifications.push(taskId);
    }

    handleUpdateField('qualifications', qualifications);
  };

  // Helper functions
  const getRoleInHebrew = (role: string) => {
    switch (role) {
      case 'owner': return 'בעל/ת מחלקה';
      case 'admin': return 'מנהל/ת';
      case 'worker': return 'עובד/ת';
      default: return role;
    }
  };

  const getClosingIntervalLabel = (interval: number): string => {
    switch (interval) {
      case 0: return 'ללא סגירות';
      case 2: return 'חצאים';
      case 3: return 'שלישים';
      case 4: return 'רבעים';
      case 5: return 'אחד לחמש';
      case 6: return 'אחד לשש';
      case 8: return 'אחד לשמונה';
      default: 
        if (interval >= 9 && interval <= 12) {
          return `אחר (${interval})`;
        }
        return `${interval}`;
    }
  };

  const handleClosingIntervalChange = (value: string) => {
    if (!editingWorker) return;

    if (value === 'custom') {
      setShowCustomIntervalInput(true);
      // Keep current value if already custom, otherwise default to 9
      const defaultCustom = customClosingInterval || 9;
      setCustomClosingInterval(defaultCustom);
      handleUpdateField('closingInterval', defaultCustom);
    } else {
      setShowCustomIntervalInput(false);
      setCustomClosingInterval(null);
      handleUpdateField('closingInterval', parseInt(value));
    }
  };

  const handleCustomIntervalInput = (value: string) => {
    if (!editingWorker) return;
    
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 9 && numValue <= 12) {
      setCustomClosingInterval(numValue);
      handleUpdateField('closingInterval', numValue);
    }
  };

  const getRoleCounts = () => {
    const all = workers.length;
    const owners = workers.filter(w => w.role === 'owner').length;
    const admins = workers.filter(w => w.role === 'admin').length;
    const workersCount = workers.filter(w => w.role === 'worker').length;
    return { all, owners, admins, workers: workersCount };
  };

  const counts = getRoleCounts();

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
        <div className="container mx-auto px-4 max-w-7xl">
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
              ניהול עובדים
            </h1>
            <p className="text-white/80 mt-2">
              {userRole === 'owner' 
                ? 'נהל את העובדים והגדר עבורם משימות שהם יכולים לבצע'
                : 'הגדרת משימות שהעובד יכול לבצע'}
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50'
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <p className="text-white text-center">{message.text}</p>
            </div>
          )}

          {/* Save/Discard Bar */}
            {hasChanges && (
            <div className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-white">
                  ⚠️ יש לך שינויים שלא נשמרו
                </p>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleDiscard} disabled={saving}>בטל שינויים</Button>
                    <Button onClick={handleSave} disabled={saving} blink={!saving}> {saving ? 'שומר...' : 'שמור שינויים'} </Button>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="mb-6 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-white mb-2 text-sm font-medium">חיפוש עובדים</label>
                <Input value={searchTerm} onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)} placeholder="חפש לפי שם או אימייל..." />
              </div>

              {/* Role Filter - Only for owner */}
              {userRole === 'owner' && (
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">סינון לפי תפקיד</label>
                  <details ref={roleFilterDetailsRef} open={roleFilterOpen} className="group bg-white/10 border border-white/20 rounded-xl">
                    <summary className="list-none px-4 py-2 text-white/90 cursor-pointer rounded-xl flex items-center justify-between" onClick={(e) => { e.preventDefault(); setRoleFilterOpen(v => !v); }}>
                      <span>
                        {roleFilter === 'all' ? `הכל (${counts.all})` : roleFilter === 'owner' ? `בעלים (${counts.owners})` : roleFilter === 'admin' ? `מנהלים (${counts.admins})` : `עובדים (${counts.workers})`}
                      </span>
                      <span className="text-white/70">▾</span>
                    </summary>
                    <div className="px-2 pb-2">
                      {[
                        { id: 'all', label: `הכל (${counts.all})` },
                        { id: 'owner', label: `בעלים (${counts.owners})` },
                        { id: 'admin', label: `מנהלים (${counts.admins})` },
                        { id: 'worker', label: `עובדים (${counts.workers})` },
                      ].map((opt) => (
                        <button key={opt.id} type="button" className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white ${roleFilter === (opt.id as any) ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}
                          onClick={() => { setRoleFilter(opt.id as any); setRoleFilterOpen(false); roleFilterDetailsRef.current && (roleFilterDetailsRef.current.open = false); }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Workers List */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
            {filteredWorkers.length === 0 ? (
              <div className="p-12 text-center text-white">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-xl mb-2">לא נמצאו עובדים</p>
                <p className="text-white/70">
                  {searchTerm ? 'נסה לשנות את מונחי החיפוש' : 'טרם נוספו עובדים למחלקה'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/20">
                    <tr>
                      <th className="px-6 py-4 text-right text-white font-semibold">שם</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">אימייל</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">תפקיד</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">מחלקה</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">קצין</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">הסמכות</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">סגירות</th>
                      <th className="px-6 py-4 text-center text-white font-semibold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.workerId} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white">
                          {worker.firstName} {worker.lastName}
                        </td>
                        <td className="px-6 py-4 text-white/80 font-mono text-sm" dir="ltr">
                          {worker.email}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${
                            worker.role === 'owner' 
                              ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                              : worker.role === 'admin'
                              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                              : 'bg-green-500/20 border border-green-500/50 text-green-300'
                          }`}>
                            {getRoleInHebrew(worker.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white">
                          {worker.unit || <span className="text-white/40 italic">לא הוגדר</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {worker.isOfficer ? (
                            <span className="text-yellow-400">⭐</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-white">
                          {worker.qualifications.length} הסמכות
                        </td>
                        <td className="px-6 py-4 text-white">
                          {getClosingIntervalLabel(worker.closingInterval ?? 0)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" onClick={() => handleEdit(worker)}>ערוך</Button>
                            {userRole === 'owner' && worker.role !== 'owner' && (
                              <Button size="sm" variant="secondary" className="bg-red-600/40 border-red-400/40 hover:bg-red-600/60" onClick={() => handleDelete(worker)} disabled={saving}>מחק</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <h2 className="text-3xl font-bold text-white mb-6">
              {editingWorker.firstName} {editingWorker.lastName}
            </h2>

            <div className="space-y-6">
              {/* Name Fields - Owner only */}
              {userRole === 'owner' && (
                <>
                  <div>
                    <label className="block text-white mb-2 text-sm font-medium">
                      שם פרטי <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingWorker.firstName}
                      onChange={(e) => handleUpdateField('firstName', e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2 text-sm font-medium">
                      שם משפחה <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingWorker.lastName}
                      onChange={(e) => handleUpdateField('lastName', e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2 text-sm font-medium">
                      אימייל
                    </label>
                    <input
                      type="email"
                      value={editingWorker.email}
                      disabled
                      dir="ltr"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white/50 cursor-not-allowed"
                    />
                    <p className="text-white/60 text-xs mt-1">
                      לא ניתן לשנות כתובת אימייל
                    </p>
                  </div>

                  {/* Role Change - Owner only, not for owner role */}
                  {editingWorker.role !== 'owner' && (
                    <div>
                      <label className="block text-white mb-2 text-sm font-medium">
                        תפקיד
                      </label>
                      <details ref={modalRoleDetailsRef} open={modalRoleOpen} className="group bg-white/10 border border-white/20 rounded-xl">
                        <summary
                          className="list-none px-4 py-2 text-white/90 cursor-pointer rounded-xl flex items-center justify-between"
                          onClick={(e) => { e.preventDefault(); setModalRoleOpen(v => !v); }}
                        >
                          <span>{editingWorker.role === 'admin' ? 'מנהל/ת' : 'עובד/ת'}</span>
                          <span className="text-white/70">▾</span>
                        </summary>
                        <div className="px-2 pb-2">
                          {[
                            { id: 'admin', label: 'מנהל/ת' },
                            { id: 'worker', label: 'עובד/ת' },
                          ].map((opt) => (
                            <button key={opt.id} type="button" className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white ${editingWorker.role === opt.id ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}
                              onClick={() => { handleUpdateField('role', opt.id); setModalRoleOpen(false); if (modalRoleDetailsRef.current) modalRoleDetailsRef.current.open = false; }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </details>
                      <p className="text-white/60 text-xs mt-1">
                        שינוי תפקיד ישפיע על הרשאות המשתמש בדשבורד
                      </p>
                    </div>
                  )}

                  {/* Officer Status - Owner only */}
                  <div>
                    <label className="flex items-center gap-3 text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingWorker.isOfficer}
                        onChange={(e) => handleUpdateField('isOfficer', e.target.checked)}
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                      <span>קצין (Officer)</span>
                    </label>
                    <p className="text-white/60 text-xs mt-1 mr-8">
                      סטטוס קצין מאפשר גישה להרשאות נוספות
                    </p>
                  </div>
                </>
              )}

              {/* Qualifications - Both roles */}
              <div>
                <label className="block text-white mb-3 text-sm font-medium">
                  עבודות
                </label>
                {taskDefinitions.length === 0 ? (
                  <p className="text-white/60 text-sm">
                    לא הוגדרו משימות משניות במחלקה. נא להוסיף משימות בהגדרות.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {taskDefinitions.map((task) => (
                      <label key={task.id} className="flex items-center gap-3 text-white cursor-pointer bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={editingWorker.qualifications.includes(task.id)}
                          onChange={() => toggleQualification(task.id)}
                          className="w-5 h-5 rounded cursor-pointer"
                        />
                        <span>{task.name}</span>
                        {task.requiresQualification && (
                          <span className="text-xs text-blue-300">(דורש הסמכה)</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* מחלקה (Sub-department) - Owner only */}
              {userRole === 'owner' && (
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">
                    מחלקה (תת-מחלקה)
                  </label>
                  <input
                    type="text"
                    value={editingWorker.unit || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 25) {
                        handleUpdateField('unit', value);
                      }
                    }}
                    maxLength={25}
                    placeholder="לדוגמה: צוות א', 'משמרת בוקר', וכו'"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                  />
                  <p className="text-white/60 text-xs mt-1">
                    תת-מחלקה או צוות בתוך המחלקה (עד 25 תווים, אופציונלי)
                  </p>
                </div>
              )}

              {/* Closing Intervals - Both roles */}
              <div>
                <label className="block text-white mb-2 text-sm font-medium">
                  אינטרוולי סגירות
                </label>
                <details ref={closingDetailsRef} open={closingOpen} className="group bg-white/10 border border-white/20 rounded-xl">
                  <summary
                    className="list-none px-4 py-2 text-white/90 cursor-pointer rounded-xl flex items-center justify-between"
                    onClick={(e) => { e.preventDefault(); setClosingOpen(v => !v); }}
                  >
                    <span>{showCustomIntervalInput ? 'אחר' : getClosingIntervalLabel(editingWorker.closingInterval ?? 0)}</span>
                    <span className="text-white/70">▾</span>
                  </summary>
                  <div className="px-2 pb-2">
                    {[
                      { id: '0', label: 'ללא סגירות' },
                      { id: '2', label: 'חצאים' },
                      { id: '3', label: 'שלישים' },
                      { id: '4', label: 'רבעים' },
                      { id: '5', label: 'אחד לחמש' },
                      { id: '6', label: 'אחד לשש' },
                      { id: '8', label: 'אחד לשמונה' },
                      { id: 'custom', label: 'אחר' },
                    ].map((opt) => (
                      <button key={opt.id} type="button" className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white ${(!showCustomIntervalInput && String(editingWorker.closingInterval ?? 0) === opt.id) || (showCustomIntervalInput && opt.id === 'custom') ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}
                        onClick={() => { handleClosingIntervalChange(opt.id); setClosingOpen(false); if (closingDetailsRef.current) closingDetailsRef.current.open = false; }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </details>
                
                {/* Custom interval input */}
                {showCustomIntervalInput && (
                  <div className="mt-3">
                    <label className="block text-white mb-2 text-sm font-medium">
                      הזן ערך מותאם אישית (9-12)
                    </label>
                    <input
                      type="number"
                      min="9"
                      max="12"
                      value={customClosingInterval || 9}
                      onChange={(e) => handleCustomIntervalInput(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    />
                    <p className="text-white/60 text-xs mt-1">
                      הזן מספר בין 9 ל-12 (כולל)
                    </p>
                  </div>
                )}
                
                <p className="text-white/60 text-xs mt-1">
                  קובע את תדירות הסגירות של העובד בלוח משמרות
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-white/20">
              <Button fullWidth onClick={handleSaveEdit}>✓ שמור שינויים</Button>
              <Button fullWidth variant="secondary" onClick={handleCancelEdit}>✕ ביטול</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageWorkers;

